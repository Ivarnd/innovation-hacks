import base64
import io
import json
import os
import re
import time
from datetime import date
from pathlib import Path
from typing import Optional

from pypdf import PdfReader, PdfWriter

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="AntonRx Policy Intelligence API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).parent / "data"
PDFS_DIR = Path(__file__).parent / "pdfs"
DATA_DIR.mkdir(exist_ok=True)

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

MODEL = "claude-sonnet-4-6"

EXTRACTION_SYSTEM_PROMPT = """You are a medical benefit drug policy analyst.
Extract structured coverage information from the provided insurance policy PDF.

Return ONLY a valid JSON object with these exact fields:
- drug_name (string): generic name
- brand_name (string): brand name or null
- payer (string): insurance company name
- effective_date (string): policy effective date
- preferred_status (string): "preferred" | "non-preferred" | "not covered" | "unknown"
- access_status (string): e.g. "1 of 2 preferred" or null if not specified
- prior_auth_required (boolean)
- prior_auth_criteria (string): summary of criteria, or null
- step_therapy_required (boolean)
- step_therapy_drugs (array of strings): drugs that must be tried first, or []
- covered_indications (array of strings): approved diagnoses/conditions
- site_of_care (string): where drug must be administered, or null
- quantity_limits (string): dosing/quantity restrictions, or null
- notes (string): any other important coverage details, or null

Do not include any text outside the JSON object. No markdown, no preamble."""

# Maps payer name fragments to PDF filename (for /ask endpoint)
PAYER_PDF_MAP = {
    "bcbs": "BCBS NC - Corporate Medical Policy_ Preferred Injectable Oncology Program (Avastin example).pdf",
    "bcbs nc": "BCBS NC - Corporate Medical Policy_ Preferred Injectable Oncology Program (Avastin example).pdf",
    "florida blue": "Florida Blue MCG Bevecizumab policy.pdf",
    "cigna": "Cigna Rituximab Intravenous Products for Non-Oncology Indications.pdf",
    "uhc": "UHC Botulinum Toxins A and B \u2013 Commercial Medical Benefit Drug Policy.pdf",
    "united": "UHC Botulinum Toxins A and B \u2013 Commercial Medical Benefit Drug Policy.pdf",
    "priority health": "Priority Health 2026 MDL - Priority Health Commercial (Employer Group) and MyPriority.pdf",
    "priority": "Priority Health 2026 MDL - Priority Health Commercial (Employer Group) and MyPriority.pdf",
}


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s-]+", "_", text)
    return text


def parse_json_response(text: str) -> dict:
    """Extract JSON from Claude response, stripping any markdown fences."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


CHUNK_SIZE = 20
RATE_LIMIT_SLEEP = 65


def chunk_pdf(pdf_bytes: bytes) -> list[bytes]:
    """Split PDF into CHUNK_SIZE-page pieces. Returns list of PDF bytes."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    total_pages = len(reader.pages)

    if total_pages <= CHUNK_SIZE:
        return [pdf_bytes]

    chunks = []
    for start in range(0, total_pages, CHUNK_SIZE):
        writer = PdfWriter()
        for page_num in range(start, min(start + CHUNK_SIZE, total_pages)):
            writer.add_page(reader.pages[page_num])
        buf = io.BytesIO()
        writer.write(buf)
        chunks.append(buf.getvalue())
    return chunks


def call_claude_extract(pdf_bytes: bytes, drug_hint: str = None) -> dict:
    """Send one PDF chunk to Claude for extraction."""
    b64_pdf = base64.standard_b64encode(pdf_bytes).decode("utf-8")
    instruction = (
        f"Extract coverage information for {drug_hint} from this policy document as instructed. Focus only on {drug_hint}."
        if drug_hint
        else "Extract all coverage information from this policy document as instructed."
    )

    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=EXTRACTION_SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "document",
                    "source": {"type": "base64", "media_type": "application/pdf", "data": b64_pdf},
                },
                {"type": "text", "text": instruction},
            ],
        }],
    )

    raw_text = next(b.text for b in response.content if b.type == "text")
    return parse_json_response(raw_text)


def merge_chunk_results(results: list[dict]) -> dict:
    """Merge extraction results from multiple chunks into one policy object."""
    if len(results) == 1:
        return results[0]

    array_fields = {"step_therapy_drugs", "covered_indications"}
    merged = {}
    all_keys = {k for r in results for k in r}

    for key in all_keys:
        if key in array_fields:
            seen = []
            for r in results:
                for item in (r.get(key) or []):
                    if item not in seen:
                        seen.append(item)
            merged[key] = seen
        else:
            merged[key] = next(
                (r[key] for r in results if r.get(key) not in (None, "", "unknown")),
                results[0].get(key),
            )
    return merged


# ---------------------------------------------------------------------------
# POST /extract
# ---------------------------------------------------------------------------

@app.post("/extract")
async def extract(file: UploadFile = File(...), drug_hint: Optional[str] = None):
    """Upload a policy PDF, extract structured JSON with chunking, and save to data/."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    pdf_bytes = await file.read()
    chunks = chunk_pdf(pdf_bytes)

    results = []
    for i, chunk in enumerate(chunks):
        if i > 0:
            time.sleep(RATE_LIMIT_SLEEP)
        try:
            result = call_claude_extract(chunk, drug_hint=drug_hint)
            results.append(result)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=502, detail=f"Claude returned invalid JSON on chunk {i+1}: {e}")

    policy = merge_chunk_results(results)

    payer_slug = slugify(policy.get("payer", "unknown"))
    drug_slug = slugify(policy.get("drug_name", "unknown"))
    today = date.today().isoformat()
    filename = f"{payer_slug}_{drug_slug}_{today}.json"

    output_path = DATA_DIR / filename
    output_path.write_text(json.dumps(policy, indent=2))

    return policy


# ---------------------------------------------------------------------------
# GET /compare
# ---------------------------------------------------------------------------

@app.get("/compare")
def compare(drug: str = Query(..., description="Drug name to compare across payers")):
    """Return the latest policy per payer matching the given drug name."""
    drug_lower = drug.lower()

    # Collect all matching files, keep only the latest per payer (files are
    # named {payer}_{drug}_{date}.json so lexicographic sort = date sort)
    latest: dict[str, tuple] = {}  # payer_slug -> (json_file, data)

    for json_file in sorted(DATA_DIR.glob("*.json")):
        try:
            data = json.loads(json_file.read_text())
        except Exception:
            continue

        if drug_lower not in (data.get("drug_name") or "").lower() and \
           drug_lower not in (data.get("brand_name") or "").lower():
            continue

        payer_key = slugify(data.get("payer", json_file.stem))
        # sorted() gives ascending order so each iteration replaces with a newer file
        latest[payer_key] = (json_file, data)

    results = []
    for json_file, data in latest.values():
        results.append({
            "payer": data.get("payer"),
            "drug_name": data.get("drug_name"),
            "brand_name": data.get("brand_name"),
            "preferred_status": data.get("preferred_status"),
            "access_status": data.get("access_status"),
            "prior_auth_required": data.get("prior_auth_required"),
            "prior_auth_criteria": data.get("prior_auth_criteria"),
            "step_therapy_required": data.get("step_therapy_required"),
            "step_therapy_drugs": data.get("step_therapy_drugs", []),
            "site_of_care": data.get("site_of_care"),
            "effective_date": data.get("effective_date"),
            "covered_indications": data.get("covered_indications", []),
            "quantity_limits": data.get("quantity_limits"),
            "notes": data.get("notes"),
            "_source_file": json_file.name,
        })

    return results


# ---------------------------------------------------------------------------
# POST /ask
# ---------------------------------------------------------------------------

class AskRequest(BaseModel):
    question: str
    drug: str
    payers: Optional[list[str]] = None


@app.post("/ask")
def ask(body: AskRequest):
    """Answer a plain-language question using policy documents with prompt caching."""
    drug_lower = body.drug.lower()

    # Load relevant JSON policies
    matching_policies = []
    for json_file in sorted(DATA_DIR.glob("*.json")):
        try:
            data = json.loads(json_file.read_text())
        except Exception:
            continue

        if drug_lower not in (data.get("drug_name") or "").lower() and \
           drug_lower not in (data.get("brand_name") or "").lower():
            continue

        if body.payers:
            payer_name = (data.get("payer") or "").lower()
            if not any(p.lower() in payer_name or payer_name in p.lower() for p in body.payers):
                continue

        matching_policies.append(data)

    if not matching_policies:
        raise HTTPException(status_code=404, detail=f"No policies found for drug '{body.drug}'.")

    # Build content blocks: policy JSONs as text + PDF documents with cache_control
    content_blocks = []

    # Summarized policy JSON context (cached — stable per drug/payer combo)
    policy_summary = json.dumps(matching_policies, indent=2)
    content_blocks.append({
        "type": "text",
        "text": f"Here are the extracted policy summaries for {body.drug}:\n\n{policy_summary}",
        "cache_control": {"type": "ephemeral"},
    })

    # Attach raw PDFs for payers we have them for (with caching)
    sources = []
    for policy in matching_policies:
        payer = (policy.get("payer") or "").lower()
        pdf_file = None
        for key, fname in PAYER_PDF_MAP.items():
            if key in payer or payer in key:
                pdf_file = PDFS_DIR / fname
                break

        if pdf_file and pdf_file.exists():
            b64_pdf = base64.standard_b64encode(pdf_file.read_bytes()).decode("utf-8")
            content_blocks.append({
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": b64_pdf,
                },
                "cache_control": {"type": "ephemeral"},
            })

        sources.append({
            "payer": policy.get("payer"),
            "policy_date": policy.get("effective_date"),
        })

    # The actual question (not cached — changes per request)
    content_blocks.append({
        "type": "text",
        "text": body.question,
    })

    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=(
            "You are an expert medical benefit drug policy analyst. "
            "Answer the analyst's question based on the provided policy documents. "
            "Be concise and cite specific payers when relevant."
        ),
        messages=[{"role": "user", "content": content_blocks}],
    )

    answer = next(b.text for b in response.content if b.type == "text")
    return {"answer": answer, "sources": sources}


# ---------------------------------------------------------------------------
# GET /changes  (Phase 2)
# ---------------------------------------------------------------------------

DIFF_PROMPT = """You are comparing two versions of the same insurance policy.

OLD VERSION:
{old_json}

NEW VERSION:
{new_json}

Identify every field that changed. For each change, classify it as:
- "significant": affects clinical access, coverage criteria, step therapy, prior auth requirements, or covered indications
- "cosmetic": formatting, effective date update, new clinical reference, minor wording clarification

Return ONLY a JSON array:
[
  {{
    "field": "step_therapy_required",
    "old_value": false,
    "new_value": true,
    "type": "significant",
    "reason": "Step therapy requirement added — patients must now try biosimilar first"
  }}
]"""


@app.get("/changes")
def changes(
    payer: str = Query(..., description="Payer slug, e.g. 'bcbs'"),
    drug: str = Query(..., description="Drug slug, e.g. 'bevacizumab'"),
):
    """Diff two JSON snapshots and classify each change as significant or cosmetic."""
    payer_lower = payer.lower()
    drug_lower = drug.lower()

    matches = sorted([
        f for f in DATA_DIR.glob("*.json")
        if payer_lower in f.name and drug_lower in f.name
    ])

    if len(matches) < 2:
        raise HTTPException(
            status_code=404,
            detail=f"Need at least 2 snapshots for payer='{payer}' drug='{drug}'. Found {len(matches)}."
        )

    old_policy = json.loads(matches[0].read_text())
    new_policy = json.loads(matches[-1].read_text())

    prompt = DIFF_PROMPT.format(
        old_json=json.dumps(old_policy, indent=2),
        new_json=json.dumps(new_policy, indent=2),
    )

    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    raw_text = next(b.text for b in response.content if b.type == "text")
    try:
        diff = parse_json_response(raw_text)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Claude returned invalid JSON: {e}")

    return {
        "old_snapshot": matches[0].name,
        "new_snapshot": matches[-1].name,
        "changes": diff,
    }


# ---------------------------------------------------------------------------
# GET /policies
# ---------------------------------------------------------------------------

@app.get("/policies")
def list_policies():
    """List all extracted policy JSON files in data/."""
    files = sorted([f.name for f in DATA_DIR.glob("*.json")])
    return {"files": files, "count": len(files)}


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "pdfs": len(list(PDFS_DIR.glob("*.pdf"))),
        "policies": len(list(DATA_DIR.glob("*.json"))),
    }
