# Offline experiment: what separates the real ball from limb/paddle tracks in
# the cached US Open detections? Prints distributions + the top candidates
# under several ranking criteria so we can pick discriminators empirically.
import json, time
import numpy as np
from match_scan import link_all, med_speed
from rally_call import bounces

d = json.load(open('/tmp/usopen_match_dets.json'))
dets, fps = d['dets'], d['fps']
t0 = time.time()
tracks = link_all(dets)
print(f'{len(tracks)} tracks linked in {time.time()-t0:.0f}s')

def stats(t):
    n = len(t)
    sp = med_speed(t)
    span = t[-1][0] - t[0][0]
    xs = np.array([p[1] for p in t]); ys = np.array([p[2] for p in t])
    fs = np.array([p[0] for p in t], float)
    extent = float(np.hypot(xs.max() - xs.min(), ys.max() - ys.min()))
    path = float(np.sum(np.hypot(np.diff(xs), np.diff(ys))))
    straight = extent / max(path, 1e-6)
    # direction consistency: mean cos between consecutive step vectors
    vx, vy = np.diff(xs), np.diff(ys)
    L = np.hypot(vx, vy) + 1e-9
    cosr = float(np.mean((vx[:-1]*vx[1:] + vy[:-1]*vy[1:]) / (L[:-1]*L[1:]))) if n >= 3 else 0
    return dict(n=n, sp=sp*960, span=span, extent=extent, straight=straight, cos=cosr,
                t=t[0][0]/fps)

S = [stats(t) for t in tracks]
for k in ['n', 'sp', 'extent', 'straight', 'cos']:
    v = np.array([s[k] for s in S])
    print(f'{k}: p50={np.percentile(v,50):.3f} p90={np.percentile(v,90):.3f} p99={np.percentile(v,99):.3f} max={v.max():.3f}')

# The known-real rally: t=240..265s (the 25s segment that tracked cleanly).
print('\n-- tracks starting in 240..265s window (known rally), top by n*sp:')
win = [(s, t) for s, t in zip(S, tracks) if 240 <= s['t'] <= 265]
win.sort(key=lambda x: -(x[0]['n'] * x[0]['sp']))
for s, t in win[:8]:
    b = bounces(t)
    print(f"  t={s['t']:.1f}s n={s['n']} sp={s['sp']:.1f}px/f ext={s['extent']:.2f} str={s['straight']:.2f} cos={s['cos']:.2f} bounces={len(b)}")

print('\n-- whole match: top 15 by n*sp with cos>0.5 filter:')
cand = [(s, t) for s, t in zip(S, tracks) if s['cos'] > 0.5 and s['n'] >= 12 and s['sp'] >= 6]
cand.sort(key=lambda x: -(x[0]['n'] * x[0]['sp']))
print(f'  {len(cand)} tracks pass (cos>0.5, n>=12, sp>=6px/f)')
for s, t in cand[:15]:
    b = bounces(t)
    print(f"  t={s['t']:.1f}s n={s['n']} sp={s['sp']:.1f} ext={s['extent']:.2f} str={s['straight']:.2f} cos={s['cos']:.2f} bounces={len(b)}")
