---
title: "FoodGrid Boston"
tags: ["React", "TypeScript", "Django", "Node.js", "MongoDB", "Ollama", "Civic Tech", "GeoAI"]
---

A full-stack civic tech platform that maps food access inequality across Boston's census tracts, helps residents find nearby food resources, and gives city analysts a simulation tool for planning policy interventions.

Built for EcoHack / Civic Hacks 2025.

![WhatsApp Image 2026-02-22 at 10 21 45 AM](https://github.com/user-attachments/assets/e7d16f47-231e-48fa-9648-cbcaef52935b)

![WhatsApp Image 2026-02-22 at 4 19 20 AM](https://github.com/user-attachments/assets/4d74a2a7-a679-4b14-b1eb-625d98069dff)


---

## What It Does

**Resident Mode** — A resident opens the map, sees every food pantry, grocery store, farmers market, and mobile food truck near them. They can ask the AI chatbot questions about SNAP benefits, transit routes, or food programs — in English, Spanish, Chinese, Portuguese, or French.

**Government Mode** — A city analyst sees each census tract color-coded by food risk score. Hovering any tract shows live metrics (food insecurity rate, SNAP rate, poverty rate, transit coverage, equity score) in the sidebar. Clicking locks the selection and opens a simulation panel: "What happens to this tract's food risk score if we add a pantry here?"

---

## Architecture — Three Servers

```
npm run dev:full
     │
     ├── Vite (React + TypeScript)  → http://localhost:5173   ← browser UI
     ├── Django (Python)            → http://localhost:8000   ← data API
     └── Node.js (Chatbot)         → http://localhost:3001   ← AI chat
```

---

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 18+ | Frontend + chatbot server |
| Python | 3.11+ | Django backend |
| Ollama | any | Local LLM runner |
| MongoDB Atlas | free tier | Cloud database |

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url>
cd Foodgrid
npm install
```

### 2. Set up the Python backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# Mac/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Configure backend environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
SECRET_KEY=your-django-secret-key
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/
MONGODB_DB_NAME=foodgrid
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173
DEBUG=true
```

### 4. Configure chatbot environment

```bash
# already exists — verify contents
cat chatbot/.env
```

Should contain:

```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
MODEL=llama3.1:8b
PORT=3001
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
DATA_DIR=./src/data/policymap
```

### 5. Pull the AI model

```bash
ollama pull llama3.1:8b
```

This downloads ~4.9 GB. Only needs to be done once.

### 6. Seed the database

**Fast path (mock data — 10 tracts, 15 resources):**

```bash
cd backend
python scripts/seed_mock_data.py
```

**Full real data (recommended):**

```bash
cd backend
python manage.py ingest_tracts
python manage.py ingest_resources --geocode
```

This reads the PolicyMap CSV files and geocodes 578+ food store addresses using OpenStreetMap. The geocoding step takes several minutes.

### 7. Run everything

```bash
# From the root Foodgrid/ directory
npm run dev:full
```

This starts all three servers simultaneously with color-coded output:
- Blue → Django API (port 8000)
- Green → Vite frontend (port 5173)
- Magenta → Node.js chatbot (port 3001)

Then open **http://localhost:5173** in your browser.

---

## Individual Start Commands

```bash
# Frontend only
npm run dev

# Backend only
cd backend && python manage.py runserver 8000

# Chatbot only
npm run chatbot

# All three together
npm run dev:full
```

---

## Project Structure

```
Foodgrid/
├── src/                          # React + TypeScript frontend
│   ├── App.tsx                   # Root component, mode switching
│   ├── main.tsx                  # Entry point (StrictMode intentionally removed)
│   ├── api/
│   │   └── hooks.ts              # React Query hooks for Django API calls
│   ├── components/
│   │   ├── Map/
│   │   │   ├── MapView.tsx       # DeckGL + MapLibre integration, all map layers
│   │   │   ├── useMapInteraction.ts  # Hover/click via queryRenderedFeatures
│   │   │   ├── layers.ts         # MapLibre layer style specs + paint expressions
│   │   │   ├── LayerTogglePanel.tsx  # Show/hide stores and MBTA T stops
│   │   │   ├── ResourceTooltip.tsx   # Popup on food store hover
│   │   │   └── TractInfoPanel.tsx    # (metrics shown in sidebar now)
│   │   ├── GovernmentMode/
│   │   │   ├── GovernmentSidebar.tsx # Live tract metrics, charts, simulation
│   │   │   └── CityStatsBar.tsx      # City-wide averages top bar
│   │   ├── ResidentMode/
│   │   │   └── ResidentSidebar.tsx   # Nearby resources, SNAP info
│   │   ├── ChatBot/
│   │   │   └── ChatPanel.tsx     # Sliding AI chat UI with language selector
│   │   ├── Header/               # Top navigation + mode toggle
│   │   └── ApiErrorBanner.tsx    # Shows when Django API is unreachable
│   ├── store/
│   │   └── useMapStore.ts        # Zustand global state (mode, hover, selection)
│   ├── types/
│   │   ├── map.ts                # TractProperties, TractFeature types
│   │   └── resources.ts          # FoodResource, ResourceType types
│   └── data/
│       ├── censusTracts.ts       # Static GeoJSON for tract boundaries
│       ├── countyBoundary.ts     # Suffolk County boundary outline
│       ├── mbta_stops.json       # MBTA T stop coordinates
│       └── storeHierarchy.ts     # Store type → display color/size mapping
│
├── backend/                      # Django + Python API
│   ├── config/                   # Django settings, root URLs, WSGI
│   ├── core/
│   │   ├── db.py                 # pymongo singleton (MongoDB Atlas connection)
│   │   ├── transit.py            # MBTA transit coverage scoring
│   │   └── store_hierarchy.py    # Store type classification
│   ├── tracts/
│   │   ├── views.py              # GeoJSON tract list, stats, single tract detail
│   │   ├── serializers.py        # Tract serialization
│   │   ├── scoring.py            # Food Risk Score formula (pure functions)
│   │   └── urls.py
│   ├── resources/
│   │   ├── views.py              # Food resource list with filters
│   │   ├── serializers.py
│   │   ├── filters.py            # type, snap, free, open_now, proximity filters
│   │   └── urls.py
│   ├── simulation/
│   │   ├── views.py              # Simulation API endpoint
│   │   ├── engine.py             # Before/after score recalculation
│   │   └── urls.py
│   ├── ingestion/
│   │   └── management/commands/
│   │       ├── ingest_tracts.py        # PolicyMap CSV → MongoDB census_tracts
│   │       ├── ingest_resources.py     # Food stores → MongoDB food_resources
│   │       ├── ingest_acs.py           # ACS demographic data ingestion
│   │       ├── ingest_datasets.py      # Bulk dataset ingestion
│   │       └── ingest_grocery_dataset.py
│   ├── scripts/
│   │   └── seed_mock_data.py     # Fast dev seed (10 tracts, 15 resources)
│   ├── PolicyMap Data/           # Raw CSV exports from PolicyMap
│   └── tl_2023_25_tract/         # Census Bureau shapefiles (tract boundaries)
│
├── chatbot/
│   └──
│       ├── src/
│       │   ├── server.js         # Express entry point (port 3001)
│       │   ├── app.js            # CORS, helmet, morgan, /health, /chat routes
│       │   ├── routes/
│       │   │   └── chat.js       # Request validation, intent routing, LLM calls
│       │   ├── llm/
│       │   │   └── ollamaClient.js  # Ollama API client (llama3.1:8b)
│       │   ├── tools/
│       │   │   └── policymapTools.js  # CSV reader, metric lookup, topK, summarize
│       │   └── data/policymap/   # PolicyMap CSVs for chatbot data queries
│       ├── .env                  # Ollama config (not committed)
│       └── package.json
│
├── public/
│   ├── vite.svg                  # FoodGrid favicon
│   └── mbta_stops.json           # MBTA stop data for map layer
│
├── package.json                  # Root scripts (dev, dev:full, chatbot, build)
├── vite.config.ts                # Vite + proxy /api → :8000
├── tailwind.config.js
└── tsconfig.json
```

---

## Frontend Stack

| Library | Version | Used For |
|---|---|---|
| React | 18 | UI component framework |
| TypeScript | 5.5 | Type safety across all components |
| Vite | 5.4 | Dev server and production bundler |
| Tailwind CSS | 3.4 | All styling — utility classes |
| Zustand | 5 | Global state (mode, hover tract, resources) |
| react-map-gl | 7.1 | MapLibre bindings for React |
| MapLibre GL | 4.7 | Vector map rendering, feature-state |
| deck.gl | 9.1 | WebGL ScatterplotLayers for store dots |
| Framer Motion | 11 | Sidebar animations, animated metric bars |
| Recharts | 2.12 | Bar charts in Government sidebar |
| @tanstack/react-query | 5 | Data fetching from Django API |
| Lucide React | 0.462 | Icons |
| Radix UI | various | Tabs, sliders, tooltips |

### Map Architecture

The map uses three libraries in a specific nesting order:

```
DeckGL (deck.gl)                  ← outermost canvas, intercepts all mouse events
  └── MapGL (react-map-gl)        ← renders base map + census tract shapes
        ├── Source: tracts         ← GeoJSON with numeric feature IDs
        │     ├── Layer: fill      ← colored by food risk score
        │     └── Layer: border    ← glows on hover/selection via feature-state
  ├── ScatterplotLayer             ← food store dots (orange/green/yellow)
  └── ScatterplotLayer             ← MBTA T stop dots (blue)
```

**Key detail:** DeckGL intercepts all DOM pointer events. MapLibre's built-in `onMouseMove`/`onClick` do not fire in this architecture. Hover and click are wired through DeckGL's `onHover(x, y)` and `onClick(x, y)`, then `map.queryRenderedFeatures([x, y])` identifies which tract is under the cursor.

**Feature-state** is used for hover/selection effects — `map.setFeatureState(tractId, { hover: true })` updates MapLibre's internal WebGL state directly, with zero React re-renders. Paint expressions on the border layer read this state live.

**React StrictMode is intentionally disabled** in `main.tsx`. deck.gl v9's WebGL context does not survive StrictMode's double-mount development cycle.

---

## Backend Stack

| Library | Version | Used For |
|---|---|---|
| Django | 5.1 | Web framework, URL routing, views |
| Django REST Framework | 3.15 | JSON API serialization |
| django-cors-headers | 4 | Allow frontend (port 5173) to call API (port 8000) |
| pymongo | 4 | Direct MongoDB Atlas driver |
| motor | 3 | Async MongoDB driver (reserved for future use) |
| pandas | 2 | Reading and processing PolicyMap CSVs |
| numpy | 2 | Score normalization math |
| shapely | 2 | Geometric operations |
| pydantic | 2 | Request data validation |
| geopy | 2 | Geocoding addresses via OpenStreetMap (no API key) |
| pyshp + pyproj | 3 | Shapefile → GeoJSON conversion (no GDAL required) |
| python-dotenv | 1 | .env config loading |

### Why No Django ORM

Django's ORM is designed for PostgreSQL/SQLite. MongoDB doesn't fit the relational model. Compatibility layers (Djongo, MongoEngine) are buggy with Django 5. The solution:

```python
# backend/config/settings.py
DATABASES = {}   # ORM completely disabled
```

All database access goes through `backend/core/db.py` — a pymongo singleton that connects to MongoDB Atlas via `mongodb+srv://` URI.

### Food Risk Score Formula

Defined in `backend/tracts/scoring.py` — pure functions, no I/O, unit-testable in isolation.

```
FoodRiskScore = 0.4 × need_score
              + 0.3 × (1 − supply_score)
              + 0.2 × (1 − transit_score)
              + 0.1 × vulnerability_index
```

| Component | Weight | Meaning |
|---|---|---|
| `need_score` | 40% | Food insecurity composite — lower income = more need |
| `supply_score` | 30% | Food resource density — inverted (high supply = lower risk) |
| `transit_score` | 20% | MBTA-accessible coverage — inverted (poor transit = higher risk) |
| `vulnerability_index` | 10% | Poverty rate + SNAP uptake + language barriers + elderly share |

All inputs normalized to [0.0, 1.0]. Output of 1.0 = worst possible food access.

### API Endpoints

```
GET  /api/health/
     → { "status": "ok", "db": "connected" }

GET  /api/v1/tracts/
     → GeoJSON FeatureCollection of all census tracts with scores

GET  /api/v1/tracts/stats/
     → { equity_score, transit_coverage, high_risk_tracts, total_tracts }

GET  /api/v1/tracts/<tract_id>/
     → { tract, resources: [...], ai_explanation: "..." }

GET  /api/v1/resources/
     ?type=pantry|grocery|market|mobile
     ?snap=true|false
     ?free=true|false
     ?lat=42.36&lng=-71.06&max_minutes=30
     ?tract_id=25025010100
     → { count: int, results: [...] }

POST /api/v1/simulation/run/
     Body: { "tract_id": "25025010100", "interventions": ["add_pantry"] }
     → { before: {...}, after: {...}, delta: {...}, households_reached: int }
```

### Simulation Interventions

| Intervention | Effect on Food Risk Score |
|---|---|
| `add_pantry` | −0.08 × (1 − supply_score); equity +0.04 |
| `add_mobile` | −0.05 × (1 − transit_score); transit +0.06 |
| `extend_hours` | −0.03 flat; equity +0.02 |

---

## Chatbot Stack

| Library | Version | Used For |
|---|---|---|
| Express | 4.19 | HTTP server |
| cors | 2.8 | Cross-origin requests from frontend |
| helmet | 7.1 | Security headers |
| morgan | 1.10 | HTTP request logging |
| zod | 3.23 | Request schema validation |
| csv-parse | 6.1 | Reading PolicyMap CSV files |
| dotenv | 16.4 | .env config loading |
| Ollama | external | Local LLM runner |
| llama3.1:8b | 4.9 GB | Meta's open-source language model |

### How the Chatbot Works

```
User types in ChatPanel.tsx
    → POST http://localhost:3001/chat
        { message: "...", history: [...], language: "es" }
    → chat.js validates with zod

    ── Intent routing ─────────────────────────────────────────
    If message contains geoid + metric keyword:
        → policymapTools.js looks up exact value from CSV
        → returns precise data (optionally reformatted in target language)

    If message says "list metrics":
        → returns all available PolicyMap data fields

    Otherwise:
        → ollamaClient.js calls http://localhost:11434/api/chat
            { model: "llama3.1:8b", messages: [...], stream: false }
        → llama3.1 generates a response locally on your machine
    ───────────────────────────────────────────────────────────

    → { reply: "..." }
    → ChatPanel.tsx renders as assistant bubble
```

### Language Support

The chat panel supports: **EN / ES / ZH / PT / FR**

When a non-English language is selected, the system prompt instructs the model to respond in that language. For direct data queries, the data values are reformatted in the target language via the LLM.

### Why Local AI (Ollama) Instead of an API

- No per-token cost
- No API key to manage or leak
- Resident questions about food access stay on the local machine — not sent to any external server
- Works fully offline
- `llama3.1:8b` performs well for food/social services Q&A

---

## Data Sources

| Dataset | Source | Records |
|---|---|---|
| Census tract boundaries | Census Bureau TIGER/Line 2023 shapefiles | ~200 tracts (Suffolk County) |
| Median Household Income | ACS 5-year via PolicyMap | Per tract |
| Low Income + Low Access flag | USDA LILA via PolicyMap | Per tract |
| Average Food Spending | PolicyMap / BLS | Per tract |
| Population Density | ACS 5-year via PolicyMap | Per tract |
| Income % of AMI | ACS / HUD via PolicyMap | Per tract |
| Food Store Locations | USDA via PolicyMap | 578 stores |
| Farmers Markets | USDA via PolicyMap | Multiple locations |
| MBTA T Stops | MBTA | All rapid transit stops |

### PolicyMap CSV Format

PolicyMap exports have a 2-row header:
- Row 0: Human-readable column names ("Median Household Income")
- Row 1: Technical field names (`mhhinc`, `GeoID`, `rpopden`)

Read correctly with:

```python
pd.read_csv(path, skiprows=[0], header=0, dtype=str)
```

GeoID format: 11-digit FIPS code (`25025XXXXXX` for Suffolk County, MA).

---

## MongoDB Collections

### `census_tracts`

```json
{
  "tract_id":             "25025010100",
  "tract_name":           "Roxbury",
  "food_risk_score":      0.88,
  "equity_score":         0.31,
  "transit_coverage":     0.62,
  "food_insecurity_rate": 0.29,
  "poverty_rate":         0.34,
  "snap_rate":            0.41,
  "snap_households":      1842,
  "population":           28400
}
```

### `food_resources`

```json
{
  "resource_id":   "dudley-farmers-market-310624",
  "name":          "Dudley Farmers Market",
  "type":          "market",
  "address":       "427 Dudley St, Boston, MA 02119",
  "coordinates":   [-71.0832, 42.3277],
  "snap":          true,
  "free":          false,
  "tract_id":      "25025010100"
}
```

### `city_stats`

```json
{
  "_type":            "city_stats",
  "equity_score":     0.52,
  "transit_coverage": 0.70,
  "high_risk_tracts": 4,
  "total_tracts":     10
}
```

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `SECRET_KEY` | Yes | — | Django secret key |
| `MONGODB_URI` | Yes | — | `mongodb+srv://...` or `mongodb://localhost:27017` |
| `MONGODB_DB_NAME` | Yes | — | e.g. `foodgrid` |
| `DJANGO_ALLOWED_HOSTS` | No | `localhost,127.0.0.1` | Comma-separated |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:5173` | Frontend origin |
| `DEBUG` | No | `false` | `true` in development |

### Chatbot (`chatbot/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `OLLAMA_URL` | No | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | No | `llama3.1:8b` | Model to use |
| `PORT` | No | `3001` | Chatbot server port |
| `ALLOWED_ORIGINS` | No | `http://localhost:5173` | CORS origins |
| `DATA_DIR` | No | `./src/data/policymap` | Path to PolicyMap CSVs |

---

## Known Architectural Decisions

**React StrictMode disabled** — deck.gl v9 creates a WebGL GPU context that doesn't survive StrictMode's double-mount cycle in development. Removing StrictMode is the correct fix, not a workaround.

**No Django ORM** — `DATABASES = {}` in settings. All DB access via pymongo directly through `core/db.py`. Cleaner than Djongo/MongoEngine compatibility layers.

**DeckGL wraps MapLibre, not the other way** — DeckGL sits on top to render WebGL data layers (store dots). The tradeoff is that DeckGL intercepts all DOM events, requiring `queryRenderedFeatures` for tract hover/click instead of MapLibre's native event handlers.

**Feature-state for hover effects** — hover border animation runs entirely inside MapLibre's WebGL pipeline. Zero React state updates on mouse move.

**generateId={false} on GeoJSON Source** — uses each GeoJSON feature's own numeric `id` field for feature-state targeting. If set to `true`, MapLibre generates its own IDs and `setFeatureState` calls with the original IDs silently fail.

---

## Challenges Solved

| Challenge | Solution |
|---|---|
| deck.gl intercepts MapLibre mouse events | Routed all hover/click through DeckGL's `onHover`/`onClick` + `queryRenderedFeatures([x,y])` |
| WebGL `maxTextureDimension2D` crash | Removed React StrictMode + added ResizeObserver container guard |
| GDAL won't install on Windows | Replaced with pure-Python `pyshp` + `pyproj` |
| PolicyMap double-header CSV format | `pd.read_csv(skiprows=[0], header=0)` |
| Django ORM incompatible with MongoDB | Disabled ORM entirely, used pymongo directly |
| Chatbot request schema mismatch | Rewrote server schema to match `{ message, history, language }` frontend format |
| 60fps React re-renders on hover | MapLibre feature-state — bypasses React entirely |
| API key leaking via .env | Switched to local Ollama — no external API keys needed |

---

## Scripts Reference

```bash
# From root Foodgrid/ directory

npm run dev              # Start Vite dev server only (port 5173)
npm run build            # TypeScript compile + Vite production build
npm run chatbot          # Start chatbot server only (port 3001)
npm run dev:full         # Start all three servers together

# From backend/ directory (with .venv activated)

python manage.py runserver 8000          # Start Django API
python scripts/seed_mock_data.py         # Seed 10 tracts + 15 resources (fast)
python manage.py ingest_tracts           # Ingest real PolicyMap tract data
python manage.py ingest_resources        # Ingest food stores (no geocoding)
python manage.py ingest_resources --geocode  # Ingest + geocode addresses
python manage.py ingest_acs              # Ingest ACS demographic data
python manage.py check                   # Verify Django config is valid

# Ollama

ollama pull llama3.1:8b   # Download AI model (one-time, ~4.9 GB)
ollama list               # List installed models
ollama serve              # Start Ollama if it isn't running
```

---

## Team
Sanjiv, Jigar, Aum, Tarushi
Built at EcoHack / Civic Hacks 2025 — a food access mapping tool for the City of Boston.
