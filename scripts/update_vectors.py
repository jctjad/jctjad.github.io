#!/usr/bin/env python3
"""
update_vectors.py
Parses publication titles from index.html, keyword-matches them against
research areas, then writes assets/research-vectors.json.

Run locally:  python3 scripts/update_vectors.py
GitHub Action runs this automatically on pushes that touch index.html.
"""

import json
import re
from datetime import date
from pathlib import Path

# ── Keyword map ─────────────────────────────────────────────────────────────
# Each area maps to a list of keywords (case-insensitive substring match).
# A paper is tagged with an area if ANY keyword matches its title.
AREA_KEYWORDS = {
    "Software Engineering": [
        "software", "code", "coding", "program", "bug", "test", "refactor",
        "developer", "development", "repository", "api", "technical debt",
        "static analysis", "dynamic analysis", "debugging", "compilation",
        "deployment", "devops", "ci/cd", "version control",
    ],
    "Machine Learning": [
        "machine learning", "deep learning", "neural", "model", "training",
        "classification", "regression", "prediction", "dataset", "benchmark",
        "transformer", "llm", "large language", "fine-tun", "embedding",
        "reinforcement", "generative",
    ],
    "Interpretability / XAI": [
        "explainab", "interpretab", "xai", "explanation", "transparency",
        "attribution", "saliency", "shap", "lime", "trust", "fairness",
        "accountability", "black-box",
    ],
    "Empirical Methods": [
        "empirical", "study", "survey", "evaluation", "experiment",
        "user study", "qualitative", "quantitative", "interview", "analysis",
        "replication", "systematic review", "literature review",
    ],
    "HCI": [
        "human-computer", "hci", "user interface", "ux", "usability",
        "interaction", "cognitive", "mental model", "perception", "design",
        "accessibility", "end-user", "practitioners",
    ],
    "Tool Building": [
        "tool", "plugin", "framework", "library", "system", "platform",
        "prototype", "infrastructure", "automation", "pipeline",
    ],
}

# ── Helpers ──────────────────────────────────────────────────────────────────

def extract_pub_titles(html: str) -> list[str]:
    """Return all text nodes that sit inside a .pub-title element."""
    # Simple regex — avoids a full HTML parser dependency.
    pattern = re.compile(
        r'class="pub-title"[^>]*>(.*?)</p>',
        re.DOTALL | re.IGNORECASE,
    )
    titles = []
    for m in pattern.finditer(html):
        raw = m.group(1)
        # Strip inner tags (e.g. <em>, <strong>)
        text = re.sub(r'<[^>]+>', '', raw).strip()
        if text:
            titles.append(text)
    return titles


def classify(titles: list[str]) -> dict[str, int]:
    """Return {area: paper_count} for all areas that have at least one match."""
    counts: dict[str, int] = {area: 0 for area in AREA_KEYWORDS}
    for title in titles:
        lower = title.lower()
        for area, keywords in AREA_KEYWORDS.items():
            if any(kw in lower for kw in keywords):
                counts[area] += 1
    return {a: c for a, c in counts.items() if c > 0}


def build_vectors(counts: dict[str, int], total: int) -> list[dict]:
    vectors = []
    for area, papers in sorted(counts.items(), key=lambda x: -x[1]):
        pct = round(papers / total * 100) if total else 0
        vectors.append({"area": area, "papers": papers, "pct": pct})
    return vectors


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    root = Path(__file__).parent.parent          # repo root
    html_path = root / "index.html"
    json_path = root / "assets" / "research-vectors.json"

    html = html_path.read_text(encoding="utf-8")
    titles = extract_pub_titles(html)
    total = len(titles)

    counts = classify(titles)
    vectors = build_vectors(counts, total)

    payload = {
        "generated": date.today().isoformat(),
        "total_papers": total,
        "vectors": vectors,
    }

    json_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {json_path} — {total} paper(s), {len(vectors)} area(s)")
    for v in vectors:
        print(f"  {v['area']:30s}  {v['papers']} papers  {v['pct']}%")


if __name__ == "__main__":
    main()
