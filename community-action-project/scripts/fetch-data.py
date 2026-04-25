#!/usr/bin/env python3
"""
Fetches race data from the RunSignup API and writes aggregate totals to
data/race-data.json. No personal data (names, emails, addresses) is stored.

Usage (run from the community-action-project folder):
  python3 scripts/fetch-data.py

Credentials are read from api.env in the project root, or from environment
variables RUNSIGNUP_API_KEY / RUNSIGNUP_API_SECRET (used by GitHub Actions).
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
    req = urllib.request.Request(url, headers={'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
            if isinstance(data, dict) and 'error' in data:
                err = data['error']
                print(f"  !! API error {err.get('error_code')}: {err.get('error_msg')}")
            return data
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors='replace')
        sys.exit(f"HTTP error {e.code} on {path}: {body}")


def parse_money(value):
    """Convert '$38.10' or '38.10' or 38.10 to a float."""
    if value is None:
        return 0.0
    return float(str(value).replace('$', '').replace(',', '').strip() or 0)


def get_events(race_id, auth):
    resp   = api_get(f'race/{race_id}', auth)
    race   = resp.get('race', {})
    events = race.get('events', {})
    if isinstance(events, dict):
        events = events.get('event', [])
    if isinstance(events, dict):
        events = [events]
    ids   = [e.get('event_id') for e in events if e.get('event_id')]
    names = {e.get('event_id'): e.get('name', f"Event {e.get('event_id')}") for e in events}
    print(f"  Found {len(ids)} event(s): {list(names.items())}")
    return ids, names


def fetch_all(api_key, api_secret, race_id):
    auth = {'api_key': api_key, 'api_secret': api_secret, 'format': 'json'}

    event_ids, event_names = get_events(race_id, auth)

    # ── Participants + total raised ────────────────────────────────
    # Response: [{"event": {...}, "participants": [{...}, ...]}, ...]
    # race_fee = registration amount going to the race (excludes processor cut)
    # Personal data is read only to extract the fee — never stored.
    participant_count = 0
    total_raised      = 0.0
    divisions         = {}  # event_id -> {name, count}

    for eid in event_ids:
        page = 1
        while True:
            resp = api_get(f'race/{race_id}/participants', {
                **auth, 'event_id': eid, 'page': page, 'results_per_page': 100
            })
            if not isinstance(resp, list):
                break
            page_count = 0
            for group in resp:
                if eid not in divisions:
                    divisions[eid] = {'name': event_names.get(eid, f'Event {eid}'), 'count': 0}
                for p in group.get('participants', []):
                    page_count              += 1
                    participant_count       += 1
                    divisions[eid]['count'] += 1
                    total_raised            += parse_money(p.get('race_fee'))
            if page_count < 100:
                break
            page += 1

    return {
        'fetched_at':         datetime.now(timezone.utc).isoformat(),
        'registration_total': round(total_raised, 2),
        'participant_count':  participant_count,
        'tribute_count':      0,
        'divisions':          [{'name': v['name'], 'count': v['count']} for v in divisions.values()],
    }


def main():
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

    # Merge manual overrides (donations not available via RunSignup API)
    manual_path = out_path.parent / 'manual-data.json'
    donation_total = 0.0
    if manual_path.exists():
        with open(manual_path) as f:
            manual = json.load(f)
        donation_total = float(manual.get('donation_total', 0))
        data['tribute_count'] = int(manual.get('tribute_count', 0))
        print(f"  Manual donation_total: ${donation_total:.2f}")
        print(f"  Manual tribute_count:  {data['tribute_count']}")

    data['donation_total'] = round(donation_total, 2)
    data['total_raised']   = round(data['registration_total'] + donation_total, 2)

    out_path.parent.mkdir(exist_ok=True)
    with open(out_path, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"\n✓ Saved to {out_path}")
    print(f"  Registrations: ${data['registration_total']:,.2f}")
    print(f"  Donations:     ${data['donation_total']:,.2f}")
    print(f"  Total raised:  ${data['total_raised']:,.2f}")
    print(f"  Participants:  {data['participant_count']}")
    for d in data.get('divisions', []):
        print(f"    {d['name']}: {d['count']}")


if __name__ == '__main__':
    main()
