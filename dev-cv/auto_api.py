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

def court_region(img):
    """Color-AGNOSTIC court segmentation, broadcast-style (Tim's football note):
    sample the dominant ground colors from the central/lower frame (the way
    1st&Ten keys the field with sampled palettes rather than assuming green),
    build a region per dominant color mode, and pick the region that CONTAINS
    the white paint — any surface color works, and the lawn/apron loses because
    the lines aren't on it."""
    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    H, S, V = hsv[:, :, 0].astype(int), hsv[:, :, 1].astype(int), hsv[:, :, 2].astype(int)
    wm = verify.white_mask(img)
    # dominant color modes from the central band (skip sky/top 25%)
    ys, xs = np.mgrid[int(h * 0.25):h:6, 0:w:6]
    bins = {}
    for y, x in zip(ys.ravel(), xs.ravel()):
        s, v, hh = S[y, x], V[y, x], H[y, x]
        key = ('c', hh // 12, min(s // 80, 2)) if s > 45 else ('g', v // 45)
        bins[key] = bins.get(key, 0) + 1
    best = None
    for key, cnt in sorted(bins.items(), key=lambda kv: -kv[1])[:5]:
        if key[0] == 'c':
            _, hb, sb = key
            cond = (np.abs(((H - (hb * 12 + 6)) + 90) % 180 - 90) <= 9) & (S > 45) & \
                   (np.abs(S - (sb * 80 + 40)) <= 90)
        else:
            _, vb = key
            cond = (S <= 45) & (np.abs(V - (vb * 45 + 22)) <= 34)
        m = cv2.morphologyEx(cond.astype(np.uint8) * 255, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
        num, lab, stats, _ = cv2.connectedComponentsWithStats(m)
        for i in range(1, num):
            if stats[i, cv2.CC_STAT_AREA] < 0.02 * m.size: continue
            comp = (lab == i).astype(np.uint8) * 255
            paint = int(cv2.bitwise_and(wm, cv2.dilate(comp, np.ones((21, 21), np.uint8))).sum() // 255)
            if best is None or paint > best[0]: best = (paint, comp)
    return best[1] if best and best[0] > 300 else None

def refine_with_junctions(img, q, lm, det, court_px, w, h):
    """PnLCalib-style points+lines finish: the winning candidate's 12 projected
    model keypoints get matched to nearby DETECTED typed junctions; with 4+
    matches the homography is re-solved from those point pairs and re-polished.
    Anchors CORNERS (the pin metric) instead of trusting line-overlap alone —
    line scoring lets corners drift, especially extrapolated ones."""
    import junctions as jx
    js = jx.detect_junctions(det, lm, w, h)
    if not js: return q
    Hm, _ = cv2.findHomography(verify.CC, np.array(q) * [w, h])
    if Hm is None: return q
    src, dst = [], []
    for mx, my, mt in jx.MODEL_JUNCTIONS:
        P = Hm @ [mx, my, 1.0]
        if abs(P[2]) < 1e-9: continue
        px, py = P[0] / P[2], P[1] / P[2]
        if not (0 <= px < w and 0 <= py < h): continue
        best = None
        for jxp, jyp, jt, _ in js:
            if jt == 'X': continue
            if (mt == 'L') != (jt == 'L'): continue
            dd = np.hypot(px - jxp, py - jyp)
            if dd < 0.035 * min(w, h) and (best is None or dd < best[0]): best = (dd, jxp, jyp)
        if best: src.append([mx, my]); dst.append([best[1], best[2]])
    if len(src) < 4: return q
    H2, _ = cv2.findHomography(np.array(src, float), np.array(dst, float))
    if H2 is None: return q
    C = np.array([[0, 0, 1], [20, 0, 1], [20, 44, 1], [0, 44, 1]], float)
    Q = (H2 @ C.T).T
    with np.errstate(all='ignore'):
        Q = Q[:, :2] / Q[:, 2:3]
    if not np.isfinite(Q).all() or np.any(np.abs(Q) > 6 * max(w, h)): return q
    q2 = Q / [w, h]
    if not sane(q2): return q
    try:
        q2 = np.asarray(auto2.polish(img, q2 * [w, h], lm, bnd=0.02))
    except Exception:
        return q
    # accept only if the anchored fit still explains the paint
    if auto4.coverage(img.shape, q2 * [w, h], court_px) < 0.85 * auto4.coverage(img.shape, np.array(q) * [w, h], court_px):
        return q
    return q2

def main():
    req = json.load(sys.stdin)
    name = ''.join(ch for ch in str(req['court']) if ch.isalnum() or ch in '-_')
    is_live = name.startswith('live-')
    n = 0 if is_live else int(''.join(ch for ch in name if ch.isdigit()) or 0)
    img = cv2.imread(f'{WT}/public/sim/live/{name[5:]}.jpg' if is_live else f'{WT}/public/sim/{name}.jpg')
    if img is None:
        print(json.dumps({'error': 'unknown court'})); return
    h, w = img.shape[:2]
    # court region = whichever candidate contains the most white paint:
    # the proven blue mask vs the color-agnostic dominant-color region
    wm0 = verify.white_mask(img)
    wm0[:int(h * 0.30), :] = 0  # clouds are bright+low-S too; court paint isn't in the sky
    def paint_in(region):
        if region is None: return -1
        return int(cv2.bitwise_and(wm0, cv2.dilate(region, np.ones((21, 21), np.uint8))).sum() // 255)
    cand_b = auto2.blue_mask(img)
    # blue is the proven default; the color-agnostic region takes over only on a
    # decisive paint ratio (3x) — and NEVER against a solid blue court: indoor
    # gray floors are bright+low-S, so raw "paint" counts lie there (park bug)
    pb = paint_in(cand_b)
    blue_solid = cand_b is not None and (cand_b > 0).mean() >= 0.08 and pb >= 3000
    cand_c = None if blue_solid else court_region(img)
    blue = cand_c if cand_c is not None and paint_in(cand_c) > 3.0 * max(pb, 1) else cand_b
    if blue is None:
        print(json.dumps({'error': 'no court region found'})); return
    lm = auto2.line_mask(img, blue)
    if (lm > 0).sum() < 1500:
        # dull/shadowed paint (e.g. c02): retry with relaxed thresholds
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV); S, V = hsv[:, :, 1], hsv[:, :, 2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        k = max(21, int(w * 0.03) | 1)
        th2 = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
        m2 = (((S < 95) & (V > 115)) & (th2 > 14)).astype(np.uint8) * 255
        near = cv2.dilate(blue, np.ones((int(w * 0.03) | 1, int(w * 0.03) | 1), np.uint8))
        relaxed = cv2.bitwise_and(m2, near)
        if (relaxed > 0).sum() > (lm > 0).sum(): lm = relaxed
    if (lm > 0).sum() < 1500:
        # region yielded no usable paint (c02-class): switch to the color-agnostic
        # region and rebuild the line mask around it
        alt = court_region(img)
        if alt is not None:
            alt_lm = auto2.line_mask(img, alt)
            if (alt_lm > 0).sum() > (lm > 0).sum():
                blue, lm = alt, alt_lm
    court_px = cv2.bitwise_and(lm, cv2.dilate(blue, np.ones((15, 15), np.uint8)))
    det = auto4.detect_lines(lm, w, h)
    pool = detected_line_quads(img, blue, lm, court_px, det, w, h)
    # Tim's "12 easy detectable things": typed junctions (4 corners L + 8 Ts).
    # Any 4 visible junctions calibrate the court — corners not required.
    try:
        import junctions as jx
        js = jx.detect_junctions(det, lm, w, h)
        jcands = jx.junction_homographies(js, w, h)
        if jcands:
            # dedup, then prescreen ALL by coverage at half resolution (quick DT
            # scores are decoy-gameable and were cutting the right candidate)
            uniq = []
            for q in jcands:
                q = np.asarray(q)
                if all(np.abs(q - u).max() > 0.015 for u in uniq): uniq.append(q)
            h2, w2 = h // 2, w // 2
            cp2 = cv2.resize(court_px, (w2, h2), interpolation=cv2.INTER_NEAREST)
            shape2 = (h2, w2)
            pres = sorted(((auto4.coverage(shape2, q * [w2, h2], cp2), q) for q in uniq), key=lambda x: -x[0])
            for _, q in pres[:8]:
                try: pool.append(np.asarray(auto2.polish(img, q * [w, h], lm, bnd=0.03)))
                except Exception: pass
    except Exception:
        pass
    if not is_live:  # legacy generators load by court number — sim courts only
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

    def court_cy(q):
        """Mean normalized y of the candidate's in-frame markers. The court is
        ON THE GROUND (Tim's gravity prior): a court living in the top of the
        frame is ceiling lights / fence tops / nonsense, never a court."""
        import junctions as _jx
        Hq, _ = cv2.findHomography(verify.CC, np.array(q, float) * [w, h])
        if Hq is None: return None
        ys = []
        for mx, my, _t in _jx.MODEL_JUNCTIONS:
            P = Hq @ [mx, my, 1.0]
            if abs(P[2]) < 1e-9: continue
            px, py = P[0] / P[2], P[1] / P[2]
            if 0 <= px < w and 0 <= py < h: ys.append(py / h)
        return float(np.mean(ys)) if ys else None

    best = None
    for q in pool:
        if not sane(q): continue
        cy = court_cy(q)
        if cy is None or cy < 0.30: continue  # court in top third of frame = not a court
        rsc, _ = verify.score(img, q.tolist())
        cov = auto4.coverage(img.shape, q * [w, h], court_px)
        iou = iou_blue(q.tolist(), blue, w, h)
        la = lineagree(q.tolist(), det, w, h)
        sa = seg_agree(q.tolist(), segs, w, h)
        # coverage dominates (most truth-correlated signal); tile-seam agreement
        # is the second-strongest (truth ~2x decoys); line-agreement weak tiebreak
        key = rsc + 10.0 * (1.0 - cov) + 4.0 * (1.0 - min(iou / 0.65, 1.0)) - 3.0 * sa - 0.2 * la \
              + 12.0 * max(0.0, 0.50 - cy)  # gravity prior: penalize high-in-frame courts
        if best is None or key < best[0]: best = (key, q)
    if best is None:
        print(json.dumps({'error': 'no calibration found — needs manual corners'})); return
    final = refine_with_junctions(img, best[1], lm, det, court_px, w, h)
    print(json.dumps({'corners': np.round(np.asarray(final), 5).tolist()}))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'error': str(e)}))
