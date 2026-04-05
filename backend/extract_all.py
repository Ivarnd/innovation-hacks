"""
Batch extraction script — run this once to pre-populate the data/ folder.
Usage: python extract_all.py
"""
import base64
import io
import json
import os
import re
import time
from datetime import date
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from pypdf import PdfReader, PdfWriter

load_dotenv()

PDFS_DIR = Path(__file__).parent / "pdfs"
DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
MODEL = "claude-sonnet-4-6"

# Max pages per Claude request (~1,334 tokens/page, limit is 30k tokens/min)
CHUNK_SIZE = 20
RATE_LIMIT_SLEEP = 65  # seconds between requests

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
- quantity_limits (array of strings): each dosing/quantity restriction as a separate item, or []
- notes (string): any other important coverage details, or null

Do not include any text outside the JSON object. No markdown, no preamble."""


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s-]+", "_", text)
    return text


def chunk_pdf(pdf_bytes: bytes, chunk_size: int = CHUNK_SIZE) -> list[bytes]:
    """Split a PDF into chunks of `chunk_size` pages. Returns list of PDF bytes."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    total_pages = len(reader.pages)

    if total_pages <= chunk_size:
        return [pdf_bytes]

    chunks = []
    for start in range(0, total_pages, chunk_size):
        writer = PdfWriter()
        end = min(start + chunk_size, total_pages)
        for page_num in range(start, end):
            writer.add_page(reader.pages[page_num])
        buf = io.BytesIO()
        writer.write(buf)
        chunks.append(buf.getvalue())

    return chunks


def call_claude(pdf_bytes: bytes, drug_hint: str = None) -> dict:
    """Send one PDF chunk to Claude and return parsed JSON."""
    b64_pdf = base64.standard_b64encode(pdf_bytes).decode("utf-8")

    if drug_hint:
        instruction = f"Extract coverage information for {drug_hint} from this policy document as instructed. Focus only on {drug_hint}."
    else:
        instruction = "Extract all coverage information from this policy document as instructed."

    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=EXTRACTION_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": b64_pdf,
                        },
                    },
                    {
                        "type": "text",
                        "text": instruction,
                    },
                ],
            }
        ],
    )

    raw_text = next(b.text for b in response.content if b.type == "text")
    raw_text = raw_text.strip()
    raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
    raw_text = re.sub(r"\s*```$", "", raw_text)
    return json.loads(raw_text)


def merge_results(results: list[dict]) -> dict:
    """Merge extraction results from multiple chunks into one policy object."""
    if len(results) == 1:
        return results[0]

    merged = {}
    array_fields = {"step_therapy_drugs", "covered_indications"}

    all_keys = {k for r in results for k in r}
    for key in all_keys:
        if key in array_fields:
            # Union of all arrays, preserving order and removing duplicates
            seen = []
            for r in results:
                for item in (r.get(key) or []):
                    if item not in seen:
                        seen.append(item)
            merged[key] = seen
        else:
            # First non-null value wins
            merged[key] = next(
                (r[key] for r in results if r.get(key) not in (None, "", "unknown")),
                results[0].get(key),
            )

    return merged


def extract_pdf(pdf_path: Path, drug_hint: str = None) -> dict:
    """Extract policy data from a PDF, chunking if needed to stay under rate limit."""
    pdf_bytes = pdf_path.read_bytes()
    reader = PdfReader(io.BytesIO(pdf_bytes))
    total_pages = len(reader.pages)

    chunks = chunk_pdf(pdf_bytes)
    print(f"  Pages: {total_pages} → {len(chunks)} chunk(s) of up to {CHUNK_SIZE} pages")

    results = []
    for j, chunk in enumerate(chunks):
        if j > 0:
            print(f"  Waiting {RATE_LIMIT_SLEEP}s before chunk {j+1}...")
            time.sleep(RATE_LIMIT_SLEEP)

        print(f"  Sending chunk {j+1}/{len(chunks)} to Claude...")
        result = call_claude(chunk, drug_hint=drug_hint)
        results.append(result)

    return merge_results(results)


DRUG_HINTS = {
    "BCBS NC": "Bevacizumab (Avastin)",
    "Florida Blue": "Bevacizumab (Avastin)",
}


def main():
    pdf_files = sorted(PDFS_DIR.glob("*.pdf"))
    print(f"Found {len(pdf_files)} PDF(s) in {PDFS_DIR}\n")

    today = date.today().isoformat()

    for i, pdf_path in enumerate(pdf_files):
        print(f"[{i+1}/{len(pdf_files)}] {pdf_path.name}")
        drug_hint = next((v for k, v in DRUG_HINTS.items() if k in pdf_path.name), None)
        if drug_hint:
            print(f"  Drug hint: {drug_hint}")
        try:
            policy = extract_pdf(pdf_path, drug_hint=drug_hint)
            payer_slug = slugify(policy.get("payer", "unknown"))
            drug_slug = slugify(policy.get("drug_name", "unknown"))
            filename = f"{payer_slug}_{drug_slug}_{today}.json"
            output_path = DATA_DIR / filename
            output_path.write_text(json.dumps(policy, indent=2))
            print(f"  Saved → {filename}")
            print(f"  Drug: {policy.get('drug_name')} | Payer: {policy.get('payer')}")
            print(f"  Prior auth: {policy.get('prior_auth_required')} | Step therapy: {policy.get('step_therapy_required')}")
        except Exception as e:
            print(f"  ERROR: {e}")

        if i < len(pdf_files) - 1:
            print(f"  Waiting {RATE_LIMIT_SLEEP}s before next PDF...\n")
            time.sleep(RATE_LIMIT_SLEEP)

    print(f"\nDone. {len(list(DATA_DIR.glob('*.json')))} policy file(s) in data/")


if __name__ == "__main__":
    main()
