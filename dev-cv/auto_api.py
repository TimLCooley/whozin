# Setup-calibration worker: full-auto court read, no seed, no ground truth.
# stdin:  {"court": "court13"}
# stdout: {"corners": [[x,y]*4]} or {"error": "..."}
# Pools candidates from auto2 (blue-quad), auto3 (multi-hypothesis) and auto4
# (line-assignment enumeration); selects by referee + coverage + blue-IoU +
# detected-line agreement, with degenerate-quad filtering.
import sys, json
import cv2
import numpy as np
import auto2, auto3, auto4, verify, vps

WT = '/'.join(__file__.split('/')[:-2])

def seg_agree(corners, segs, w, h, tol_deg=2.5):
    """Tile-grid vote: fraction of seam-segment length pointing at the candidate's
    own two vanishing points. Tile seams are parallel to the court axes, so a
    correct homography agrees with the seam grid ~2x more than a decoy fit."""
    Hm, _ = cv2.findHomography(verify.CC, np.array(corners, float) * [w, h])
    if Hm is None: return 0.0
    vp1 = Hm @ [1, 0, 0]; vp2 = Hm @ [0, 1, 0]
    tot = ok = 0.0
    for x1, y1, x2, y2 in segs:
        m = np.array([(x1 + x2) / 2, (y1 + y2) / 2])
        d = np.array([x2 - x1, y2 - y1]); l = np.hypot(*d)
        if l < 1: continue
        d = d / l
        good = False
        for vp in (vp1, vp2):
            v = np.array([vp[0] - m[0] * vp[2], vp[1] - m[1] * vp[2]])
            nv = np.hypot(*v)
            if nv < 1e-9: continue
            cosang = abs(np.dot(d, v / nv))
            if np.degrees(np.arccos(np.clip(cosang, 0, 1))) < tol_deg: good = True; break
        tot += l
        if good: ok += l
    return ok / tot if tot else 0.0

def sane(q):
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

def lineagree(corners, det, w, h):
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

def detected_line_quads(img, blue, lm, court_px, det, w, h):
    """Court hypotheses built from the DETECTED PAINT LINES themselves: every
    4-line subset, every opposite-pairing, prescreened by paint coverage, then
    polished. This (not the blue-pad boundary) is what solved court01 — the grid
    gets attached to the lines, not laid near them."""
    import itertools
    cnt = cv2.findNonZero(blue); cx, cy = cnt.reshape(-1, 2).mean(0)
    quads = []
    for combo in itertools.combinations(det[:10], 4):
        lines4 = [(r, t) for r, t, _ in combo]
        for opp in [((0, 1), (2, 3)), ((0, 2), (1, 3)), ((0, 3), (1, 2))]:
            (a, b), (c, d) = opp
            pts = [auto3.isect(lines4[a], lines4[c]), auto3.isect(lines4[a], lines4[d]),
                   auto3.isect(lines4[b], lines4[d]), auto3.isect(lines4[b], lines4[c])]
            if any(p is None for p in pts): continue
            q = np.array(pts)
            if np.any(np.abs(q) > 4 * max(w, h)): continue
            if cv2.pointPolygonTest(q.astype(np.float32), (float(cx), float(cy)), False) < 0: continue
            qn = auto3.order_ccw(q) / [w, h]
            if sane(qn): quads.append(qn)
    pres = [(auto4.coverage(img.shape, q * [w, h], court_px), q) for q in quads]
    pres.sort(key=lambda x: -x[0])
    out = []
    for _, q in pres[:10]:
        for roll in (0, 1):
            try:
                out.append(np.asarray(auto2.polish(img, np.roll(q, roll, axis=0) * [w, h], lm, bnd=0.03)))
            except Exception:
                pass
    return out

def main():
    req = json.load(sys.stdin)
    name = ''.join(ch for ch in str(req['court']) if ch.isalnum())
    n = int(''.join(ch for ch in name if ch.isdigit()))
    img = cv2.imread(f'{WT}/public/sim/{name}.jpg')
    if img is None:
        print(json.dumps({'error': 'unknown court'})); return
    h, w = img.shape[:2]
    blue = auto2.blue_mask(img)
    if blue is None:
        print(json.dumps({'error': 'no court region found'})); return
    lm = auto2.line_mask(img, blue)
    court_px = cv2.bitwise_and(lm, cv2.dilate(blue, np.ones((15, 15), np.uint8)))
    det = auto4.detect_lines(lm, w, h)
    pool = detected_line_quads(img, blue, lm, court_px, det, w, h)
    try:
        ref, _, _ = auto2.run(n)
        if ref is not None: pool.append(np.asarray(ref))
    except Exception:
        pass
    for mod in (auto3, auto4):
        try:
            r = mod.run(n, return_all=True)
            if isinstance(r, list): pool += [np.asarray(q) for q in r]
        except Exception:
            pass
    segs = vps.segments(img, blue)
    best = None
    for q in pool:
        if not sane(q): continue
        rsc, _ = verify.score(img, q.tolist())
        cov = auto4.coverage(img.shape, q * [w, h], court_px)
        iou = iou_blue(q.tolist(), blue, w, h)
        la = lineagree(q.tolist(), det, w, h)
        sa = seg_agree(q.tolist(), segs, w, h)
        # coverage dominates (most truth-correlated signal); tile-seam agreement
        # is the second-strongest (truth ~2x decoys); line-agreement weak tiebreak
        key = rsc + 10.0 * (1.0 - cov) + 4.0 * (1.0 - min(iou / 0.65, 1.0)) - 3.0 * sa - 0.2 * la
        if best is None or key < best[0]: best = (key, q)
    if best is None:
        print(json.dumps({'error': 'no calibration found — needs manual corners'})); return
    print(json.dumps({'corners': np.round(best[1], 5).tolist()}))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'error': str(e)}))
