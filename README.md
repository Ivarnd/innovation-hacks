# AntonRx — Drug Policy Intelligence Platform

> Innovation Hacks 2.0 · April 3–5, 2026 · Arizona State University
> Sponsor track: AntonRx

AntonRx is an AI-powered platform that ingests insurance policy PDFs, extracts structured coverage data, and lets analysts compare payers, ask plain-language questions, and track policy changes — in seconds instead of hours.

---

## Quick Start

### Terminal 1 — Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Terminal 2 — Frontend
```bash
cd frontend
npm install
npm run dev
```

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

---

## Environment Setup

### `backend/.env`
```
ANTHROPIC_API_KEY=your_key_here
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
FRONTEND_URL=http://localhost:5173
```

### `frontend/.env`
```
VITE_GOOGLE_CLIENT_ID=        # optional — leave empty to disable Google login
VITE_GITHUB_CLIENT_ID=your_github_client_id
FRONTEND_URL=http://localhost:5173
```

> A **Demo login** is available on the landing page — no OAuth setup required for local testing.

---

## Pre-populate Data (Demo Prep)

Run once before the demo to extract all bundled PDFs:
```bash
cd backend
python extract_all.py
```

This pre-fills `backend/data/` with structured JSON so the Compare tab loads instantly.

---

## Project Structure

```
innovation-hacks/
├── backend/
│   ├── pdfs/              # Source policy PDFs
│   ├── data/              # Extracted policy JSON files (payer_drug_date.json)
│   ├── main.py            # FastAPI app — all API endpoints
│   ├── extractor.py       # PDF → Claude → structured JSON
│   ├── comparator.py      # Multi-payer comparison logic
│   ├── qa.py              # Q&A with prompt caching
│   ├── diff.py            # Policy change detection
│   ├── extract_all.py     # Batch extraction script
│   ├── .env               # API keys (not committed)
│   └── requirements.txt
└── frontend/
    ├── public/
    │   └── logo.png
    ├── src/
    │   ├── components/
    │   │   ├── DrugAutocomplete.jsx
    │   │   ├── PayerAutocomplete.jsx
    │   │   └── TextScramble.jsx
    │   ├── App.jsx         # Main app + landing page
    │   ├── App.css         # Full design system
    │   └── main.jsx
    ├── .env
    └── vite.config.js      # Proxy: /api/* → localhost:8000
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + Framer Motion |
| Backend | Python 3 + FastAPI |
| AI Model | Anthropic Claude (`claude-sonnet-4-6`) |
| Auth | GitHub OAuth + Google OAuth + Demo mode |
| Storage | JSON files in `backend/data/` |
| PDF handling | Claude native PDF (base64) with 20-page chunking |
| Prompt caching | Anthropic ephemeral caching on `/ask` (~90% cost reduction) |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/extract` | Upload PDF → Claude extracts structured JSON → saved to `data/` |
| GET | `/compare?drug=Bevacizumab` | Latest policy per payer for a given drug |
| POST | `/ask` | Plain-language Q&A with prompt caching |
| GET | `/changes?payer=bcbs&drug=bevacizumab` | Diff two policy snapshots |
| GET | `/policies` | List all extracted JSON files in `data/` |
| GET | `/payers` | List all known payers (name + slug) |
| GET | `/health` | Server status |

### POST /ask — Request Body
```json
{
  "question": "Which payer requires step therapy for Bevacizumab?",
  "drug": "bevacizumab"
}
```

---

## Features

- **Compare** — Side-by-side payer table: prior auth, step therapy, preferred status, indications, site of care
- **Ask** — Natural language Q&A across all policy documents, with source citations and table rendering
- **Changes** — Diff two policy snapshots; changes classified as significant (red) or cosmetic (gray)
- **Upload** — Drag-and-drop PDF extraction; structured JSON returned instantly
- **Policies** — Browse all extracted policy files in the data store

---

## Demo Drug & Payers

| Payer | Drug | Snapshots |
|-------|------|-----------|
| BCBS North Carolina | Bevacizumab (Avastin) | Jan 2025, Jan 2026 |
| Florida Blue | Bevacizumab (Avastin) | Jan 2026 |

**Change tracking demo:** BCBS NC 2025 → 2026 — Avastin demoted from preferred to non-preferred, step therapy added, biosimilar requirements introduced.

---

## Notes

- Large PDFs are automatically split into 20-page chunks to stay within API limits
- `/compare` always returns the latest snapshot per payer; older snapshots are retained for diff
- Prompt caching on `/ask` dramatically reduces cost for repeated questions on the same policy set
