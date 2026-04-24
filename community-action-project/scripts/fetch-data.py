#!/usr/bin/env python3
"""
Fetches race data from the RunSignup API and writes it to data/race-data.json.

Usage (run from the community-action-project folder):
  python3 scripts/fetch-data.py

Credentials are read from api.env in the project root.

api.env format:
  RUNSIGNUP_API_KEY=your_key_here
  RUNSIGNUP_API_SECRET=your_secret_here
  RUNSIGNUP_RACE_ID=204626
"""
import json
import os
import sys
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path


def find_project_root():
    for candidate in [Path.cwd(), Path(__file__).resolve().parent.parent]:
        if (candidate / 'api.env').exists():
            return candidate
    sys.exit("Error: could not find api.env. Run from the community-action-project folder.")


def load_env(root):
    env = {}
    with open(root / 'api.env') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, val = line.partition('=')
            env[key.strip()] = val.strip()
    return env


def api_get(path, params):
    url = 'https://runsignup.com/Rest/' + path.lstrip('/') + '?' + urllib.parse.urlencode(params)
    print(f"    GET {url.split('?')[0]}")
    req = urllib.request.Request(url, headers={'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
            if 'error' in data:
                err = data['error']
                print(f"    !! API error {err.get('error_code')}: {err.get('error_msg')}")
            return data
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors='replace')
        sys.exit(f"HTTP error {e.code} on {path}: {body}")


def debug_keys(label, resp):
    """Print top-level keys and any nested keys one level deep so we can see the response shape."""
    print(f"\n  --- {label} response keys: {list(resp.keys())}")
    for k, v in resp.items():
        if isinstance(v, list) and v:
            print(f"      {k}[0] keys: {list(v[0].keys()) if isinstance(v[0], dict) else type(v[0]).__name__}")
        elif isinstance(v, dict):
            print(f"      {k} keys: {list(v.keys())}")
        else:
            print(f"      {k}: {repr(v)[:120]}")


def fetch_all(api_key, api_secret, race_id):
    auth = {'api_key': api_key, 'api_secret': api_secret, 'format': 'json'}

    print("  Fetching participant count...")
    p = api_get(f'race/{race_id}/participants', {**auth, 'page': 1, 'results_per_page': 1})
    debug_keys("participants", p)
    # Try both common key names RunSignup uses
    participant_count = int(
        p.get('total_results') or p.get('num_results') or
        len(p.get('participants') or p.get('participant') or [])
    )

    print("\n  Fetching donations...")
    d = api_get(f'race/{race_id}/donations', {**auth, 'page': 1, 'results_per_page': 250})
    debug_keys("donations", d)
    donations_list = d.get('donations') or d.get('race_donations') or d.get('donation') or []
    total_raised = sum(float(x.get('amount', 0)) for x in donations_list)
    total_donations = int(d.get('total_results') or d.get('num_results') or len(donations_list))
    if total_donations > 250:
        for page in range(2, -(-total_donations // 250) + 1):
            r = api_get(f'race/{race_id}/donations', {**auth, 'page': page, 'results_per_page': 250})
            page_list = r.get('donations') or r.get('race_donations') or r.get('donation') or []
            total_raised += sum(float(x.get('amount', 0)) for x in page_list)

    print("\n  Fetching tribute count...")
    t = api_get(f'race/{race_id}/tributes', {**auth, 'page': 1, 'results_per_page': 1})
    debug_keys("tributes", t)
    tribute_count = int(
        t.get('total_results') or t.get('num_results') or
        len(t.get('tributes') or t.get('tribute') or [])
    )

    print("\n  Fetching top fundraising teams...")
    ft = api_get(f'race/{race_id}/fundraising-teams', {
        **auth, 'page': 1, 'results_per_page': 10, 'sort': 'amount_raised DESC'
    })
    debug_keys("fundraising-teams", ft)
    teams_list = ft.get('fundraising_teams') or ft.get('fundraising-teams') or ft.get('teams') or []
    top_fundraisers = [
        {'name': x.get('name', 'Anonymous'), 'amount_raised': float(x.get('amount_raised', 0))}
        for x in teams_list[:10]
    ]

    return {
        'fetched_at':        datetime.now(timezone.utc).isoformat(),
        'total_raised':      round(total_raised, 2),
        'participant_count': participant_count,
        'tribute_count':     tribute_count,
        'top_fundraisers':   top_fundraisers,
    }


def main():
    # Support env vars as well as api.env (used by GitHub Actions)
    api_key    = os.environ.get('RUNSIGNUP_API_KEY')
    api_secret = os.environ.get('RUNSIGNUP_API_SECRET')
    race_id    = os.environ.get('RUNSIGNUP_RACE_ID', '204626')

    if not api_key or not api_secret:
        root       = find_project_root()
        env        = load_env(root)
        api_key    = api_key    or env.get('RUNSIGNUP_API_KEY')
        api_secret = api_secret or env.get('RUNSIGNUP_API_SECRET')
        race_id    = race_id    or env.get('RUNSIGNUP_RACE_ID', '204626')
        out_path   = root / 'data' / 'race-data.json'
    else:
        out_path = Path(__file__).resolve().parent.parent / 'data' / 'race-data.json'

    if not api_key or not api_secret:
        sys.exit("Error: RUNSIGNUP_API_KEY and RUNSIGNUP_API_SECRET are required.")

    print(f"Fetching data for race {race_id}...")
    data = fetch_all(api_key, api_secret, race_id)

    out_path.parent.mkdir(exist_ok=True)
    with open(out_path, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"\n✓ Saved to {out_path}")
    print(f"  Total raised:    ${data['total_raised']:,.2f}")
    print(f"  Participants:    {data['participant_count']}")
    print(f"  Tributes:        {data['tribute_count']}")
    print(f"  Top fundraisers: {len(data['top_fundraisers'])}")


if __name__ == '__main__':
    main()
