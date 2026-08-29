# Oracle diagnostic: for each court, polish every candidate and report the best
# achievable vsTim (generation quality) vs what the selector actually picks.
import json, cv2, itertools
import numpy as np
import auto2, auto3, verify
from eval_auto import chamfer_px, GT

WT = '/Users/timcooley/whozin/.claude/worktrees/keen-germain-c2e4ef'

for n in (13, 14, 16, 17, 20, 22, 23, 24):
    url = f'/sim/court{n:02d}.jpg'
    img = cv2.imread(WT + '/public/sim' + url[4:]); h, w = img.shape[:2]
    gt = GT[url]['corners']
    blue = auto2.blue_mask(img)
    lm = auto2.line_mask(img, blue)
    cnt = cv2.findNonZero(blue); cx, cy = cnt.reshape(-1, 2).mean(0)
    famA, famB = auto3.pick_two_families(auto3.boundary_lines(blue, w, h))
    quads = []
    if len(famA) >= 2 and len(famB) >= 2:
        for a in itertools.combinations(famA[:3], 2):
            for b in itertools.combinations(famB[:3], 2):
                q = auto3.quad_from(list(a) + list(b), w, h, cx, cy)
                if q is not None: quads.append(q)
    if len(famA) >= 2 and len(famB) >= 1:
        for s in auto3.synth_lines(blue, w, h):
            q = auto3.quad_from(list(famA[:2]) + [famB[0], s], w, h, cx, cy)
            if q is not None: quads.append(q)
    uniq = []
    for q in quads:
        q = auto3.order_ccw(q)
        if all(np.abs(q - u).max() > 0.01 * max(w, h) for u in uniq): uniq.append(q)
    uniq = uniq[:6]
    court_px = cv2.bitwise_and(lm, cv2.dilate(blue, np.ones((15, 15), np.uint8)))
    # seed-quality: raw quads before polish
    seed_best = min((chamfer_px(q.tolist() / np.array([w, h]), gt, w, h) for q in uniq), default=999)
    rows = []
    for qi, q in enumerate(uniq):
        for f in (0.0, 0.03, 0.06):
            for roll in (0, 1):
                seed = np.roll(auto3.shrink(q, f), roll, axis=0)
                try: ref = auto2.polish(img, seed, lm, bnd=0.07)
                except Exception: continue
                err = chamfer_px(ref.tolist(), gt, w, h)
                rsc, _ = verify.score(img, ref.tolist())
                cov = auto3.coverage(img.shape, ref.tolist(), court_px)
                rows.append((err, rsc, cov, qi, f, roll))
    rows.sort()
    o = rows[0]
    maxcov = max(r[2] for r in rows)
    sel = min(rows, key=lambda r: r[1] + 8 * (1 - r[2]))
    print(f'c{n}: seeds={len(uniq)} rawSeedBest={seed_best:6.1f}px | oracle vsTim={o[0]:6.1f}px (q{o[3]} f={o[4]} r{o[5]}, ref={o[1]:.2f} cov={o[2]:.2f}) | picked vsTim={sel[0]:6.1f}px (ref={sel[1]:.2f} cov={sel[2]:.2f}) maxcov={maxcov:.2f}')
