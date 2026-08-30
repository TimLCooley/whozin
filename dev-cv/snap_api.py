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
    print(json.dumps({'corners': np.round(np.asarray(ref), 5).tolist(), 'referee': round(rsc, 2)}))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'error': str(e)}))
