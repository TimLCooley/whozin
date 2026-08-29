# Judge worker: the CV's verdict on a line assignment, in Tim's terms —
# coverage % = fraction of projected court-line points sitting on detected paint
# (within 3px). Gate (Tim's spec): 100% ACCEPT · 98-100 PARTIAL (warn) · <98 REJECT.
# stdin:  {"court": "court13", "corners": [[x,y]*4]}
# stdout: {"verdict", "coverage": 98.7, "px": <mean px to paint>, "worst": "..."}
import sys, json
import cv2
import numpy as np
import verify

def main():
    req = json.load(sys.stdin)
    name = ''.join(ch for ch in str(req['court']) if ch.isalnum())
    img = cv2.imread(f"{'/'.join(__file__.split('/')[:-2])}/public/sim/{name}.jpg")
    if img is None:
        print(json.dumps({'error': 'unknown court'})); return
    corners = np.array(req['corners'], float)
    if corners.shape != (4, 2):
        print(json.dumps({'error': 'need 4 corners'})); return
    h, w = img.shape[:2]
    m = verify.white_mask(img)
    DT = cv2.distanceTransform(255 - m, cv2.DIST_L2, 5)
    H, _ = cv2.findHomography(verify.CC, corners * [w, h])
    names = ['far base', 'right side', 'near base', 'left side', 'net', 'far kitch', 'near kitch', 'ctr back', 'ctr front']
    hits, total, dists = 0, 0, []
    per = {}
    for (x1, y1, x2, y2), nm in zip(verify.LINES, names):
        t = np.linspace(0, 1, 30)
        P = np.c_[x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, np.ones(30)]
        Q = (H @ P.T).T; Q = Q[:, :2] / Q[:, 2:3]
        inb = (Q[:, 0] >= 0) & (Q[:, 0] < w) & (Q[:, 1] >= 0) & (Q[:, 1] < h)
        if inb.sum() < 3: continue
        d = DT[Q[inb][:, 1].astype(int), Q[inb][:, 0].astype(int)]
        hits += int((d < 3.0).sum()); total += int(inb.sum())
        dists.append(np.minimum(d, 6.0))
        per[nm] = round(float((d < 3.0).mean()) * 100, 1)
    if not total:
        print(json.dumps({'error': 'court not in frame'})); return
    coverage = 100.0 * hits / total
    px = float(np.concatenate(dists).mean())
    verdict = 'ACCEPT' if coverage >= 99.5 else 'PARTIAL' if coverage >= 98.0 else 'REJECT'
    worst = sorted(per.items(), key=lambda kv: kv[1])[:2]
    print(json.dumps({'verdict': verdict, 'coverage': round(coverage, 1), 'px': round(px, 2),
                      'worst': ', '.join(f'{k} {v}%' for k, v in worst)}))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'error': str(e)}))
