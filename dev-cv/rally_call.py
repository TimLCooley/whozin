# The CALL: track a clip, find bounce candidates (local maxima of image-y with
# a descent->ascent flip = ball meets ground), project each through the
# calibration, and rule IN/OUT with inch margins. Renders the verdict overlay.
# stdin: {"clip": path, "calib": [[x,y]*4], "out": overlay path}
import sys, json, subprocess
import cv2
import numpy as np

CC = np.array([[0, 0], [20, 0], [20, 44], [0, 44]], float)

def bounces(track):
    """Candidate bounces: local max of y (image, downward) where the ball was
    clearly descending then ascending."""
    out = []
    for j in range(2, len(track) - 2):
        f0, x0, y0 = track[j]
        vy_in = (track[j][2] - track[j - 2][2]) / max(1, track[j][0] - track[j - 2][0])
        vy_out = (track[j + 2][2] - track[j][2]) / max(1, track[j + 2][0] - track[j][0])
        if vy_in > 0.004 and vy_out < -0.004:  # normalized units/frame
            out.append((f0, x0, y0, vy_in - vy_out))
    out.sort(key=lambda b: -b[3])
    return out

def call_at(calib, w, h, bx, by):
    """Project a bounce point to court feet; verdict + inch margin scale."""
    Hm, _ = cv2.findHomography(CC, np.array(calib, float) * [w, h])
    Hi = np.linalg.inv(Hm)
    P = Hi @ [bx * w, by * h, 1.0]
    cx, cy = P[0] / P[2], P[1] / P[2]  # feet
    # signed distance to the court boundary (positive = inside)
    dx = min(cx, 20 - cx)
    dy = min(cy, 44 - cy)
    inside = dx >= 0 and dy >= 0
    d_ft = min(dx, dy) if inside else -np.hypot(min(dx, 0), min(dy, 0))
    # local scale: inches per pixel at the bounce (probe 5px perpendicular-ish)
    Q = Hi @ [bx * w + 5, by * h, 1.0]
    qx, qy = Q[0] / Q[2], Q[1] / Q[2]
    in_per_px = np.hypot(qx - cx, qy - cy) * 12 / 5
    margin_in = max(1.0, 3.0 * in_per_px)  # ~3px tracking noise -> inches
    d_in = d_ft * 12
    if abs(d_in) <= margin_in:
        verdict = f'TOO CLOSE TO CALL (within +/-{margin_in:.0f}")'
    elif inside:
        verdict = f'IN by {d_in:.1f}" (margin +/-{margin_in:.0f}")'
    else:
        verdict = f'OUT by {-d_in:.1f}" (margin +/-{margin_in:.0f}")'
    return verdict, (cx, cy), d_in, margin_in

def main():
    req = json.load(sys.stdin)
    p = subprocess.run(['python3', 'ball_track.py'],
                       input=json.dumps({'clip': req['clip'], 'calib': req['calib'], 'out': '/tmp/_rc_track.jpg'}),
                       capture_output=True, text=True, timeout=900)
    r = json.loads(p.stdout.strip().splitlines()[-1])
    track = r.get('track') or []
    if len(track) < 8:
        print(json.dumps({'error': 'no usable ball track', 'n': len(track)})); return
    cands = bounces(track)
    if not cands:
        print(json.dumps({'error': 'no bounce found (volleys only?)', 'track_pts': len(track)})); return
    # render: bounce frame + grid + track + verdict
    cap = cv2.VideoCapture(req['clip'])
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    f0, bx, by, strength = cands[0]
    verdict, court_xy, d_in, margin = call_at(req['calib'], W, H, bx, by)
    cap.set(cv2.CAP_PROP_POS_FRAMES, f0)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        print(json.dumps({'error': 'cannot seek bounce frame'})); return
    q = (np.array(req['calib']) * [W, H]).astype(np.int32)
    cv2.polylines(frame, [q], True, (20, 255, 57), 2)
    pts = np.array([(int(x * W), int(y * H)) for _, x, y in track], np.int32)
    cv2.polylines(frame, [pts], False, (0, 220, 255), 2)
    bpx, bpy = int(bx * W), int(by * H)
    cv2.circle(frame, (bpx, bpy), 14, (0, 0, 255), 3)
    cv2.circle(frame, (bpx, bpy), 3, (0, 0, 255), -1)
    color = (80, 200, 80) if 'IN ' in verdict else (60, 60, 230) if 'OUT' in verdict else (0, 180, 240)
    cv2.rectangle(frame, (0, 0), (W, 54), (20, 20, 20), -1)
    cv2.putText(frame, verdict, (16, 38), cv2.FONT_HERSHEY_SIMPLEX, 1.1, color, 3)
    cv2.imwrite(req['out'], frame)
    print(json.dumps({'verdict': verdict, 'bounce_frame': int(f0), 'court_ft': [round(court_xy[0], 2), round(court_xy[1], 2)],
                      'd_in': round(d_in, 1), 'margin_in': round(margin, 1), 'candidates': len(cands), 'track_pts': len(track)}))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'error': str(e)}))
