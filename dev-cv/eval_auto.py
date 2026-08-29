# Eval the auto pipeline against Tim's referee-confirmed ground truth.
# Metric = the sim's visible-line symmetric chamfer (label/rotation-proof), in px.
import json, sys, cv2
import numpy as np
import verify

WT = '/Users/timcooley/whozin/.claude/worktrees/keen-germain-c2e4ef'
GT = json.load(open(WT + '/dev-cv/tim_ground_truth.json'))

def vis_points(corners, w, h):
    Hm, _ = cv2.findHomography(verify.CC, np.array(corners, float) * [w, h])
    if Hm is None: return np.zeros((0, 2))
    pts = []
    for x1, y1, x2, y2 in verify.LINES:
        t = np.linspace(0, 1, 21)
        P = np.c_[x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, np.ones(21)]
        Q = (Hm @ P.T).T; Q = Q[:, :2] / Q[:, 2:3]
        inb = (Q[:, 0] >= 0) & (Q[:, 0] < w) & (Q[:, 1] >= 0) & (Q[:, 1] < h)
        pts.append(Q[inb])
    return np.vstack(pts) if pts else np.zeros((0, 2))

def chamfer_px(qa, qb, w, h):
    A, B = vis_points(qa, w, h), vis_points(qb, w, h)
    if not len(A) or not len(B): return 999.0
    def d(P, Q):
        return float(np.mean([np.min(np.hypot(*(Q - p).T)) for p in P]))
    return (d(A, B) + d(B, A)) / 2

def evaluate(run_fn, courts=(13, 14, 15, 16, 17, 20, 22, 23, 24), quiet=False):
    rows = []
    for n in courts:
        url = f'/sim/court{n:02d}.jpg'
        img = cv2.imread(WT + '/public/sim' + url[4:])
        h, w = img.shape[:2]
        gt = GT[url]['corners']
        try:
            ref, msg, per = run_fn(n)
        except Exception as e:
            ref, msg = None, f'ERROR: {e}'
        if ref is None:
            rows.append((n, None, msg))
            if not quiet: print(f'court{n:02d}: {msg}  (no quad)')
            continue
        err = chamfer_px(np.asarray(ref).tolist(), gt, w, h)
        gt_ref, _ = verify.score(img, gt)
        au_ref, _ = verify.score(img, np.asarray(ref).tolist())
        rows.append((n, err, msg))
        if not quiet: print(f'court{n:02d}: vsTim={err:6.1f}px  referee auto={au_ref:.2f} tim={gt_ref:.2f}  {msg}')
    good = [e for _, e, _ in rows if e is not None]
    locks = sum(1 for e in good if e < 8)
    if not quiet: print(f'-- quads on {len(good)}/{len(rows)} courts, locks(<8px vs Tim): {locks}')
    return rows

if __name__ == '__main__':
    import auto2
    evaluate(auto2.run)
