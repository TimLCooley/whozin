# Experiment 2: bounce = JOIN between two tracks. The constant-velocity gate
# breaks tracks exactly at the bounce (ball reverses vertical direction), so
# look for track A ending in descent + track B starting nearby in ascent.
import json, time
import numpy as np
from match_scan import link_all, med_speed
from rally_call import call_at

d = json.load(open('/tmp/usopen_match_dets.json'))
dets, fps = d['dets'], d['fps']
tracks = link_all(dets)

def tail_vy(t, k=3):
    """normalized y/frame over the last k steps (positive = descending)."""
    a = t[max(0, len(t)-k-1)]; b = t[-1]
    return (b[2] - a[2]) / max(1, b[0] - a[0])

def head_vy(t, k=3):
    a = t[0]; b = t[min(len(t)-1, k)]
    return (b[2] - a[2]) / max(1, b[0] - a[0])

def is_bally(t):
    if len(t) < 8: return False
    sp = med_speed(t) * 960
    if sp < 5: return False
    xs = [p[1] for p in t]; ys = [p[2] for p in t]
    extent = np.hypot(max(xs)-min(xs), max(ys)-min(ys))
    return extent >= 0.05

bally = [t for t in tracks if is_bally(t)]
print(f'{len(bally)} bally tracks')
by_start = {}
for t in bally:
    by_start.setdefault(t[0][0], []).append(t)

joins = []
for A in bally:
    if tail_vy(A) < 0.003: continue          # must end descending
    fe, xe, ye = A[-1]
    for df in range(0, 8):
        for B in by_start.get(fe + df, []):
            if B is A: continue
            fb, xb, yb = B[0]
            if np.hypot(xb - xe, yb - ye) > 0.06: continue
            if head_vy(B) > -0.001: continue  # must start ascending(ish)
            bx, by_ = (xe + xb) / 2, (ye + yb) / 2
            joins.append((fe, bx, by_, A, B))
print(f'{len(joins)} track-join bounce events')

calib = json.load(open('/tmp/usopen_truth.json'))
print('\n-- joins in the known rally window 240..270s:')
for fe, bx, by_, A, B in joins:
    ts = fe / fps
    if 240 <= ts <= 270:
        verdict, cxy, d_in, m = call_at(calib, 1280, 720, bx, by_)
        print(f'  t={ts:.1f}s A:{len(A)}pts B:{len(B)}pts -> {verdict} @ ({cxy[0]:.1f},{cxy[1]:.1f})ft')

# distribution over whole match + closest calls
rows = []
for fe, bx, by_, A, B in joins:
    verdict, cxy, d_in, m = call_at(calib, 1280, 720, bx, by_)
    rows.append((abs(d_in), fe / fps, verdict, cxy, d_in, len(A), len(B), bx, by_, fe))
rows.sort()
print(f'\n-- {len(rows)} total calls; 15 CLOSEST to a line:')
for r in rows[:15]:
    print(f'  t={r[1]:.1f}s {r[2]} @ ({r[3][0]:.1f},{r[3][1]:.1f})ft [A={r[5]} B={r[6]}]')
inside = sum(1 for r in rows if r[4] > 0)
print(f'\n{inside}/{len(rows)} projected inside the court')
json.dump([{'t': round(r[1],1), 'frame': r[9], 'verdict': r[2], 'court_ft': [round(r[3][0],2), round(r[3][1],2)],
            'd_in': round(r[4],1), 'bounce': [round(r[7],4), round(r[8],4)], 'A': r[5], 'B': r[6]} for r in rows],
          open('/tmp/usopen_joins.json', 'w'), indent=1)
