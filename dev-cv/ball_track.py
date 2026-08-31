# Ball tracker v1 (classical, mounted-camera): frame differencing against a
# rolling background + small-fast-blob filtering near the calibrated court,
# nearest-neighbor linking into tracks. Output: overlay image + track JSON.
# stdin:  {"clip": "<path.mp4>", "calib": [[x,y]*4] or null, "out": "<overlay.jpg>"}
# stdout: {"frames": N, "track": [[frame, x, y], ...], "overlay": path}  (x,y normalized)
import sys, json
import cv2
import numpy as np

PROC_W = 960

def court_mask(shape, calib, margin=0.18):
    h, w = shape[:2]
    m = np.zeros((h, w), np.uint8)
    if not calib:
        m[:] = 1
        return m
    q = np.array(calib, np.float32) * [w, h]
    c = q.mean(0)
    q = c + (q - c) * (1 + margin)
    cv2.fillPoly(m, [q.astype(np.int32)], 1)
    return m

def main():
    req = json.load(sys.stdin)
    cap = cv2.VideoCapture(req['clip'])
    if not cap.isOpened():
        print(json.dumps({'error': 'cannot open clip'})); return
    calib = req.get('calib')
    dets = []  # (frame_idx, x, y, area) at processing scale
    prev = None
    bg = None
    idx = 0
    W = H = None
    last_frame = None
    while True:
        ok, frame = cap.read()
        if not ok: break
        if W is None:
            scale = PROC_W / frame.shape[1]
            W, H = PROC_W, int(frame.shape[0] * scale)
            cmask = court_mask((H, W), calib)
        frame = cv2.resize(frame, (W, H))
        last_frame = frame
        gray = cv2.GaussianBlur(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (5, 5), 0)
        if bg is None:
            bg = gray.astype(np.float32)
        # motion = |frame - slow background|; the mount is static so this is clean
        diff = cv2.absdiff(gray, bg.astype(np.uint8))
        cv2.accumulateWeighted(gray, bg, 0.05)
        _, th = cv2.threshold(diff, 22, 255, cv2.THRESH_BINARY)
        th = cv2.bitwise_and(th, th, mask=cmask)
        th = cv2.morphologyEx(th, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        num, lab, stats, cents = cv2.connectedComponentsWithStats(th)
        for i in range(1, num):
            a = stats[i, cv2.CC_STAT_AREA]
            bw, bh = stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT]
            if not (6 <= a <= 900): continue          # ball-sized, not player-sized
            if max(bw, bh) > 42: continue
            if max(bw, bh) / max(1, min(bw, bh)) > 3.5: continue  # roundish
            dets.append((idx, float(cents[i][0]), float(cents[i][1]), int(a)))
        idx += 1
    cap.release()
    if idx == 0:
        print(json.dumps({'error': 'no frames'})); return
    # link detections into tracks (nearest within gate, allow 2-frame gaps)
    tracks = []
    for d in sorted(dets):
        f, x, y, a = d
        best = None
        for t in tracks:
            lf, lx, ly = t[-1][0], t[-1][1], t[-1][2]
            if 0 < f - lf <= 3:
                dd = np.hypot(x - lx, y - ly)
                if dd < 90 * (f - lf) and (best is None or dd < best[0]):
                    best = (dd, t)
        if best: best[1].append((f, x, y))
        else: tracks.append([(f, x, y)])
    tracks = [t for t in tracks if len(t) >= 6]
    tracks.sort(key=lambda t: -len(t))
    track = tracks[0] if tracks else []
    # overlay: draw ALL kept tracks faint, the best one bold, over the last frame
    ov = last_frame.copy()
    if calib:
        q = (np.array(calib) * [W, H]).astype(np.int32)
        cv2.polylines(ov, [q], True, (20, 255, 57), 2)
    for t in tracks[1:6]:
        pts = np.array([(int(p[1]), int(p[2])) for p in t], np.int32)
        cv2.polylines(ov, [pts], False, (160, 160, 160), 1)
    if track:
        pts = np.array([(int(p[1]), int(p[2])) for p in track], np.int32)
        cv2.polylines(ov, [pts], False, (0, 220, 255), 2)
        for p in track[::2]:
            cv2.circle(ov, (int(p[1]), int(p[2])), 3, (0, 140, 255), -1)
        cv2.circle(ov, (int(track[0][1]), int(track[0][2])), 6, (0, 255, 0), 2)
        cv2.circle(ov, (int(track[-1][1]), int(track[-1][2])), 6, (0, 0, 255), 2)
    cv2.imwrite(req['out'], ov)
    print(json.dumps({
        'frames': idx,
        'n_tracks': len(tracks),
        'track': [[p[0], round(p[1] / W, 4), round(p[2] / H, 4)] for p in track],
        'overlay': req['out'],
    }))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(json.dumps({'error': str(e)}))
