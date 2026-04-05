"""
Batch extraction script — run this once to pre-populate the data/ folder.
Usage: python extract_all.py
"""
import base64
import json
import os
import re
from datetime import date
from pathlib import Path

import anthropic
from dotenv import load_dotenv

load_dotenv()

PDFS_DIR = Path(__file__).parent / "pdfs"
DATA_DIR = Path(__file__).parent / "data"
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


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s-]+", "_", text)
    return text


def extract_pdf(pdf_path: Path) -> dict:
    b64_pdf = base64.standard_b64encode(pdf_path.read_bytes()).decode("utf-8")

    response = client.messages.create(
        model=MODEL,
        max_tokens=2048,
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
                        "text": "Extract all coverage information from this policy document as instructed.",
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


def main():
    pdf_files = list(PDFS_DIR.glob("*.pdf"))
    print(f"Found {len(pdf_files)} PDF(s) in {PDFS_DIR}\n")

    today = date.today().isoformat()

    for pdf_path in pdf_files:
        print(f"Processing: {pdf_path.name}")
        try:
            policy = extract_pdf(pdf_path)
            payer_slug = slugify(policy.get("payer", "unknown"))
            drug_slug = slugify(policy.get("drug_name", "unknown"))
            filename = f"{payer_slug}_{drug_slug}_{today}.json"
            output_path = DATA_DIR / filename
            output_path.write_text(json.dumps(policy, indent=2))
            print(f"  Saved → {filename}")
            print(f"  Drug: {policy.get('drug_name')} | Payer: {policy.get('payer')}")
            print(f"  Prior auth: {policy.get('prior_auth_required')} | Step therapy: {policy.get('step_therapy_required')}\n")
        except Exception as e:
            print(f"  ERROR: {e}\n")

    print(f"Done. {len(list(DATA_DIR.glob('*.json')))} policy file(s) in data/")


if __name__ == "__main__":
    main()
