# Auto-calibration v5: line-assignment enumeration.
# Detect white LINE SEGMENTS (the paint itself, not the blue-pad edge), split them
# into two pencil families, then enumerate assignments (which detected line is
# which court line: cross y in {0,15,22,29,44}, long x in {0,10,20}), solve the
# homography from each assignment's 4 line intersections, referee every
# interpretation, polish the winners. Root-cause fix: line IDENTIFICATION was
# the source of all misses; this searches identifications instead of guessing one.
import cv2, itertools
import numpy as np
import auto2, verify

WT = '/Users/timcooley/whozin/.claude/worktrees/keen-germain-c2e4ef'
CROSS_Y = [0.0, 15.0, 22.0, 29.0, 44.0]
LONG_X = [0.0, 10.0, 20.0]

def detect_lines(lm, w, h):
    """HoughLinesP on the white-line mask -> merged infinite lines with support."""
    segs = cv2.HoughLinesP(lm, 1, np.pi / 360, threshold=40,
                           minLineLength=int(min(w, h) * 0.10), maxLineGap=int(min(w, h) * 0.02))
    if segs is None: return []
    lines = []  # (rho, theta, support)
    for x1, y1, x2, y2 in segs.reshape(-1, 4).astype(float):
        theta = np.arctan2(y2 - y1, x2 - x1) % np.pi          # segment direction
        nt = (theta + np.pi / 2) % np.pi                       # normal angle
        rho = x1 * np.cos(nt) + y1 * np.sin(nt)
        length = np.hypot(x2 - x1, y2 - y1)
        merged = False
        for i, (r, t, s) in enumerate(lines):
            dt = min(abs(nt - t), np.pi - abs(nt - t))
            if dt < 0.035 and abs(rho - r) < min(w, h) * 0.02:
                wsum = s + length
                lines[i] = ((r * s + rho * length) / wsum, t if dt < 1e-9 else (t * s + nt * length) / wsum, wsum)
                merged = True; break
        if not merged: lines.append((rho, nt, length))
    lines.sort(key=lambda l: -l[2])
    return lines[:14]

def two_families(lines):
    """Cluster line normal-angles into two groups on the doubled-angle circle."""
    if len(lines) < 4: return [], []
    ang = np.array([t for _, t, _ in lines])
    pts = np.c_[np.cos(2 * ang), np.sin(2 * ang)].astype(np.float32)
    _, lab, _ = cv2.kmeans(pts, 2, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 1e-4),
                           5, cv2.KMEANS_PP_CENTERS)
    lab = lab.ravel()
    A = [l for l, k in zip(lines, lab) if k == 0]
    B = [l for l, k in zip(lines, lab) if k == 1]
    return A, B

def h_from_lines(longs, lxs, crosses, cys, w, h):
    """Homography from 2 long lines (model x=lxs) + 2 cross lines (model y=cys)
    via their 4 intersections (model coords (x_i, y_j))."""
    P = []
    for (r1, t1, _) in longs:
        for (r2, t2, _) in crosses:
            A = np.array([[np.cos(t1), np.sin(t1)], [np.cos(t2), np.sin(t2)]])
            if abs(np.linalg.det(A)) < 1e-9: return None
            P.append(np.linalg.solve(A, [r1, r2]))
    dst = np.array(P)                     # order: (x0,y0),(x0,y1),(x1,y0),(x1,y1)
    if np.any(np.abs(dst) > 6 * max(w, h)): return None
    src = np.array([[lxs[0], cys[0]], [lxs[0], cys[1]], [lxs[1], cys[0]], [lxs[1], cys[1]]], float)
    Hm, _ = cv2.findHomography(src, dst)
    return Hm

def quick_score(Hm, DT, w, h):
    """Mean capped DT over sampled points of 5 key model lines (fast prescreen)."""
    ls = [(0, 0, 20, 0), (0, 44, 20, 44), (0, 15, 20, 15), (0, 29, 20, 29), (0, 0, 0, 44), (20, 0, 20, 44)]
    tot, cnt = 0.0, 0
    for x1, y1, x2, y2 in ls:
        t = np.linspace(0, 1, 9)
        P = np.c_[x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, np.ones(9)]
        Q = (Hm @ P.T).T
        with np.errstate(all='ignore'):
            Q = Q[:, :2] / Q[:, 2:3]
        inb = np.isfinite(Q).all(1) & (Q[:, 0] >= 0) & (Q[:, 0] < w) & (Q[:, 1] >= 0) & (Q[:, 1] < h)
        if inb.sum():
            tot += np.minimum(DT[Q[inb][:, 1].astype(int), Q[inb][:, 0].astype(int)], 10.0).sum()
            cnt += int(inb.sum())
    if cnt < 20: return 99.0
    return tot / cnt

def corners_from_H(Hm):
    src = np.array([[0, 0, 1], [20, 0, 1], [20, 44, 1], [0, 44, 1]], float)
    Q = (Hm @ src.T).T
    return (Q[:, :2] / Q[:, 2:3])

def coverage(shape, corners_px, court_px):
    h, w = shape[:2]
    Hm, _ = cv2.findHomography(verify.CC, corners_px)
    if Hm is None: return 0.0
    canvas = np.zeros((h, w), np.uint8)
    for x1, y1, x2, y2 in verify.LINES:
        t = np.linspace(0, 1, 30)
        P = np.c_[x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, np.ones(30)]
        Q = (Hm @ P.T).T
        with np.errstate(all='ignore'):
            Q = (Q[:, :2] / Q[:, 2:3])
        Q = Q[np.isfinite(Q).all(1)].astype(int)
        for i in range(len(Q) - 1):
            if np.all(np.abs(Q[i]) < 4 * max(w, h)) and np.all(np.abs(Q[i + 1]) < 4 * max(w, h)):
                cv2.line(canvas, tuple(Q[i]), tuple(Q[i + 1]), 255, 2)
    if not canvas.any(): return 0.0
    DT = cv2.distanceTransform(255 - canvas, cv2.DIST_L2, 5)
    ys, xs = np.nonzero(court_px)
    if not len(ys): return 0.0
    return float((DT[ys, xs] < 5).mean())

def run(n, return_all=False):
    p = f'{WT}/public/sim/court{n:02d}.jpg'
    img = cv2.imread(p); h, w = img.shape[:2]
    blue = auto2.blue_mask(img)
    if blue is None: return None, 'REJECT: no court found', None
    lm = auto2.line_mask(img, blue)
    court_px = cv2.bitwise_and(lm, cv2.dilate(blue, np.ones((15, 15), np.uint8)))
    DT = cv2.distanceTransform(255 - lm, cv2.DIST_L2, 5)

    lines = detect_lines(lm, w, h)
    A, B = two_families(lines)
    if len(A) < 2 or len(B) < 2: return None, f'REJECT: line families thin ({len(A)}/{len(B)})', None

    cands = []
    for longs_f, cross_f in ((A, B), (B, A)):    # either cluster could be either family
        for lpair in itertools.combinations(longs_f[:5], 2):
            for cpair in itertools.combinations(cross_f[:6], 2):
                for lxs in itertools.permutations(LONG_X, 2):
                    for cys in itertools.permutations(CROSS_Y, 2):
                        Hm = h_from_lines(lpair, lxs, cpair, cys, w, h)
                        if Hm is None: continue
                        q = corners_from_H(Hm)
                        if not np.isfinite(q).all() or np.any(np.abs(q) > 6 * max(w, h)): continue
                        area = cv2.contourArea(q.astype(np.float32))
                        if area < 0.03 * w * h: continue
                        cands.append((quick_score(Hm, DT, w, h), q))
    if not cands: return None, 'REJECT: no consistent interpretation', None
    cands.sort(key=lambda c: c[0])

    # dedup + full referee on the shortlist, polish the top interpretations
    seen, short = [], []
    for qs, q in cands:
        if qs > 6.0 or len(short) >= 8: break
        if any(np.abs(q - s).max() < 0.02 * max(w, h) for s in seen): continue
        seen.append(q); short.append(q)
    best = None
    allc = []
    for q in short:
        try:
            ref = auto2.polish(img, q, lm, bnd=0.035)
        except Exception:
            continue
        allc.append(np.asarray(ref))
        rsc, _ = verify.score(img, ref.tolist())
        cov = coverage(img.shape, np.asarray(ref) * [w, h], court_px)
        sc, per = auto2.score_lm(img, ref.tolist(), lm)
        interior = [v for k, (st, v) in per.items()
                    if k in ('net', 'far kitch', 'near kitch', 'ctr back', 'ctr front') and st == 'in']
        iok = len(interior) >= 3 and sum(1 for v in interior if v < 4.5) >= max(3, len(interior) - 1)
        key = (0 if iok else 1, rsc + 8.0 * (1.0 - cov))
        if best is None or key < best[0]: best = (key, ref, rsc, cov, per, iok)
    if return_all: return allc
    if best is None: return None, 'REJECT: no fit converged', None
    _, ref, rsc, cov, per, iok = best
    maxcov = cov
    off = [k for k, (st, v) in per.items() if st == 'off-frame']
    if not iok: v = 'REJECT (interior unsupported)'
    elif rsc < 2.2 and cov > 0.45: v = 'ACCEPT' + (f' (limits: {",".join(off)} off-frame)' if off else '')
    elif rsc < 4.0: v = 'LIMITS'
    else: v = 'REJECT'
    return ref, f'{v}  referee={rsc:.2f}px cov={cov:.2f} tried={len(cands)}', per

if __name__ == '__main__':
    from eval_auto import evaluate
    evaluate(run)
