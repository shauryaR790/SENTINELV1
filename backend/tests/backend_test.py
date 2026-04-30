"""SENTINEL OSINT Backend Tests - comprehensive API testing."""
import os
import io
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://global-sentinel-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@sentinel.mil", "password": "Sentinel2026!"}
ANALYST = {"email": "analyst@sentinel.mil", "password": "Analyst2026!"}
VIEWER = {"email": "viewer@sentinel.mil", "password": "Viewer2026!"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and "user" in data
    return data["access_token"], data["user"]


@pytest.fixture(scope="session")
def admin_token():
    tok, _ = _login(ADMIN)
    return tok


@pytest.fixture(scope="session")
def analyst_token():
    tok, _ = _login(ANALYST)
    return tok


@pytest.fixture(scope="session")
def viewer_token():
    tok, _ = _login(VIEWER)
    return tok


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# -------- Auth --------
class TestAuth:
    def test_login_admin(self):
        tok, user = _login(ADMIN)
        assert user["role"] == "admin"
        assert user["email"] == ADMIN["email"]
        assert isinstance(tok, str) and len(tok) > 20

    def test_login_bad_creds(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@sentinel.mil", "password": "WRONG"}, timeout=15)
        assert r.status_code == 401

    def test_me_no_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_with_auth(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN["email"]
        assert data["role"] == "admin"


# -------- Events --------
class TestEvents:
    def test_list_events_seeded(self, admin_token):
        r = requests.get(f"{API}/events", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 12
        sample = items[0]
        for k in ("severity", "category", "lat", "lng", "title", "id"):
            assert k in sample, f"missing {k}"

    def test_viewer_cannot_create_event(self, viewer_token):
        payload = {"title": "TEST_forbid", "description": "x", "lat": 1, "lng": 1}
        r = requests.post(f"{API}/events", json=payload, headers=_h(viewer_token), timeout=15)
        assert r.status_code == 403

    def test_analyst_create_event_and_list(self, analyst_token):
        payload = {"title": "TEST_AnalystEvent", "description": "test", "lat": 10.0, "lng": 20.0, "severity": "high", "category": "cyber", "country": "TestLand"}
        r = requests.post(f"{API}/events", json=payload, headers=_h(analyst_token), timeout=15)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["title"] == "TEST_AnalystEvent"
        assert "id" in created

        r2 = requests.get(f"{API}/events", headers=_h(analyst_token), timeout=15)
        assert r2.status_code == 200
        ids = [e["id"] for e in r2.json()]
        assert created["id"] in ids


# -------- OSINT People --------
class TestOSINT:
    def test_list_people_seeded_sorted(self, admin_token):
        r = requests.get(f"{API}/osint/people", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 8
        scores = [p.get("risk_score", 0) for p in items]
        assert scores == sorted(scores, reverse=True), "Not sorted desc by risk_score"

    def test_filter_people_by_q(self, admin_token):
        r = requests.get(f"{API}/osint/people", headers=_h(admin_token), params={"q": "Viktor"}, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        assert any("Viktor" in p["full_name"] for p in items)

    def test_get_person_with_rels(self, admin_token):
        r = requests.get(f"{API}/osint/people", headers=_h(admin_token), timeout=15)
        pid = r.json()[0]["id"]
        r2 = requests.get(f"{API}/osint/people/{pid}", headers=_h(admin_token), timeout=15)
        assert r2.status_code == 200
        data = r2.json()
        assert "person" in data and "relationships" in data
        assert data["person"]["id"] == pid

    def test_analyst_create_person(self, analyst_token):
        payload = {"full_name": "TEST_PersonA", "aliases": ["alpha"], "risk_score": 55, "tags": ["test"]}
        r = requests.post(f"{API}/osint/people", json=payload, headers=_h(analyst_token), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["full_name"] == "TEST_PersonA"


# -------- Graph --------
class TestGraph:
    def test_graph_nodes_and_links(self, admin_token):
        r = requests.get(f"{API}/graph", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "nodes" in data and "links" in data
        types = {n["type"] for n in data["nodes"]}
        # at minimum we expect people, events, organizations, locations
        assert "person" in types
        assert "event" in types
        assert len(data["links"]) >= 1

    def test_create_link(self, analyst_token):
        # Fetch two people
        r = requests.get(f"{API}/osint/people", headers=_h(analyst_token), timeout=15)
        people = r.json()
        assert len(people) >= 2
        payload = {"source_id": people[0]["id"], "target_id": people[1]["id"], "relation": "TEST_knows", "strength": 60}
        r2 = requests.post(f"{API}/graph/link", json=payload, headers=_h(analyst_token), timeout=15)
        assert r2.status_code == 200
        assert r2.json()["relation"] == "TEST_knows"


# -------- Missions --------
class TestMissions:
    def test_list_missions(self, admin_token):
        r = requests.get(f"{API}/missions", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1

    def test_create_mission(self, analyst_token):
        payload = {"title": "TEST_Mission", "description": "x", "status": "proposed", "severity": "medium", "assets": [], "steps": [{"name": "a", "start": 0, "duration": 1}], "total_hours": 1.0}
        r = requests.post(f"{API}/missions", json=payload, headers=_h(analyst_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_Mission"


# -------- Analytics --------
class TestAnalytics:
    def test_kpis(self, admin_token):
        r = requests.get(f"{API}/analytics/kpis", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200
        data = r.json()
        for k in ("active_threats", "people_tracked", "high_risk_people", "active_missions", "instability_index", "regions", "timeseries"):
            assert k in data, f"missing {k}"
        assert isinstance(data["regions"], list)
        assert isinstance(data["timeseries"], list)
        assert len(data["timeseries"]) == 14


# -------- Search --------
class TestSearch:
    def test_search_buckets(self, admin_token):
        r = requests.get(f"{API}/search", headers=_h(admin_token), params={"q": "Ukraine"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        for k in ("events", "people", "missions"):
            assert k in data


# -------- Tracking --------
class TestTracking:
    def test_aircraft_live(self, admin_token):
        r = requests.get(f"{API}/aircraft/live", headers=_h(admin_token), timeout=25)
        assert r.status_code == 200
        data = r.json()
        assert "count" in data and "aircraft" in data
        if data["count"] > 0:
            a = data["aircraft"][0]
            assert "lat" in a and "lng" in a and "callsign" in a

    def test_ships_live(self, admin_token):
        r = requests.get(f"{API}/ships/live", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "count" in data and "ships" in data
        assert data["count"] >= 8


# -------- Files (AI extraction) --------
class TestFiles:
    def test_upload_csv_as_analyst(self, analyst_token):
        csv_bytes = b"name,role,country\nJane Operative,Field Agent,Ukraine\nAcme Corp,Supplier,USA\n"
        files = {"file": ("test_sample.csv", io.BytesIO(csv_bytes), "text/csv")}
        data = {"classification": "public", "tags": "test,osint"}
        r = requests.post(f"{API}/files/upload", files=files, data=data, headers=_h(analyst_token), timeout=90)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["name"] == "test_sample.csv"
        assert "entities" in doc
        for k in ("persons", "organizations", "locations", "summary"):
            assert k in doc["entities"]

    def test_list_files(self, admin_token):
        r = requests.get(f"{API}/files", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# -------- AI insights / NL query --------
class TestAI:
    def test_insights(self, admin_token):
        r = requests.get(f"{API}/ai/insights", headers=_h(admin_token), timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert "insights" in data
        assert isinstance(data["insights"], list)
        assert len(data["insights"]) >= 1

    def test_nl_query(self, admin_token):
        r = requests.post(f"{API}/ai/nl-query", json={"query": "critical events in Ukraine"}, headers=_h(admin_token), timeout=60)
        assert r.status_code == 200
        data = r.json()
        for k in ("filter", "events", "count"):
            assert k in data


# -------- Audit --------
class TestAudit:
    def test_audit_as_admin(self, admin_token):
        r = requests.get(f"{API}/audit", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_audit_as_viewer_forbidden(self, viewer_token):
        r = requests.get(f"{API}/audit", headers=_h(viewer_token), timeout=15)
        assert r.status_code == 403
