# Snap endpoint worker: rough corners in -> polished corners out.
# stdin:  {"court": "court13", "corners": [[x,y],[x,y],[x,y],[x,y]]}  (normalized)
# stdout: {"corners": [[x,y]*4], "referee": <px>} or {"error": "..."}
import sys, json
import cv2
import numpy as np
import auto2, verify

def main():
    req = json.load(sys.stdin)
    name = ''.join(ch for ch in str(req['court']) if ch.isalnum() or ch in '-_')
    WT = '/'.join(__file__.split('/')[:-2])
    path = f'{WT}/public/sim/live/{name[5:]}.jpg' if name.startswith('live-') else f'{WT}/public/sim/{name}.jpg'
    img = cv2.imread(path)
    if img is None:
        print(json.dumps({'error': 'unknown court'})); return
    h, w = img.shape[:2]
    corners = np.array(req['corners'], float)
    if corners.shape != (4, 2):
        print(json.dumps({'error': 'need 4 corners'})); return
    blue = auto2.blue_mask(img)
    if blue is None:
        print(json.dumps({'error': 'no court region found'})); return
    lm = auto2.line_mask(img, blue)
    ref = auto2.polish(img, corners * [w, h], lm, bnd=0.05)
    rsc, _ = verify.score(img, np.asarray(ref).tolist())
    out = {'corners': np.round(np.asarray(ref), 5).tolist(), 'referee': round(rsc, 2)}
    # joint lens-distortion fit (division model) — Tim's kitchen warp test made
    # quantitative: ultra-wide (0.5x/0.7x) captures become fittable; k~0 on 1x
    try:
        import refine_dist as rd
        h2, w2 = img.shape[:2]
        q1, k, rms = rd.refine_dist(lm, (np.asarray(ref) * [w2, h2]).astype(float))
        out['k'] = round(float(k), 4)
        out['fit_rms'] = round(rms, 2)
        if 0.015 < abs(k) < 0.5 and rms < 3.5:  # |k|>=0.5 = optimizer junk, never real lens
            out['corners'] = np.round(q1 / [w2, h2], 5).tolist()
            out['distortion_corrected'] = True
    except Exception as e:
        out['k_error'] = str(e)[:60]
    print(json.dumps(out))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'error': str(e)}))
