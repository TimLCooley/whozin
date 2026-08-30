# Park watcher: polls the Supabase 'lab-live' bucket for new courtside captures,
# runs the CV reader on each, and writes claude_pins back so they appear on
# Tim's phone. The Mac at home is the compute; Supabase is the relay.
import json, os, subprocess, time, urllib.request

WT = '/'.join(__file__.split('/')[:-2])
env = {}
for line in open(f'{WT}/.env.local'):
    if '=' in line and not line.strip().startswith('#'):
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip().strip('"')
BASE = env['NEXT_PUBLIC_SUPABASE_URL'].strip()
KEY = env['SUPABASE_SERVICE_ROLE_KEY'].strip()
HDRS = {'Authorization': f'Bearer {KEY}', 'apikey': KEY}

def req(method, path, body=None, headers=None, raw=False):
    h = dict(HDRS)
    if headers: h.update(headers)
    data = body if isinstance(body, bytes) else (json.dumps(body).encode() if body is not None else None)
    if data is not None and not isinstance(body, bytes): h['Content-Type'] = 'application/json'
    r = urllib.request.Request(f'{BASE}{path}', data=data, headers=h, method=method)
    with urllib.request.urlopen(r, timeout=60) as resp:
        raw_b = resp.read()
        return raw_b if raw else (json.loads(raw_b) if raw_b else None)

def list_ids():
    rows = req('POST', '/storage/v1/object/list/lab-live', {'prefix': '', 'limit': 300, 'sortBy': {'column': 'created_at', 'order': 'desc'}})
    return [r['name'][:-4] for r in rows if r['name'].endswith('.json')]

def get_meta(i):
    try: return json.loads(req('GET', f'/storage/v1/object/lab-live/{i}.json', raw=True))
    except Exception: return None

def put_meta(i, meta):
    req('PUT', f'/storage/v1/object/lab-live/{i}.json', json.dumps(meta).encode(),
        headers={'Content-Type': 'application/json', 'x-upsert': 'true'})

def process(i, meta):
    img = req('GET', f'/storage/v1/object/lab-live/{i}.jpg', raw=True)
    os.makedirs(f'{WT}/public/sim/live', exist_ok=True)
    open(f'{WT}/public/sim/live/park{i}.jpg', 'wb').write(img)
    p = subprocess.run(['python3', f'{WT}/dev-cv/auto_api.py'],
                       input=json.dumps({'court': f'live-park{i}'}), capture_output=True, text=True,
                       cwd=f'{WT}/dev-cv', timeout=180)
    try:
        r = json.loads(p.stdout.strip().splitlines()[-1])
    except Exception:
        r = {'error': p.stdout[-120:]}
    if 'corners' in r:
        meta.update(claude_pins=r['corners'], status='done', read_at=time.time())
        print(f'{i}: read written', flush=True)
    else:
        meta.update(status='error', claude_error=r.get('error', '?'), read_at=time.time())
        print(f'{i}: reader error: {r.get("error","?")[:60]}', flush=True)
    put_meta(i, meta)

print('park watcher up — polling lab-live every 5s', flush=True)
seen_err = 0
while True:
    try:
        for i in list_ids():
            meta = get_meta(i) or {}
            if meta.get('status') == 'pending':
                print(f'{i}: processing…', flush=True)
                process(i, meta)
        seen_err = 0
    except Exception as e:
        seen_err += 1
        print(f'watcher error ({seen_err}): {e}', flush=True)
        if seen_err > 50: time.sleep(60)
    time.sleep(5)
