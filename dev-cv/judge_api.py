# Judge endpoint worker: the CV referee's verdict on a placement, as the product
# gate would rule it. stdin: {"court": "court13", "corners": [[x,y]*4]}
# stdout: {"verdict": "PASS|PARTIAL|REJECT", "px": <mean px to paint>, "worst": "line px, ..."}
# Thresholds from the round-4 data: Tim's careful placements referee 0.7-2.9px.
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
    px, per = verify.score(img, corners.tolist())
    verdict = 'PASS' if px < 2.2 else 'PARTIAL' if px < 4.0 else 'REJECT'
    worst = sorted(((v, k) for k, v in per.items() if v is not None), reverse=True)[:2]
    print(json.dumps({'verdict': verdict, 'px': round(px, 2),
                      'worst': ', '.join(f'{k} {v}px' for v, k in worst)}))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'error': str(e)}))
