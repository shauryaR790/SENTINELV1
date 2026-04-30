from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import io
import csv
import json
import random
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

import bcrypt
import jwt
import httpx
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

try:
    import PyPDF2
except Exception:
    PyPDF2 = None
try:
    import openpyxl
except Exception:
    openpyxl = None

# -------- App / DB Setup --------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="SENTINEL OSINT API")
api = APIRouter(prefix="/api")

JWT_ALG = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(name)s %(levelname)s %(message)s')
logger = logging.getLogger("sentinel")


# -------- Auth Helpers --------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False

def make_token(user_id: str, email: str, role: str, ttl_minutes: int = 60 * 24) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

def require_role(*roles):
    async def checker(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, f"Requires role: {roles}")
        return user
    return checker

async def audit(user: dict, action: str, target: str = "", meta: dict = None):
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user.get("id"),
        "email": user.get("email"),
        "role": user.get("role"),
        "action": action,
        "target": target,
        "meta": meta or {},
        "ts": datetime.now(timezone.utc).isoformat(),
    })


# -------- Models --------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "viewer"

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class EventIn(BaseModel):
    title: str
    description: str = ""
    lat: float
    lng: float
    severity: str = "medium"  # low, medium, high, critical
    category: str = "conflict"  # conflict, protest, military, cyber
    country: str = ""
    source: str = "OSINT"
    reliability: int = 70  # 0-100

class PersonIn(BaseModel):
    full_name: str
    aliases: List[str] = []
    phone: Optional[str] = None
    email: Optional[str] = None
    nationality: Optional[str] = None
    affiliations: List[str] = []
    notes: str = ""
    risk_score: int = 0
    tags: List[str] = []

class RelationshipIn(BaseModel):
    source_id: str
    target_id: str
    relation: str
    strength: int = 50

class MissionIn(BaseModel):
    title: str
    description: str
    status: str = "proposed"  # proposed, approved, active, complete
    severity: str = "medium"
    assets: List[Dict[str, Any]] = []
    steps: List[Dict[str, Any]] = []
    total_hours: float = 0

class NLQuery(BaseModel):
    query: str


# -------- Auth Routes --------
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    if body.role not in ("admin", "analyst", "viewer"):
        raise HTTPException(400, "Invalid role")
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": body.name,
        "role": body.role,
        "password_hash": hash_password(body.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = make_token(user["id"], email, user["role"])
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=86400, path="/")
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "access_token": token}

@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = make_token(user["id"], email, user["role"])
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=86400, path="/")
    await audit(user, "login")
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "access_token": token}

@api.post("/auth/logout")
async def logout(response: Response, user=Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    await audit(user, "logout")
    return {"ok": True}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# -------- Events (Global War/Event Tracking) --------
@api.get("/events")
async def list_events(category: Optional[str] = None, severity: Optional[str] = None, limit: int = 500, user=Depends(get_current_user)):
    q = {}
    if category: q["category"] = category
    if severity: q["severity"] = severity
    items = await db.events.find(q, {"_id": 0}).sort("ts", -1).to_list(limit)
    return items

@api.post("/events")
async def create_event(body: EventIn, user=Depends(require_role("admin", "analyst"))):
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["ts"] = datetime.now(timezone.utc).isoformat()
    doc["created_by"] = user["email"]
    await db.events.insert_one(doc)
    doc.pop("_id", None)
    await audit(user, "event.create", doc["id"])
    return doc

@api.delete("/events/{event_id}")
async def delete_event(event_id: str, user=Depends(require_role("admin", "analyst"))):
    await db.events.delete_one({"id": event_id})
    await audit(user, "event.delete", event_id)
    return {"ok": True}


# -------- Aircraft (OpenSky) --------
_aircraft_cache = {"ts": 0, "data": []}

@api.get("/aircraft/live")
async def aircraft_live(user=Depends(get_current_user)):
    """Proxy OpenSky Network (no auth, global states). Cached for 15 seconds."""
    now = datetime.now(timezone.utc).timestamp()
    if now - _aircraft_cache["ts"] < 15 and _aircraft_cache["data"]:
        return {"cached": True, "count": len(_aircraft_cache["data"]), "aircraft": _aircraft_cache["data"]}
    try:
        async with httpx.AsyncClient(timeout=10.0) as cli:
            # Bounded area over Europe/ME to limit data
            r = await cli.get("https://opensky-network.org/api/states/all?lamin=20&lomin=-20&lamax=65&lomax=60")
        data = r.json()
        states = data.get("states", []) or []
        parsed = []
        for s in states[:400]:
            try:
                parsed.append({
                    "icao24": s[0],
                    "callsign": (s[1] or "").strip(),
                    "origin": s[2],
                    "lng": s[5],
                    "lat": s[6],
                    "altitude": s[7],
                    "on_ground": s[8],
                    "velocity": s[9],
                    "heading": s[10],
                    "vertical_rate": s[11],
                })
            except Exception:
                continue
        parsed = [a for a in parsed if a["lat"] is not None and a["lng"] is not None]
        if not parsed:
            parsed = _simulate_aircraft(150)
            _aircraft_cache["ts"] = now
            _aircraft_cache["data"] = parsed
            return {"cached": False, "count": len(parsed), "aircraft": parsed, "simulated": True}
        _aircraft_cache["ts"] = now
        _aircraft_cache["data"] = parsed
        return {"cached": False, "count": len(parsed), "aircraft": parsed}
    except Exception as e:
        logger.warning(f"OpenSky failed: {e}; returning simulated")
        # fallback simulated
        sim = _simulate_aircraft(150)
        return {"cached": False, "count": len(sim), "aircraft": sim, "simulated": True}

def _simulate_aircraft(n=150):
    out = []
    for i in range(n):
        out.append({
            "icao24": f"sim{i:04x}",
            "callsign": random.choice(["NR", "AF", "UA", "BA", "DL", "SQ"]) + str(random.randint(1000, 9999)),
            "origin": random.choice(["United States", "Germany", "France", "Turkey", "UAE", "UK", "Japan"]),
            "lng": random.uniform(-180, 180),
            "lat": random.uniform(-60, 75),
            "altitude": random.randint(8000, 13000),
            "on_ground": False,
            "velocity": random.randint(180, 280),
            "heading": random.randint(0, 359),
            "vertical_rate": 0,
        })
    return out


# -------- Ships (simulated) --------
@api.get("/ships/live")
async def ships_live(user=Depends(get_current_user)):
    ships = await db.ships.find({}, {"_id": 0}).to_list(300)
    # Move each ship a little
    for s in ships:
        s["lat"] += random.uniform(-0.05, 0.05)
        s["lng"] += random.uniform(-0.05, 0.05)
    return {"count": len(ships), "ships": ships}


# -------- OSINT People --------
@api.get("/osint/people")
async def list_people(q: Optional[str] = None, user=Depends(get_current_user)):
    query = {}
    if q:
        query = {"$or": [
            {"full_name": {"$regex": q, "$options": "i"}},
            {"aliases": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}},
        ]}
    items = await db.people.find(query, {"_id": 0}).sort("risk_score", -1).to_list(200)
    return items

@api.post("/osint/people")
async def create_person(body: PersonIn, user=Depends(require_role("admin", "analyst"))):
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.people.insert_one(doc)
    doc.pop("_id", None)
    await audit(user, "person.create", doc["id"])
    return doc

@api.get("/osint/people/{pid}")
async def get_person(pid: str, user=Depends(get_current_user)):
    p = await db.people.find_one({"id": pid}, {"_id": 0})
    if not p: raise HTTPException(404, "Not found")
    # related
    rels = await db.relationships.find({"$or": [{"source_id": pid}, {"target_id": pid}]}, {"_id": 0}).to_list(100)
    return {"person": p, "relationships": rels}


# -------- Relationship Graph --------
@api.get("/graph")
async def graph(user=Depends(get_current_user)):
    people = await db.people.find({}, {"_id": 0}).to_list(500)
    orgs = await db.organizations.find({}, {"_id": 0}).to_list(200)
    locations = await db.locations.find({}, {"_id": 0}).to_list(200)
    events = await db.events.find({}, {"_id": 0}).to_list(200)
    rels = await db.relationships.find({}, {"_id": 0}).to_list(1000)

    nodes = []
    for p in people:
        nodes.append({"id": p["id"], "label": p["full_name"], "type": "person", "risk": p.get("risk_score", 0)})
    for o in orgs:
        nodes.append({"id": o["id"], "label": o["name"], "type": "organization"})
    for l in locations:
        nodes.append({"id": l["id"], "label": l["name"], "type": "location"})
    for e in events:
        nodes.append({"id": e["id"], "label": e["title"], "type": "event", "severity": e.get("severity")})
    links = [{"source": r["source_id"], "target": r["target_id"], "relation": r["relation"], "strength": r.get("strength", 50)} for r in rels]
    return {"nodes": nodes, "links": links}

@api.post("/graph/link")
async def create_link(body: RelationshipIn, user=Depends(require_role("admin", "analyst"))):
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.relationships.insert_one(doc)
    doc.pop("_id", None)
    await audit(user, "graph.link", doc["id"])
    return doc


# -------- Missions --------
@api.get("/missions")
async def list_missions(user=Depends(get_current_user)):
    items = await db.missions.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

@api.post("/missions")
async def create_mission(body: MissionIn, user=Depends(require_role("admin", "analyst"))):
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["created_by"] = user["email"]
    await db.missions.insert_one(doc)
    doc.pop("_id", None)
    await audit(user, "mission.create", doc["id"])
    return doc


# -------- Analytics --------
@api.get("/analytics/kpis")
async def kpis(user=Depends(get_current_user)):
    active_events = await db.events.count_documents({"severity": {"$in": ["high", "critical"]}})
    total_events = await db.events.count_documents({})
    people_count = await db.people.count_documents({})
    high_risk = await db.people.count_documents({"risk_score": {"$gte": 70}})
    missions = await db.missions.count_documents({"status": {"$in": ["proposed", "active"]}})
    docs_ingested = await db.documents.count_documents({})
    # by region
    regions = {}
    async for ev in db.events.find({}, {"_id": 0, "country": 1, "severity": 1}):
        c = ev.get("country", "UNKNOWN") or "UNKNOWN"
        regions[c] = regions.get(c, 0) + 1
    region_arr = [{"name": k, "value": v} for k, v in sorted(regions.items(), key=lambda x: -x[1])[:10]]
    # time series last 14d
    now = datetime.now(timezone.utc)
    series = []
    for i in range(13, -1, -1):
        d = (now - timedelta(days=i)).date().isoformat()
        start = datetime.fromisoformat(d + "T00:00:00+00:00").isoformat()
        end = datetime.fromisoformat(d + "T23:59:59+00:00").isoformat()
        c = await db.events.count_documents({"ts": {"$gte": start, "$lte": end}})
        series.append({"date": d[5:], "events": c})
    return {
        "active_threats": active_events,
        "total_events": total_events,
        "people_tracked": people_count,
        "high_risk_people": high_risk,
        "active_missions": missions,
        "documents_ingested": docs_ingested,
        "instability_index": min(100, active_events * 3 + high_risk * 2),
        "regions": region_arr,
        "timeseries": series,
    }


# -------- Search --------
@api.get("/search")
async def search(q: str, user=Depends(get_current_user)):
    q_lower = q.lower()
    out = {"events": [], "people": [], "missions": []}
    regex = {"$regex": q, "$options": "i"}
    out["events"] = await db.events.find({"$or": [{"title": regex}, {"description": regex}, {"country": regex}]}, {"_id": 0}).limit(20).to_list(20)
    out["people"] = await db.people.find({"$or": [{"full_name": regex}, {"aliases": regex}, {"email": regex}]}, {"_id": 0}).limit(20).to_list(20)
    out["missions"] = await db.missions.find({"$or": [{"title": regex}, {"description": regex}]}, {"_id": 0}).limit(20).to_list(20)
    return out


# -------- Files / Ingestion --------
def _extract_text_pdf(b: bytes) -> str:
    if not PyPDF2: return ""
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(b))
        parts = []
        for p in reader.pages[:30]:
            parts.append(p.extract_text() or "")
        return "\n".join(parts)
    except Exception as e:
        logger.warning(f"pdf extract failed: {e}")
        return ""

def _extract_text_csv(b: bytes) -> str:
    try:
        text = b.decode("utf-8", errors="ignore")
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)[:100]
        return "\n".join([", ".join(r) for r in rows])
    except Exception:
        return b.decode("utf-8", errors="ignore")[:8000]

def _extract_text_xlsx(b: bytes) -> str:
    if not openpyxl: return ""
    try:
        wb = openpyxl.load_workbook(io.BytesIO(b), data_only=True)
        parts = []
        for sheet in wb.worksheets[:3]:
            for row in sheet.iter_rows(max_row=100, values_only=True):
                parts.append(", ".join([str(c) if c is not None else "" for c in row]))
        return "\n".join(parts)
    except Exception as e:
        logger.warning(f"xlsx failed: {e}")
        return ""


async def ai_extract_entities(text: str) -> Dict[str, Any]:
    """Use Claude Sonnet 4.5 via emergentintegrations to extract entities."""
    if not text.strip():
        return {"persons": [], "organizations": [], "locations": [], "summary": ""}
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=os.environ["EMERGENT_LLM_KEY"],
            session_id=f"extract-{uuid.uuid4()}",
            system_message=(
                "You are an OSINT analyst. Extract named entities from the given text. "
                "Respond ONLY with valid minified JSON with keys: persons (list of {name, role}), "
                "organizations (list of strings), locations (list of strings), "
                "summary (1-2 sentence threat summary). No markdown, no code fence."
            ),
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        resp = await chat.send_message(UserMessage(text=text[:6000]))
        resp = resp.strip()
        if resp.startswith("```"):
            resp = resp.strip("`")
            if resp.lower().startswith("json"):
                resp = resp[4:]
        data = json.loads(resp)
        return {
            "persons": data.get("persons", [])[:20],
            "organizations": data.get("organizations", [])[:20],
            "locations": data.get("locations", [])[:20],
            "summary": data.get("summary", "")[:500],
        }
    except Exception as e:
        logger.warning(f"AI extract failed: {e}")
        return {"persons": [], "organizations": [], "locations": [], "summary": f"(extraction error: {e})"}


@api.post("/files/upload")
async def upload_file(
    file: UploadFile = File(...),
    classification: str = Form("public"),
    tags: str = Form(""),
    user=Depends(require_role("admin", "analyst")),
):
    b = await file.read()
    name = file.filename or "file"
    ext = name.rsplit(".", 1)[-1].lower()
    if ext == "pdf":
        text = _extract_text_pdf(b)
    elif ext == "csv":
        text = _extract_text_csv(b)
    elif ext in ("xlsx", "xls"):
        text = _extract_text_xlsx(b)
    elif ext in ("txt", "md", "log"):
        text = b.decode("utf-8", errors="ignore")
    else:
        text = b.decode("utf-8", errors="ignore")[:8000]
    ents = await ai_extract_entities(text)
    doc = {
        "id": str(uuid.uuid4()),
        "name": name,
        "size": len(b),
        "type": ext,
        "classification": classification,
        "tags": [t.strip() for t in tags.split(",") if t.strip()],
        "uploaded_by": user["email"],
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "text_preview": text[:600],
        "entities": ents,
    }
    await db.documents.insert_one(doc)
    # Auto-create person entities
    for p in ents.get("persons", []):
        pname = p.get("name") if isinstance(p, dict) else str(p)
        if not pname: continue
        existing = await db.people.find_one({"full_name": pname})
        if not existing:
            await db.people.insert_one({
                "id": str(uuid.uuid4()),
                "full_name": pname,
                "aliases": [],
                "affiliations": [],
                "notes": f"Auto-extracted from {name}",
                "risk_score": random.randint(20, 60),
                "tags": ["auto", ext],
                "phone": None, "email": None, "nationality": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    await audit(user, "file.upload", doc["id"], {"name": name, "size": len(b)})
    doc.pop("_id", None)
    return doc

@api.get("/files")
async def list_files(user=Depends(get_current_user)):
    items = await db.documents.find({}, {"_id": 0}).sort("uploaded_at", -1).to_list(100)
    return items


# -------- AI Insights & NL Query --------
@api.get("/ai/insights")
async def ai_insights(user=Depends(get_current_user)):
    events = await db.events.find({}, {"_id": 0, "title": 1, "severity": 1, "country": 1, "category": 1}).sort("ts", -1).limit(30).to_list(30)
    summary = {
        "critical_count": sum(1 for e in events if e.get("severity") == "critical"),
        "high_count": sum(1 for e in events if e.get("severity") == "high"),
        "countries": list({e.get("country") for e in events if e.get("country")}),
    }
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=os.environ["EMERGENT_LLM_KEY"],
            session_id=f"insights-{uuid.uuid4()}",
            system_message="You are a senior intelligence analyst. Given a summary of recent global events, produce 3 concise bullet insights (each ~20 words) focusing on emerging patterns, hotspots, and anomalies. Return JSON: {\"insights\": [\"...\",\"...\",\"...\"]}. No markdown.",
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        payload = json.dumps({"summary": summary, "events": events[:15]})
        resp = await chat.send_message(UserMessage(text=payload))
        resp = resp.strip()
        if resp.startswith("```"): resp = resp.strip("`")
        if resp.lower().startswith("json"): resp = resp[4:]
        return json.loads(resp)
    except Exception as e:
        logger.warning(f"insights failed: {e}")
        return {"insights": [
            f"{summary['critical_count']} critical events detected; escalation monitoring advised.",
            f"Activity concentrated across {len(summary['countries'])} regions; cross-border coordination indicated.",
            "Pattern anomalies require analyst follow-up; see event feed for specifics.",
        ]}

@api.post("/ai/nl-query")
async def nl_query(body: NLQuery, user=Depends(get_current_user)):
    """Parse natural language to structured filter and return events."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=os.environ["EMERGENT_LLM_KEY"],
            session_id=f"nlq-{uuid.uuid4()}",
            system_message=(
                "Convert the user query into a JSON filter for our event database. "
                "Schema: {\"region\": string or null, \"severity\": \"low|medium|high|critical|null\", "
                "\"category\": \"conflict|protest|military|cyber|null\", \"hours\": number or null, "
                "\"keywords\": [strings]}. Return ONLY JSON."
            ),
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        resp = await chat.send_message(UserMessage(text=body.query))
        resp = resp.strip()
        if resp.startswith("```"): resp = resp.strip("`")
        if resp.lower().startswith("json"): resp = resp[4:]
        filt = json.loads(resp)
    except Exception as e:
        logger.warning(f"nlq parse failed: {e}")
        filt = {"keywords": body.query.split()[:5]}

    q: Dict[str, Any] = {}
    if filt.get("severity"): q["severity"] = filt["severity"]
    if filt.get("category"): q["category"] = filt["category"]
    if filt.get("region"):
        q["country"] = {"$regex": filt["region"], "$options": "i"}
    if filt.get("keywords"):
        kw = "|".join([k for k in filt["keywords"] if k][:5])
        if kw:
            q["$or"] = [{"title": {"$regex": kw, "$options": "i"}}, {"description": {"$regex": kw, "$options": "i"}}]
    events = await db.events.find(q, {"_id": 0}).sort("ts", -1).limit(50).to_list(50)
    return {"filter": filt, "events": events, "count": len(events)}


# -------- Audit Log --------
@api.get("/audit")
async def get_audit(limit: int = 100, user=Depends(require_role("admin"))):
    items = await db.audit_logs.find({}, {"_id": 0}).sort("ts", -1).to_list(limit)
    return items


# -------- Include router and CORS --------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "*")] if os.environ.get("FRONTEND_URL") else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------- Seeding --------
SEED_EVENTS = [
    {"title": "Border clash in Eastern Ukraine", "description": "Artillery exchange reported near Donetsk frontline.", "lat": 48.015, "lng": 37.8, "severity": "critical", "category": "conflict", "country": "Ukraine", "source": "Reuters", "reliability": 88},
    {"title": "Protests escalate in Tehran", "description": "Mass demonstrations reported in central Tehran.", "lat": 35.689, "lng": 51.389, "severity": "high", "category": "protest", "country": "Iran", "source": "AP", "reliability": 80},
    {"title": "Naval exercise in South China Sea", "description": "PLA Navy conducts live-fire drill near disputed waters.", "lat": 15.0, "lng": 117.0, "severity": "medium", "category": "military", "country": "China", "source": "MOD", "reliability": 75},
    {"title": "Cyberattack on power grid - Baltic", "description": "APT group suspected; grid operators on heightened alert.", "lat": 59.43, "lng": 24.75, "severity": "high", "category": "cyber", "country": "Estonia", "source": "CERT", "reliability": 70},
    {"title": "Embassy evacuation drill - Zlarovo", "description": "Precautionary drill at US Embassy compound.", "lat": 43.78, "lng": 20.5, "severity": "medium", "category": "military", "country": "Tereskia", "source": "DoS", "reliability": 92},
    {"title": "IED incident on MSR Tampa", "description": "Improvised device detonated along main supply route.", "lat": 33.3, "lng": 44.4, "severity": "high", "category": "conflict", "country": "Iraq", "source": "SIGACT", "reliability": 85},
    {"title": "Maritime incident in Red Sea", "description": "Commercial vessel reports unidentified drone approach.", "lat": 13.0, "lng": 43.0, "severity": "critical", "category": "military", "country": "Yemen", "source": "UKMTO", "reliability": 90},
    {"title": "Political unrest in Caracas", "description": "Anti-government marches reported across capital.", "lat": 10.48, "lng": -66.90, "severity": "medium", "category": "protest", "country": "Venezuela", "source": "AFP", "reliability": 72},
    {"title": "Airspace violation in Baltic", "description": "Fighter aircraft scrambled to intercept unknown contact.", "lat": 56.95, "lng": 21.0, "severity": "medium", "category": "military", "country": "Latvia", "source": "NATO", "reliability": 88},
    {"title": "Ransomware attack on hospital network", "description": "Healthcare provider systems encrypted; investigation ongoing.", "lat": 51.5, "lng": -0.12, "severity": "high", "category": "cyber", "country": "UK", "source": "NCSC", "reliability": 82},
    {"title": "Troop movement detected - Suwalki", "description": "Satellite imagery shows armored column.", "lat": 54.1, "lng": 22.9, "severity": "high", "category": "military", "country": "Poland", "source": "IMINT", "reliability": 78},
    {"title": "Terror cell intercepted in Marseille", "description": "Counter-terror operation leads to arrests.", "lat": 43.30, "lng": 5.37, "severity": "medium", "category": "conflict", "country": "France", "source": "DGSI", "reliability": 86},
]

SEED_PEOPLE = [
    {"full_name": "Viktor Petrenko", "aliases": ["The Accountant"], "nationality": "RU", "affiliations": ["Wagner Finance"], "risk_score": 82, "tags": ["financial", "sanctions"], "notes": "Linked to arms procurement networks."},
    {"full_name": "Amara Osei", "aliases": [], "nationality": "GH", "affiliations": ["NGO Freelance"], "risk_score": 15, "tags": ["humanitarian"], "notes": "Humanitarian worker, low risk."},
    {"full_name": "Jin Zhao", "aliases": ["J. Zhao"], "nationality": "CN", "affiliations": ["Huawei Shadow"], "risk_score": 74, "tags": ["cyber", "apt"], "notes": "Suspected signals interception activity."},
    {"full_name": "Colonel Hassan Rahimi", "aliases": ["HR"], "nationality": "IR", "affiliations": ["IRGC-QF"], "risk_score": 91, "tags": ["military", "sanctions"], "notes": "Proxy coordination across Levant."},
    {"full_name": "Sara Lindqvist", "aliases": [], "nationality": "SE", "affiliations": ["Press"], "risk_score": 22, "tags": ["journalist"], "notes": "Investigative journalist covering arms trade."},
    {"full_name": "Mikhail Varenko", "aliases": ["Misha"], "nationality": "UA", "affiliations": ["GUR"], "risk_score": 45, "tags": ["intelligence"], "notes": "Liaison officer."},
    {"full_name": "Dr. Layla Haddad", "aliases": [], "nationality": "LB", "affiliations": ["Medical Aid"], "risk_score": 12, "tags": ["medical"], "notes": "Civilian trauma surgeon."},
    {"full_name": "Ernesto Vargas", "aliases": ["El Flaco"], "nationality": "VE", "affiliations": ["Tren de Aragua"], "risk_score": 88, "tags": ["cartel", "violent"], "notes": "Transnational criminal network leader."},
]

SEED_SHIPS = [
    {"name": "USS EDWARDSON", "mmsi": "367123400", "type": "Naval", "lat": 36.2, "lng": 15.5, "speed": 22, "course": 90, "flag": "US"},
    {"name": "MV LEONIDAS", "mmsi": "241234567", "type": "Cargo", "lat": 30.5, "lng": 32.5, "speed": 14, "course": 45, "flag": "GR"},
    {"name": "LNG STAR", "mmsi": "319876543", "type": "Tanker", "lat": 25.1, "lng": 55.1, "speed": 11, "course": 130, "flag": "KY"},
    {"name": "HMS DEFENDER", "mmsi": "232005000", "type": "Naval", "lat": 35.9, "lng": 14.5, "speed": 18, "course": 75, "flag": "GB"},
    {"name": "MSC ARIES", "mmsi": "636019999", "type": "Container", "lat": 12.9, "lng": 44.2, "speed": 0, "course": 0, "flag": "LR"},
    {"name": "OCEAN PROBE", "mmsi": "257700001", "type": "Research", "lat": 60.1, "lng": 5.3, "speed": 9, "course": 200, "flag": "NO"},
    {"name": "BLACK TIDE", "mmsi": "273900000", "type": "Tanker", "lat": 44.5, "lng": 34.0, "speed": 8, "course": 270, "flag": "RU"},
    {"name": "PACIFIC DAWN", "mmsi": "412000000", "type": "Cargo", "lat": 22.3, "lng": 114.2, "speed": 16, "course": 110, "flag": "CN"},
]

SEED_ORGS = [
    {"name": "Wagner Finance"}, {"name": "IRGC-QF"}, {"name": "Huawei Shadow"},
    {"name": "Tren de Aragua"}, {"name": "NATO"}, {"name": "NGO Red Arc"},
]

SEED_LOCATIONS = [
    {"name": "Donetsk", "lat": 48.015, "lng": 37.8},
    {"name": "Tehran", "lat": 35.689, "lng": 51.389},
    {"name": "Aden Gulf", "lat": 13.0, "lng": 43.0},
    {"name": "Caracas", "lat": 10.48, "lng": -66.9},
]


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.events.create_index("ts")
    await db.people.create_index("full_name")
    await db.relationships.create_index([("source_id", 1), ("target_id", 1)])

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@sentinel.mil").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "Sentinel2026!")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": "Command",
            "role": "admin",
            "password_hash": hash_password(admin_pw),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pw)}})

    # Seed analyst/viewer
    for email, role, name, pw in [
        ("analyst@sentinel.mil", "analyst", "Analyst J35", "Analyst2026!"),
        ("viewer@sentinel.mil", "viewer", "Viewer J2", "Viewer2026!"),
    ]:
        if not await db.users.find_one({"email": email}):
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "email": email, "name": name, "role": role,
                "password_hash": hash_password(pw),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

    # Seed events, people, ships, orgs, locations (once)
    if await db.events.count_documents({}) == 0:
        now = datetime.now(timezone.utc)
        for i, ev in enumerate(SEED_EVENTS):
            doc = {**ev, "id": str(uuid.uuid4()), "ts": (now - timedelta(hours=i * 3)).isoformat(), "created_by": "seed"}
            await db.events.insert_one(doc)
    if await db.people.count_documents({}) == 0:
        for p in SEED_PEOPLE:
            doc = {**p, "id": str(uuid.uuid4()),
                   "phone": None, "email": None,
                   "created_at": datetime.now(timezone.utc).isoformat()}
            await db.people.insert_one(doc)
    if await db.ships.count_documents({}) == 0:
        for s in SEED_SHIPS:
            await db.ships.insert_one({**s, "id": str(uuid.uuid4())})
    if await db.organizations.count_documents({}) == 0:
        for o in SEED_ORGS:
            await db.organizations.insert_one({**o, "id": str(uuid.uuid4())})
    if await db.locations.count_documents({}) == 0:
        for l in SEED_LOCATIONS:
            await db.locations.insert_one({**l, "id": str(uuid.uuid4())})

    # Seed relationships
    if await db.relationships.count_documents({}) == 0:
        people_docs = await db.people.find({}, {"_id": 0, "id": 1, "full_name": 1}).to_list(100)
        orgs_docs = await db.organizations.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
        events_docs = await db.events.find({}, {"_id": 0, "id": 1, "title": 1}).to_list(100)
        if people_docs and orgs_docs:
            pairings = [
                ("Viktor Petrenko", "Wagner Finance", "member_of"),
                ("Colonel Hassan Rahimi", "IRGC-QF", "commander_of"),
                ("Jin Zhao", "Huawei Shadow", "operator"),
                ("Ernesto Vargas", "Tren de Aragua", "leader_of"),
            ]
            for pname, oname, rel in pairings:
                p = next((x for x in people_docs if x["full_name"] == pname), None)
                o = next((x for x in orgs_docs if x["name"] == oname), None)
                if p and o:
                    await db.relationships.insert_one({"id": str(uuid.uuid4()), "source_id": p["id"], "target_id": o["id"], "relation": rel, "strength": 80})
            for p, e in zip(people_docs[:3], events_docs[:3]):
                await db.relationships.insert_one({"id": str(uuid.uuid4()), "source_id": p["id"], "target_id": e["id"], "relation": "linked_to", "strength": 60})

    # Seed a mission
    if await db.missions.count_documents({}) == 0:
        await db.missions.insert_one({
            "id": str(uuid.uuid4()),
            "title": "2 Phase Air Evacuation - Zlarovo",
            "description": "Evacuate US Embassy personnel from Zlarovo amid ongoing coup in Tereskia. Air corridor via Ataski Air Base.",
            "status": "proposed",
            "severity": "critical",
            "assets": [
                {"type": "C-130", "qty": 2, "location": "Aarons AFB", "status": "8 FMC"},
                {"type": "Chinook", "qty": 2, "location": "McDaniels AFB", "status": "6 FMC"},
                {"type": "JLTV", "qty": 4, "location": "Aarons AFB", "status": "16 FMC"},
            ],
            "steps": [
                {"name": "Load Aircraft", "start": 0, "duration": 1.5},
                {"name": "Flight to Zlarovo", "start": 1.5, "duration": 3.0},
                {"name": "Establish Safehouse", "start": 4.5, "duration": 1.0},
                {"name": "Data Uplink", "start": 5.5, "duration": 0.5},
                {"name": "Extract & RTB", "start": 6.0, "duration": 1.5},
            ],
            "total_hours": 7.5,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "seed",
        })

    logger.info("Sentinel OSINT startup complete.")

@app.on_event("shutdown")
async def on_shutdown():
    client.close()


@api.get("/")
async def root():
    return {"service": "SENTINEL OSINT", "version": "1.0", "status": "operational"}
