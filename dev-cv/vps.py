# Tile-seam vanishing points: the modular-tile seams (and the paint) are parallel
# to the court axes, so every seam segment votes for one of two vanishing points.
# RANSAC those VPs from all detected segments, length-weighted. The VPs then act
# as a truth filter: any line claiming to be a court line must pass near one VP.
import cv2
import numpy as np

def segments(img, region):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    e = cv2.Canny(g, 40, 120)
    e = cv2.bitwise_and(e, cv2.dilate(region, np.ones((25, 25), np.uint8)))
    h, w = g.shape
    segs = cv2.HoughLinesP(e, 1, np.pi / 360, threshold=25,
                           minLineLength=int(min(w, h) * 0.04), maxLineGap=4)
    return [] if segs is None else segs.reshape(-1, 4).astype(float)

def seg_line(s):
    x1, y1, x2, y2 = s
    th = (np.arctan2(y2 - y1, x2 - x1) + np.pi / 2) % np.pi
    rho = x1 * np.cos(th) + y1 * np.sin(th)
    return rho, th, np.hypot(x2 - x1, y2 - y1)

def find_vps(img, region, iters=1500, seed=0):
    """Two dominant VPs, RANSAC over segment pairs, support = summed length of
    segments whose infinite line passes within tol of the VP."""
    segs = segments(img, region)
    if len(segs) < 10: return None, None, 0, 0
    L = np.array([seg_line(s) for s in segs])  # rho, theta, len
    h, w = img.shape[:2]
    tol = 0.006 * min(w, h)
    rng = np.random.default_rng(seed)
    def support(P):
        d = np.abs(np.cos(L[:, 1]) * P[0] + np.sin(L[:, 1]) * P[1] - L[:, 0])
        return L[d < tol, 2].sum(), d < tol
    def ransac(mask):
        idx = np.nonzero(mask)[0]
        if len(idx) < 4: return None, 0, np.zeros(len(L), bool)
        best = None
        for _ in range(iters):
            a, b = rng.choice(idx, 2, replace=False)
            A = np.array([[np.cos(L[a, 1]), np.sin(L[a, 1])], [np.cos(L[b, 1]), np.sin(L[b, 1])]])
            if abs(np.linalg.det(A)) < 1e-6: continue
            P = np.linalg.solve(A, [L[a, 0], L[b, 0]])
            if np.any(np.abs(P) > 60 * max(w, h)): continue
            s, inl = support(P)
            s = float((L[mask & inl, 2]).sum())
            if best is None or s > best[1]: best = (P, s, inl)
        return best if best else (None, 0, np.zeros(len(L), bool))
    all_mask = np.ones(len(L), bool)
    P1, s1, in1 = ransac(all_mask)
    if P1 is None: return None, None, 0, 0
    P2, s2, in2 = ransac(all_mask & ~in1)
    return P1, P2, s1, s2

def line_vp_dist(rho, theta, P):
    return abs(np.cos(theta) * P[0] + np.sin(theta) * P[1] - rho)

if __name__ == '__main__':
    import auto2, auto4, verify, re
    WT = '/'.join(__file__.split('/')[:-2])
    src = open(f'{WT}/src/app/app/lab/sim/page.tsx').read()
    TRUTH = {}
    for m in re.finditer(r"'/sim/(court\d+)\.jpg': \{ c: \[(.*?)\]", src):
        pts = re.findall(r'x: ([-\d.]+), y: ([-\d.]+)', m.group(2))
        TRUTH[m.group(1)] = [[float(x), float(y)] for x, y in pts]
    import json
    GT = json.load(open(f'{WT}/dev-cv/tim_ground_truth.json'))
    for u, v in GT.items(): TRUTH[u[5:12]] = v['corners']
    names = ['far base', 'right side', 'near base', 'left side', 'net', 'far kitch', 'near kitch', 'ctr back', 'ctr front']
    for name in ('court01', 'court05', 'court13', 'court15', 'court16', 'court23'):
        img = cv2.imread(f'{WT}/public/sim/{name}.jpg'); h, w = img.shape[:2]
        blue = auto2.blue_mask(img)
        if blue is None: print(f'{name}: no blue'); continue
        P1, P2, s1, s2 = find_vps(img, blue)
        if P1 is None: print(f'{name}: no VPs'); continue
        lm = auto2.line_mask(img, blue)
        det = auto4.detect_lines(lm, w, h)
        tol = 0.012 * min(w, h)
        # classify each detected paint line: consistent with a VP or decoy?
        Hm, _ = cv2.findHomography(verify.CC, np.array(TRUTH[name]) * [w, h])
        gtsegs = []
        for (x1, y1, x2, y2), nm in zip(verify.LINES, names):
            t = np.linspace(0, 1, 25); Pm = np.c_[x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, np.ones(25)]
            Q = (Hm @ Pm.T).T; Q = Q[:, :2] / Q[:, 2:3]
            inb = (Q[:, 0] >= 0) & (Q[:, 0] < w) & (Q[:, 1] >= 0) & (Q[:, 1] < h)
            gtsegs.append((nm, Q[inb]))
        keep_true = keep_noise = drop_true = drop_noise = 0
        for rho, th, sup in det:
            nvec = np.array([np.cos(th), np.sin(th)])
            bestd = min((np.abs(pts @ nvec - rho).mean() for nm, pts in gtsegs if len(pts) >= 3), default=99)
            is_true = bestd < 8
            ok = line_vp_dist(rho, th, P1) < tol or line_vp_dist(rho, th, P2) < tol
            if ok and is_true: keep_true += 1
            elif ok: keep_noise += 1
            elif is_true: drop_true += 1
            else: drop_noise += 1
        print(f'{name}: VP support {s1:.0f}/{s2:.0f} | kept {keep_true} true + {keep_noise} noise · dropped {drop_true} true + {drop_noise} noise')
