# AntonRx — AI-Powered Drug Policy Intelligence

> Innovation Hacks 2.0 · April 3–5, 2026 · Arizona State University
> Sponsor track: AntonRx

An AI tool that ingests insurance policy PDFs, extracts structured coverage data, and lets analysts compare payers and ask plain-language questions — in seconds instead of hours.

---

## Project structure

```
innovation-hacks/
├── backend/
│   ├── data/              # Extracted policy JSON files (payer_drug_year.json)
│   ├── main.py            # FastAPI app — /extract, /compare, /ask, /changes
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
| AI | Anthropic Claude (`claude-sonnet-4-20250514`) |
| Storage | JSON files in `backend/data/` |
| PDF handling | Claude native PDF (base64) |

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
| POST | `/extract` | Upload PDF → Claude → structured JSON |
| GET | `/compare?drug=Bevacizumab` | Compare all payers for a drug |
| POST | `/ask` | Plain-language Q&A with prompt caching |
| GET | `/changes?payer=bcbs&drug=bevacizumab` | Diff two policy snapshots (Phase 2) |

---

## Demo drug & payers

- **Drug:** Bevacizumab (Avastin)
- **Payers:** BCBS NC, Florida Blue, Priority Health
