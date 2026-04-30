# SENTINEL OSINT - Product Requirements Document

## Original Problem Statement
Build a full-stack, military-grade intelligence dashboard web application inspired by Palantir Gotham/Foundry systems. The system must be highly interactive, data-driven, modular, and visually identical in sophistication to advanced intelligence dashboards (dark UI, glowing data layers, real-time feeds, map overlays, and mission control panels).

## Architecture
- **Frontend**: React 19, Tailwind, shadcn/ui, react-globe.gl (Three.js), react-force-graph-2d, recharts, framer-motion, react-fast-marquee, lucide-react, Rajdhani / IBM Plex Sans / JetBrains Mono fonts
- **Backend**: FastAPI + Motor (async MongoDB), JWT (PyJWT + bcrypt), httpx (OpenSky proxy), PyPDF2 + openpyxl (file ingestion), emergentintegrations (Claude Sonnet 4.5)
- **Database**: MongoDB with collections: users, audit_logs, events, people, organizations, locations, ships, relationships, missions, documents
- **External APIs**: OpenSky Network (real aircraft states), Claude Sonnet 4.5 via Emergent Universal LLM Key

## User Personas
- **Admin (Command)**: Full CRUD on all collections + audit log access
- **Analyst**: Can create/update events, people, missions, upload files, link graph
- **Viewer**: Read-only access to all dashboards, no mutations

## Core Requirements (from problem statement)
1. Global war/event tracking on 3D globe with heatmaps, markers, timeline
2. Aircraft (OpenSky) + ship (AIS simulated) tracking with routes/speed/altitude
3. OSINT on people: search, profiles, risk scoring, relationship graph
4. File ingestion (PDF/Excel/CSV) with OCR/NER entity extraction + auto-link
5. Relationship graph engine (people↔org↔location↔event) with analytics
6. Analytics dashboard (KPIs, time-series, AI insights)
7. Mission control / scenario simulation with Gantt timeline
8. Advanced search (semantic NL query + structured filters)
9. Role-based security (admin/analyst/viewer) + audit logs

## Implemented (v1.0 - 2026-04-30)
- JWT auth with bcrypt password hashing + role-based gates
- Seeded admin/analyst/viewer + 12 world events + 8 POIs + 8 ships + orgs + locations + 1 mission + relationships
- Palantir Gotham-style dark HUD: classified banner, left rail, 3D globe centerpiece, COA panel, Gantt timeline, live ticker
- All 8 modules wired: Dashboard, Tracking, OSINT, Graph, Ingest, Analytics, Mission, Search + Audit
- Real OpenSky proxy with 15s cache + simulated fallback on empty/error
- Claude Sonnet 4.5 entity extraction on file uploads
- Claude Sonnet 4.5 NL query parsing + AI threat insights
- 25/25 backend API tests pass; all frontend pages verified

## Credentials (see /app/memory/test_credentials.md)
- admin@sentinel.mil / Sentinel2026!
- analyst@sentinel.mil / Analyst2026!
- viewer@sentinel.mil / Viewer2026!

## Prioritized Backlog (P0 → P2)
### P0 (next)
- Real-time WebSocket push for new events (currently poll-based)
- Neo4j-backed graph centrality + anomaly detection
- Elasticsearch index for true semantic search

### P1
- Mapbox/Deck.gl 2D map toggle with satellite overlay
- Rate limiting + brute-force lockout on auth (playbook recommends 5/15min)
- Split server.py into routers (auth/events/osint/graph/missions/analytics/files/ai)
- Unique index on relationships (source_id, target_id, relation)
- Predictive route projection for aircraft/ships
- Alert/notification system with toasts

### P2
- Facial recognition on uploaded images
- Dark web monitoring mock integration
- Kafka event streaming
- Dockerized microservices split

## Next Action Items
- Gather user feedback on look-and-feel vs. reference screenshot
- Prioritize P0 backlog based on user's next request
