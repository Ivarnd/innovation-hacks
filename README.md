# AntonRx — AI-Powered Drug Policy Intelligence

> Innovation Hacks 2.0 · April 3–5, 2026 · Arizona State University
> Sponsor track: AntonRx

An AI tool that ingests insurance policy PDFs, extracts structured coverage data, and lets analysts compare payers and ask plain-language questions — in seconds instead of hours.

---

## To run

### Terminal 1 — backend
cd backend
uvicorn main:app --reload --port 8000

### Terminal 2 — frontend
cd frontend
npm install && npm run dev

---

## Project structure

```
innovation-hacks/
├── backend/
│   ├── pdfs/              # Source policy PDFs
│   ├── data/              # Extracted policy JSON files (payer_drug_date.json)
│   ├── main.py            # FastAPI app — /extract, /compare, /ask, /changes, /health
│   ├── extract_all.py     # Batch extraction script (run once before demo)
│   ├── .env               # ANTHROPIC_API_KEY (not committed)
│   └── requirements.txt   # Python dependencies
└── frontend/
    ├── public/
    ├── src/
    │   ├── App.jsx
    │   ├── App.css
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    └── vite.config.js
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite |
| Backend | Python + FastAPI |
| AI | Anthropic Claude (`claude-sonnet-4-6`) |
| Storage | JSON files in `backend/data/` |
| PDF handling | Claude native PDF (base64) with page chunking |
| Caching | Anthropic prompt caching (ephemeral) |

---

## Setup

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Add your API key to `backend/.env`:
```
ANTHROPIC_API_KEY=your_key_here
```

Pre-populate the data folder (run once before demo):
```bash
python extract_all.py
```

Start the server:
```bash
uvicorn main:app --reload
```

API runs at `http://localhost:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`

---

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/extract` | Upload PDF → Claude → structured JSON saved to `data/` |
| GET | `/compare?drug=Bevacizumab` | Latest policy per payer for a given drug |
| POST | `/ask` | Plain-language Q&A with prompt caching |
| GET | `/changes?payer=bcbs&drug=bevacizumab` | Diff two policy snapshots (Phase 2) |
| GET | `/health` | Server status — PDF and policy counts |

### POST /ask — request body
```json
{
  "question": "Which payer requires step therapy for Bevacizumab?",
  "drug": "bevacizumab",
  "payers": ["Blue Cross Blue Shield of North Carolina"]
}
```
`payers` is optional — omit to search all payers.

---

## Demo drug & payers

- **Drug:** Bevacizumab (Avastin)
- **Payers:** BCBS NC (Jan 2025 + Jan 2026 snapshots), Florida Blue (Jan 2026)
- **Change tracking demo:** BCBS NC 2025 → 2026 — Avastin demoted from preferred to non-preferred, step therapy added

---

## Notes

- Large PDFs are automatically split into 20-page chunks to stay within API rate limits
- `/compare` always returns the latest snapshot per payer (older snapshots kept for change tracking)
- Prompt caching on `/ask` reduces cost ~90% for repeated questions about the same policy
