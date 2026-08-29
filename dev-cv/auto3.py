# Auto-calibration v4:
#  - family-aware boundary picking (2+2 lines across two angle clusters; the old
#    greedy top-4 grabbed 4 parallel lines on wide views like c20/c22)
#  - multi-hypothesis seeding (rolls x inward apron shrinks x synth-line margins)
#    scored by the independent geometry referee (verify.score), then interior-gated.
import cv2, numpy as np
import itertools
import auto2, verify

def ang_dist(a, b):
    d = abs(a - b) % np.pi
    return min(d, np.pi - d)

def boundary_lines(blue, w, h, want=12):
    grad = cv2.morphologyEx(blue, cv2.MORPH_GRADIENT, np.ones((5, 5), np.uint8))
    grad[:6, :] = 0; grad[-6:, :] = 0; grad[:, :6] = 0; grad[:, -6:] = 0
    ls = cv2.HoughLines(grad, 1, np.pi / 360, threshold=int(min(w, h) * 0.05))
    if ls is None: return []
    ls = np.asarray(ls).reshape(-1, 2)
    picked = []
    for rho, theta in ls:  # NMS in (rho, theta), strongest first
        if all(not (ang_dist(theta, t2) < 0.10 and abs(abs(rho) - abs(r2)) < min(w, h) * 0.06)
               for r2, t2 in picked):
            picked.append((float(rho), float(theta)))
        if len(picked) >= want: break
    return picked

def pick_two_families(picked):
    """Split candidate lines into two angle clusters; return (famA, famB) strongest-first."""
    if len(picked) < 2: return picked, []
    a0 = picked[0][1]
    famA = [l for l in picked if ang_dist(l[1], a0) < 0.35]
    famB = [l for l in picked if ang_dist(l[1], a0) >= 0.35]
    return famA, famB

def isect(l1, l2):
    (r1, t1), (r2, t2) = l1, l2
    A = np.array([[np.cos(t1), np.sin(t1)], [np.cos(t2), np.sin(t2)]])
    if abs(np.linalg.det(A)) < 1e-9: return None
    return np.linalg.solve(A, [r1, r2])

def quad_from(lines, w, h, cx, cy):
    """Best quad from exactly 4 lines (2 per family assumed): try opposite-pairings."""
    best = None
    for opp in [((0, 1), (2, 3)), ((0, 2), (1, 3)), ((0, 3), (1, 2))]:
        (a, b), (c, d) = opp
        pts = [isect(lines[a], lines[c]), isect(lines[a], lines[d]),
               isect(lines[b], lines[d]), isect(lines[b], lines[c])]
        if any(p is None for p in pts): continue
        q = np.array(pts)
        if np.any(np.abs(q) > 4 * max(w, h)): continue
        if cv2.pointPolygonTest(q.astype(np.float32), (float(cx), float(cy)), False) < 0: continue
        area = cv2.contourArea(q.astype(np.float32))
        if best is None or area > best[0]: best = (area, q)
    return None if best is None else best[1]

def synth_lines(blue, w, h):
    """Candidate synthetic 4th boundary lines on the side the blue region runs off-frame."""
    touch = {'top': int(blue[0, :].sum()), 'bottom': int(blue[-1, :].sum()),
             'left': int(blue[:, 0].sum()), 'right': int(blue[:, -1].sum())}
    side = max(touch, key=touch.get)
    out = []
    for m in (0.04, 0.12, 0.25, 0.40):
        if side == 'bottom': out.append((h * (1 + m), np.pi / 2))
        elif side == 'top': out.append((-h * m, np.pi / 2))
        elif side == 'right': out.append((w * (1 + m), 0.0))
        else: out.append((-w * m, 0.0))
    return out

def shrink(quad, f):
    c = quad.mean(0)
    return c + (quad - c) * (1 - f)

def order_ccw(quad):
    c = quad.mean(0)
    ang = np.arctan2(quad[:, 1] - c[1], quad[:, 0] - c[0])
    return quad[np.argsort(ang)]

def coverage(shape, corners, court_px):
    """Fraction of the court's own white-line pixels (line mask inside the blue
    region) that the candidate's projected model lines explain (within 4px).
    Kills the collapsed-quad degeneracy: a shrunken fit touches white pixels
    everywhere it looks, but explains almost none of the court."""
    h, w = shape[:2]
    Hm, _ = cv2.findHomography(verify.CC, np.array(corners, float) * [w, h])
    if Hm is None: return 0.0
    canvas = np.zeros((h, w), np.uint8)
    for x1, y1, x2, y2 in verify.LINES:
        t = np.linspace(0, 1, 30)
        P = np.c_[x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, np.ones(30)]
        Q = (Hm @ P.T).T; Q = (Q[:, :2] / Q[:, 2:3]).astype(int)
        for i in range(len(Q) - 1):
            a, b = Q[i], Q[i + 1]
            if np.all(np.abs(a) < 4 * max(w, h)) and np.all(np.abs(b) < 4 * max(w, h)):
                cv2.line(canvas, tuple(a), tuple(b), 255, 1)
    if not canvas.any(): return 0.0
    DT = cv2.distanceTransform(255 - canvas, cv2.DIST_L2, 5)
    ys, xs = np.nonzero(court_px)
    if not len(ys): return 0.0
    return float((DT[ys, xs] < 4).mean())

def run(n, return_all=False):
    p = f'/Users/timcooley/whozin/.claude/worktrees/keen-germain-c2e4ef/public/sim/court{n:02d}.jpg'
    img = cv2.imread(p); h, w = img.shape[:2]
    blue = auto2.blue_mask(img)
    if blue is None: return None, 'REJECT: no court found', None
    lm = auto2.line_mask(img, blue)
    cnt = cv2.findNonZero(blue); cx, cy = cnt.reshape(-1, 2).mean(0)

    famA, famB = pick_two_families(boundary_lines(blue, w, h))
    quads = []
    if len(famA) >= 2 and len(famB) >= 2:
        # a few combos from the strongest of each family
        for a in itertools.combinations(famA[:3], 2):
            for b in itertools.combinations(famB[:3], 2):
                q = quad_from(list(a) + list(b), w, h, cx, cy)
                if q is not None: quads.append(q)
    if len(famA) >= 2 and len(famB) >= 1:
        # clipped view: one family lost a line — synthesize the 4th at several margins
        for s in synth_lines(blue, w, h):
            q = quad_from(list(famA[:2]) + [famB[0], s], w, h, cx, cy)
            if q is not None: quads.append(q)
    if not quads: return None, 'REJECT: boundary lines not found', None

    # dedup near-identical quads (by corner set distance)
    uniq = []
    for q in quads:
        q = order_ccw(q)
        if all(np.abs(q - u).max() > 0.01 * max(w, h) for u in uniq): uniq.append(q)
    uniq = uniq[:6]

    court_px = cv2.bitwise_and(lm, cv2.dilate(blue, np.ones((15, 15), np.uint8)))
    allc = []
    best = None
    for q in uniq:
        for f in (0.0, 0.03, 0.06):
            for roll in (0, 1):
                seed = np.roll(shrink(q, f), roll, axis=0)
                try:
                    ref = auto2.polish(img, seed, lm, bnd=0.07)
                except Exception:
                    continue
                rscore, _ = verify.score(img, ref.tolist())  # independent referee
                cov = coverage(img.shape, ref.tolist(), court_px)
                sc, per = auto2.score_lm(img, ref.tolist(), lm)
                interior = [v for k, (st, v) in per.items()
                            if k in ('net', 'far kitch', 'near kitch', 'ctr back', 'ctr front') and st == 'in']
                iok = len(interior) >= 3 and sum(1 for v in interior if v < 4.5) >= max(3, len(interior) - 1)
                key = (0 if iok else 1, rscore + 8.0 * (1.0 - cov))
                allc.append(np.asarray(ref))
                if best is None or key < best[0]: best = (key, ref, rscore, cov, per, iok)
    if return_all: return allc
    if best is None: return None, 'REJECT: no fit converged', None
    _, ref, rscore, cov, per, iok = best
    off = [k for k, (st, v) in per.items() if st == 'off-frame']
    if not iok: v = 'REJECT (interior unsupported)'
    elif cov < 0.55: v = 'REJECT (low coverage)'
    elif rscore < 2.2 and cov > 0.75: v = 'ACCEPT' + (f' (limits: {",".join(off)} off-frame)' if off else '')
    elif rscore < 4.0: v = 'LIMITS'
    else: v = 'REJECT'
    return ref, f'{v}  referee={rscore:.2f}px cov={cov:.2f}  cands={len(uniq)}', per

if __name__ == '__main__':
    from eval_auto import evaluate
    evaluate(run)
