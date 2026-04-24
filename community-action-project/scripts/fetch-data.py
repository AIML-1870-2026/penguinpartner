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
    if isinstance(resp, list):
        print(f"\n  --- {label}: LIST of {len(resp)} items")
        if resp and isinstance(resp[0], dict):
            print(f"      item[0] keys: {list(resp[0].keys())}")
        return
    print(f"\n  --- {label} keys: {list(resp.keys())}")
    for k, v in resp.items():
        if isinstance(v, list) and v:
            first = v[0]
            print(f"      {k}[0] keys: {list(first.keys()) if isinstance(first, dict) else type(first).__name__}")
        elif isinstance(v, dict):
            print(f"      {k} keys: {list(v.keys())}")
        else:
            print(f"      {k}: {repr(v)[:200]}")


def fetch_all(api_key, api_secret, race_id):
    auth = {'api_key': api_key, 'api_secret': api_secret, 'format': 'json'}

    # ── Race info ──────────────────────────────────────────────────
    print("  Fetching race info...")
    race_resp = api_get(f'race/{race_id}', auth)
    race = race_resp.get('race', {})
    print(f"\n  race object keys: {list(race.keys())}")

    events = race.get('events', {})
    if isinstance(events, dict):
        events = events.get('event', [])
    if isinstance(events, dict):
        events = [events]
    print(f"\n  Found {len(events)} event(s):")
    for e in events:
        print(f"    event_id={e.get('event_id')}  name={e.get('name')}")

    event_ids = [e.get('event_id') for e in events if e.get('event_id')]

    # ── Participants — sum across all events ───────────────────────
    participant_count = 0
    for eid in event_ids:
        print(f"\n  Fetching participants for event_id={eid}...")
        p = api_get(f'race/{race_id}/participants', {**auth, 'event_id': eid, 'page': 1, 'results_per_page': 100})
        debug_keys(f"participants[{eid}]", p)
        if isinstance(p, list):
            participant_count += len(p)
            # paginate if full page returned
            page = 2
            while len(p) == 100:
                p = api_get(f'race/{race_id}/participants', {**auth, 'event_id': eid, 'page': page, 'results_per_page': 100})
                if isinstance(p, list):
                    participant_count += len(p)
                    page += 1
                else:
                    break
        else:
            participant_count += int(p.get('total_results') or p.get('num_results') or 0)

    # ── Total raised — probe several endpoints ─────────────────────
    total_raised = 0.0
    print("\n  Probing fundraising-pages...")
    fp = api_get(f'race/{race_id}/fundraising-pages', {**auth, 'page': 1, 'results_per_page': 1})
    debug_keys("fundraising-pages", fp)

    print("\n  Probing race-donations...")
    rd = api_get(f'race/{race_id}/race-donations', {**auth, 'page': 1, 'results_per_page': 1})
    debug_keys("race-donations", rd)

    print("\n  Probing donations...")
    dn = api_get(f'race/{race_id}/donations', {**auth, 'page': 1, 'results_per_page': 1})
    debug_keys("donations", dn)

    # ── Tributes ───────────────────────────────────────────────────
    tribute_count = 0
    print("\n  Probing tribute...")
    t = api_get(f'race/{race_id}/tribute', {**auth, 'page': 1, 'results_per_page': 1})
    debug_keys("tribute", t)

    print("\n  Probing tributes...")
    t2 = api_get(f'race/{race_id}/tributes', {**auth, 'page': 1, 'results_per_page': 1})
    debug_keys("tributes", t2)

    # ── Fundraising teams ──────────────────────────────────────────
    top_fundraisers = []
    print("\n  Probing fundraising_teams...")
    ft = api_get(f'race/{race_id}/fundraising_teams', {**auth, 'page': 1, 'results_per_page': 10})
    debug_keys("fundraising_teams", ft)

    print("\n  Probing fundraising-teams...")
    ft2 = api_get(f'race/{race_id}/fundraising-teams', {**auth, 'page': 1, 'results_per_page': 10})
    debug_keys("fundraising-teams", ft2)

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
