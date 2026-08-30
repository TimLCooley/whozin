# Park session report: every capture with reader referee (px on paint),
# Tim's saved metric (his truth vs my read), and quality label.
import json, urllib.request, os, sys
import cv2
import verify

WT = '/'.join(__file__.split('/')[:-2])
env = {}
for line in open(f'{WT}/.env.local'):
    if '=' in line and not line.strip().startswith('#'):
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip().strip('"')
BASE, KEY = env['NEXT_PUBLIC_SUPABASE_URL'].strip(), env['SUPABASE_SERVICE_ROLE_KEY'].strip()
H = {'Authorization': f'Bearer {KEY}', 'apikey': KEY}

def req(path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    h = dict(H)
    if data: h['Content-Type'] = 'application/json'
    r = urllib.request.Request(f'{BASE}{path}', data=data, headers=h, method='POST' if data else 'GET')
    with urllib.request.urlopen(r, timeout=60) as resp:
        return resp.read()

rows_raw = json.loads(req('/storage/v1/object/list/lab-live',
                          {'prefix': '', 'limit': 300, 'sortBy': {'column': 'created_at', 'order': 'asc'}}))
ids = [r['name'][:-len('.json')] for r in rows_raw if r['name'].endswith('.json')]
import time as _t
print(f"{'capture':16s} {'label':9s} {'referee':>8s} {'saved avg':>9s} {'worst':>6s}  status")
goods, saves = 0, []
for i in ids:
    try:
        meta = json.loads(req(f'/storage/v1/object/lab-live/{i}.json?cb={int(_t.time()*1000)}'))
    except Exception:
        continue
    cp = meta.get('claude_pins')
    ref = ''
    imgp = f'{WT}/public/sim/live/park{i}.jpg'
    if cp and os.path.exists(imgp):
        img = cv2.imread(imgp)
        if img is not None:
            try:
                px, _ = verify.score(img, cp)
                ref = f'{px:.1f}px'
            except Exception:
                ref = '?'
    m = meta.get('metric') or {}
    lab = meta.get('label', '—')
    if lab == 'good': goods += 1
    if m.get('avg') is not None: saves.append(m['avg'])
    print(f"{i:16s} {lab:9s} {ref:>8s} {str(m.get('avg','—')):>9s} {str(m.get('max','—')):>6s}  {meta.get('status','?')}")
if saves:
    print(f"\nsaved: {len(saves)} · avg-of-avgs {sum(saves)/len(saves):.1f}px · best {min(saves):.1f} · worst {max(saves):.1f} · labeled good: {goods}")
