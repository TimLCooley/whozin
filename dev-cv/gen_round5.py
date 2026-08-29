# Generate Claude's round-5 placements for courts 13-24 (1x only).
# Pool EVERY polished candidate from auto3 (blue-quad hypotheses) and auto4
# (line-assignment enumeration); select by referee + coverage + blue-IoU.
# No ground truth used in selection; vsTim printed for information only.
import json, cv2
import numpy as np
import auto2, auto3, auto4, verify
from eval_auto import chamfer_px, GT

WT = '/Users/timcooley/whozin/.claude/worktrees/keen-germain-c2e4ef'
COURTS = [13, 14, 15, 16, 17, 20, 22, 23, 24]

# Claude's round-4 reads (from the sim page) — the floor: never ship worse.
ROUND4 = {
    13: [[0.1019, 0.8530], [0.0592, 0.4280], [0.6254, 0.3993], [0.7313, 0.7196]],
    14: [[-0.0381, 1.0654], [0.3817, 0.2978], [0.6480, 0.3017], [1.0121, 0.7794]],
    15: [[0.3791, 0.3338], [0.6365, 0.3494], [0.9449, 0.9674], [-0.2155, 0.8455]],
    16: [[0.0070, 0.8444], [0.3643, 0.2714], [0.6434, 0.2892], [0.9690, 0.7969]],
    17: [[-0.1029, 0.9186], [0.3239, 0.2997], [0.6292, 0.3219], [1.0627, 0.8519]],
    20: [[0.3173, 0.3709], [0.7440, 0.4099], [0.7013, 1.0665], [-0.1094, 0.5379]],
    22: [[0.3599, 0.3400], [0.7999, 0.4198], [0.7500, 1.0500], [-0.1000, 0.5199]],
    23: [[0.0733, 0.4490], [0.4472, 0.4175], [0.9560, 0.5278], [0.0483, 0.6176]],
    24: [[0.2765, 0.3200], [0.6995, 0.3628], [0.8375, 0.7235], [0.0195, 0.5286]],
}

def lineagree(corners, det, w, h):
    """Support-weighted agreement between the fit's model lines and detected
    Hough lines. Real paint is line-shaped; reflections are blobs — a correct
    homography coincides with detected lines, a mask-gamed one doesn't."""
    Hm, _ = cv2.findHomography(verify.CC, np.array(corners, float) * [w, h])
    if Hm is None: return 0.0
    tot = 0.0
    for x1, y1, x2, y2 in verify.LINES:
        t = np.linspace(0, 1, 9)
        P = np.c_[x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, np.ones(9)]
        Q = (Hm @ P.T).T
        with np.errstate(all='ignore'):
            Q = Q[:, :2] / Q[:, 2:3]
        inb = np.isfinite(Q).all(1) & (Q[:, 0] >= 0) & (Q[:, 0] < w) & (Q[:, 1] >= 0) & (Q[:, 1] < h)
        if inb.sum() < 4: continue
        a, b = Q[inb][0], Q[inb][-1]
        d = b - a
        th = (np.arctan2(d[1], d[0]) + np.pi / 2) % np.pi
        rho = a[0] * np.cos(th) + a[1] * np.sin(th)
        bestsup = 0
        for r, t2, sup in det:
            dt = min(abs(th - t2), np.pi - abs(th - t2))
            rr = r if abs(th - t2) < 0.5 else -r
            if dt < 0.05 and abs(rho - rr) < 0.012 * min(w, h): bestsup = max(bestsup, sup)
        tot += min(bestsup, 3000)
    return tot / 1000.0

def sane(q):
    """Reject degenerate quads: near-coincident corners or non-convex/tiny."""
    q = np.asarray(q)
    for i in range(4):
        for j in range(i + 1, 4):
            if np.hypot(*(q[i] - q[j])) < 0.10: return False
    area = 0.5 * abs(np.cross(q[1] - q[0], q[2] - q[0])) + 0.5 * abs(np.cross(q[2] - q[0], q[3] - q[0]))
    return area > 0.04

def iou_blue(corners, blue, w, h):
    Hm, _ = cv2.findHomography(verify.CC, np.array(corners, float) * [w, h])
    if Hm is None: return 0.0
    src = np.array([[0, 0, 1], [20, 0, 1], [20, 44, 1], [0, 44, 1]], float)
    Q = (Hm @ src.T).T; Q = (Q[:, :2] / Q[:, 2:3])
    poly = np.zeros((h, w), np.uint8)
    cv2.fillPoly(poly, [np.clip(Q, -4 * max(w, h), 4 * max(w, h)).astype(np.int32)], 255)
    inter = cv2.bitwise_and(poly, blue); union = cv2.bitwise_or(poly, blue)
    u = (union > 0).sum()
    return (inter > 0).sum() / u if u else 0.0

out = {}
for n in COURTS:
    img = cv2.imread(f'{WT}/public/sim/court{n:02d}.jpg'); h, w = img.shape[:2]
    blue = auto2.blue_mask(img)
    lm = auto2.line_mask(img, blue) if blue is not None else None
    court_px = cv2.bitwise_and(lm, cv2.dilate(blue, np.ones((15, 15), np.uint8))) if blue is not None else None
    pool = [(np.array(ROUND4[n]), 'round4')]
    try:
        ref, _, _ = auto2.run(n)
        if ref is not None: pool.append((np.asarray(ref), 'auto2'))
    except Exception:
        pass
    for mod in (auto3, auto4):
        try:
            r = mod.run(n, return_all=True)
            if isinstance(r, list): pool += [(q, mod.__name__) for q in r]
        except Exception as e:
            print(f'c{n}: {mod.__name__} error {e}')
    det = auto4.detect_lines(lm, w, h)
    best = None
    r4key = None
    for q, srcname in pool:
        if not sane(q): continue
        rsc, _ = verify.score(img, q.tolist())
        cov = auto4.coverage(img.shape, q * [w, h], court_px)
        iou = iou_blue(q.tolist(), blue, w, h)
        la = lineagree(q.tolist(), det, w, h)
        key = rsc + 6.0 * (1.0 - cov) + 4.0 * (1.0 - min(iou / 0.65, 1.0)) - 0.5 * la
        if srcname == 'round4': r4key = (key, q, rsc, cov, iou, srcname)
        if best is None or key < best[0]: best = (key, q, rsc, cov, iou, srcname)
    # conservative prior: the selector's signals are gameable on wet frames, so
    # only abandon the round-4 belief for a candidate that beats it clearly
    if best is not None and r4key is not None and best[5] != 'round4' and best[0] > r4key[0] - 2.0:
        best = r4key
    if best is None:
        print(f'c{n}: NO CANDIDATE')
        continue
    _, q, rsc, cov, iou, srcname = best
    out[f'/sim/court{n:02d}.jpg'] = {'c': [{'x': round(float(x), 4), 'y': round(float(y), 4)} for x, y in q]}
    vs = chamfer_px(q.tolist(), GT[f'/sim/court{n:02d}.jpg']['corners'], w, h)
    print(f'c{n}: {srcname:5s} pool={len(pool):3d} referee={rsc:.2f} cov={cov:.2f} iou={iou:.2f}  vsTim={vs:6.1f}px')
json.dump(out, open('round5_claude.json', 'w'), indent=1)
print(f'wrote {len(out)} courts')
