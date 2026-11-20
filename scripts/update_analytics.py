#!/usr/bin/env python3
"""
update_analytics.py
Pulls site stats from the Google Analytics 4 Data API and writes
assets/analytics.json, which dashboard.html reads.

Stats are fetched separately per week / month / year / all time, so
unique-visitor counts are exact for each period (they can't be summed).

The output is password-encrypted (see dashboard_crypto.py): the repo is
public, so only ciphertext is ever written to assets/analytics.enc.json.

Environment:
  GA_PROPERTY_ID                  numeric GA4 property ID (not the G-XXXX measurement ID)
  GOOGLE_APPLICATION_CREDENTIALS  path to a service-account JSON key with Viewer access
  DASHBOARD_PASSWORD              password used to unlock dashboard.html
  GA_START_DATE                   optional, YYYY-MM-DD (default 2024-01-01)

Run locally:  pip install google-analytics-data cryptography && python3 scripts/update_analytics.py
GitHub Action (.github/workflows/update-analytics.yml) runs this daily.
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Filter,
    FilterExpression,
    Metric,
    RunReportRequest,
)
from google.api_core.exceptions import InvalidArgument

from dashboard_crypto import encrypt

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "analytics.enc.json"

# Must match the events sent by script/analytics.js
CUSTOM_EVENTS = ["joke_refresh", "paper_click", "social_click", "email_copy", "article_click"]
LABEL_DIMENSION = "customEvent:label"

GRANULARITIES = {
    "week": "isoYearIsoWeek",  # e.g. "202647"
    "month": "yearMonth",      # e.g. "202611"
    "year": "year",            # e.g. "2026"
    "all": None,
}

OVERVIEW_METRICS = [
    "activeUsers",             # visitors
    "newUsers",
    "sessions",                # visits
    "screenPageViews",
    "userEngagementDuration",  # seconds the page was in focus, summed
    "engagedSessions",
]

TOP_N = 15  # keep the per-period lists (sources, countries, pages) small


def num(v: float):
    return int(v) if float(v).is_integer() else round(v, 1)


def normalize_path(path: str) -> str:
    if path in ("", "/index.html"):
        return "/"
    if path.endswith(".html"):
        path = path[: -len(".html")]
    return path


def top(d: dict, key=lambda v: v) -> dict:
    return dict(sorted(d.items(), key=lambda kv: key(kv[1]), reverse=True)[:TOP_N])


def main():
    property_id = os.environ.get("GA_PROPERTY_ID")
    password = os.environ.get("DASHBOARD_PASSWORD")
    if not property_id or not password:
        sys.exit("GA_PROPERTY_ID and DASHBOARD_PASSWORD must both be set")
    start_date = os.environ.get("GA_START_DATE", "2024-01-01")

    client = BetaAnalyticsDataClient()

    def run(dims, metrics, dim_filter=None):
        req = RunReportRequest(
            property=f"properties/{property_id}",
            dimensions=[Dimension(name=d) for d in dims],
            metrics=[Metric(name=m) for m in metrics],
            date_ranges=[DateRange(start_date=start_date, end_date="today")],
            limit=100000,
        )
        if dim_filter is not None:
            req.dimension_filter = dim_filter
        resp = client.run_report(req)
        return [
            ([v.value for v in row.dimension_values], [float(v.value) for v in row.metric_values])
            for row in resp.rows
        ]

    event_filter = FilterExpression(
        filter=Filter(field_name="eventName", in_list_filter=Filter.InListFilter(values=CUSTOM_EVENTS))
    )

    # The "label" custom dimension must be registered in GA4; fall back gracefully if not.
    label_dim = LABEL_DIMENSION
    try:
        run(["eventName", LABEL_DIMENSION], ["eventCount"], event_filter)
    except InvalidArgument:
        print(f"warning: {LABEL_DIMENSION} not registered in GA4 — event labels will be blank")
        label_dim = None

    periods = {}
    for name, gdim in GRANULARITIES.items():
        gdims = [gdim] if gdim else []
        n = len(gdims)
        table = {}

        def bucket(dvals):
            key = dvals[0] if n else "all"
            return table.setdefault(
                key, {"overview": {}, "pages": {}, "events": {}, "sources": {}, "countries": {}}
            )

        for dvals, mvals in run(gdims, OVERVIEW_METRICS):
            bucket(dvals)["overview"] = {m: num(v) for m, v in zip(OVERVIEW_METRICS, mvals)}

        for dvals, (views, engagement) in run(gdims + ["pagePath"], ["screenPageViews", "userEngagementDuration"]):
            pages = bucket(dvals)["pages"]
            p = pages.setdefault(normalize_path(dvals[n]), {"views": 0, "engagement": 0})
            p["views"] = num(p["views"] + views)
            p["engagement"] = num(p["engagement"] + engagement)

        edims = gdims + ["eventName"] + ([label_dim] if label_dim else [])
        for dvals, (count,) in run(edims, ["eventCount"], event_filter):
            label = dvals[n + 1] if label_dim else ""
            if label == "(not set)":
                label = ""
            ev = bucket(dvals)["events"].setdefault(dvals[n], {})
            ev[label] = num(ev.get(label, 0) + count)

        for dvals, (sessions,) in run(gdims + ["sessionSource"], ["sessions"]):
            bucket(dvals)["sources"][dvals[n]] = num(sessions)

        for dvals, (users,) in run(gdims + ["country"], ["activeUsers"]):
            bucket(dvals)["countries"][dvals[n]] = num(users)

        for b in table.values():
            b["sources"] = top(b["sources"])
            b["countries"] = top(b["countries"])
            b["pages"] = top(b["pages"], key=lambda p: p["views"])

        periods[name] = dict(sorted(table.items()))

    # Action logs are public on a public repo, so print nothing about the data itself.
    plaintext = json.dumps({
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "start_date": start_date,
        "periods": periods,
    }, separators=(",", ":")).encode("utf-8")
    OUT.write_text(json.dumps(encrypt(plaintext, password)) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)} (encrypted)")


if __name__ == "__main__":
    main()
