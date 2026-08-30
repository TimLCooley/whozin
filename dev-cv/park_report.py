# Park session report: every capture with reader referee (px on paint),
# Tim's saved metric (his truth vs my read), and quality label.
import json, urllib.request, os, sys
import cv2
import numpy as np
import verify

MARKS = [(0,0),(20,0),(20,44),(0,44),(0,15),(20,15),(0,29),(20,29),(10,0),(10,44),(10,15),(10,29)]

def true_metric(cp, tp, w, h):
    """Ordering-proof 12-marker metric (recomputed; stored client metrics from
    stale bundles can be bogus)."""
    Hm, _ = cv2.findHomography(verify.CC, np.array(cp, float) * [w, h])
    if Hm is None: return None
    best = None
    tp = list(tp)
    for r in range(4):
        for rev in (False, True):
            o = [tp[(k + r) % 4] for k in range(4)]
            if rev: o = [o[0], o[3], o[2], o[1]]
            Ht, _ = cv2.findHomography(verify.CC, np.array(o, float) * [w, h])
            if Ht is None: continue
            ds = []
            for mx, my in MARKS:
                P = Ht @ [mx, my, 1.0]
                if abs(P[2]) < 1e-9: continue
                tx, ty = P[0]/P[2], P[1]/P[2]
                if not (0 <= tx < w and 0 <= ty < h): continue
                Q = Hm @ [mx, my, 1.0]
                if abs(Q[2]) < 1e-9: continue
                ds.append(np.hypot(tx - Q[0]/Q[2], ty - Q[1]/Q[2]))
            if len(ds) < 4: continue
            avg = float(np.mean(ds))
            if best is None or avg < best[0]: best = (avg, float(np.max(ds)))
    return best

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
    lab = meta.get('label', '—')
    if lab == 'good': goods += 1
    tm = None
    tp = meta.get('tim_pins')
    if cp and tp and os.path.exists(imgp):
        img2 = cv2.imread(imgp)
        if img2 is not None:
            tm = true_metric(cp, tp, img2.shape[1], img2.shape[0])
    if tm: saves.append(tm[0])
    a = f'{tm[0]:.1f}' if tm else '—'
    mx = f'{tm[1]:.1f}' if tm else '—'
    print(f"{i:16s} {lab:9s} {ref:>8s} {a:>9s} {mx:>6s}  {meta.get('status','?')}")
if saves:
    print(f"\nsaved: {len(saves)} · avg-of-avgs {sum(saves)/len(saves):.1f}px · best {min(saves):.1f} · worst {max(saves):.1f} · labeled good: {goods}")
