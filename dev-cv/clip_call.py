# Rally-clip caller: the full-match pipeline (match_scan v3) pointed at one
# short clip. Detection -> active-window linking -> track-join bounces with
# the 6-veto stack -> a CALL per bounce -> one annotated overlay showing every
# bounce verdict. This is what the phone gets back after 🎾 Rally.
# stdin: {"clip": path, "calib": [[x,y]*4], "out": overlay.jpg}
import sys, json, os
import cv2
import numpy as np
from match_scan import detect_stream, link_all, graphics_mask, find_bounces
from rally_call import call_at

def main():
    req = json.load(sys.stdin)
    calib = req['calib']
    if not calib:
        print(json.dumps({'error': 'clip has no bound calibration'})); return
    cache = req['clip'] + '.dets.json'
    dets, movers, n_frames, fps = detect_stream(req['clip'], calib, cache)
    if n_frames == 0:
        print(json.dumps({'error': 'no frames'})); return
    tracks = link_all(dets)
    # graphics veto needs a LONG video to distinguish furniture from play —
    # on a short clip every player-occupied cell looks "hot", so disable it
    # (the loiter veto still handles bodies) below ~2 minutes of footage
    if n_frames >= 3600:
        gfx = graphics_mask(dets, n_frames)
    else:
        gfx = (np.zeros((36, 64), bool), 64, 36)
    joins, vetoed = find_bounces(tracks, movers, calib, gfx, dets)
    cap = cv2.VideoCapture(req['clip'])
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    events = []
    for j in joins:
        bx, by_ = j['bounce']
        verdict, cxy, d_in, m = call_at(calib, W, H, bx, by_)
        events.append({'frame': j['frame'], 't': round(j['frame'] / fps, 1),
                       'bounce': (bx, by_), 'verdict': verdict, 'd_in': round(d_in, 1),
                       'court_ft': [round(cxy[0], 2), round(cxy[1], 2)], 'w': j['w']})
    events.sort(key=lambda e: e['frame'])
    kept = []
    for e in events:
        dup = next((k for k in kept if abs(e['t'] - k['t']) < 0.6 and
                    np.hypot(e['court_ft'][0]-k['court_ft'][0], e['court_ft'][1]-k['court_ft'][1]) < 1.2), None)
        if dup:
            if e['w'] > dup['w']: kept[kept.index(dup)] = e
        else: kept.append(e)
    # overlay: frame of the LAST bounce (the shot in question), all bounces
    # marked and numbered, banner = last bounce's verdict
    show = kept[-1] if kept else None
    cap.set(cv2.CAP_PROP_POS_FRAMES, show['frame'] if show else max(0, n_frames - 2))
    ok, fr = cap.read()
    cap.release()
    if not ok:
        print(json.dumps({'error': 'cannot read frame'})); return
    q = (np.array(calib) * [W, H]).astype(np.int32)
    cv2.polylines(fr, [q], True, (20, 255, 57), 2)
    for k, e in enumerate(kept):
        bpx, bpy = int(e['bounce'][0] * W), int(e['bounce'][1] * H)
        last = (e is show)
        cv2.circle(fr, (bpx, bpy), 16 if last else 10, (0, 0, 255) if last else (0, 180, 255), 3 if last else 2)
        tag = f"{k+1}"
        cv2.putText(fr, tag, (bpx + 14, bpy - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cv2.rectangle(fr, (0, 0), (W, 58), (20, 20, 20), -1)
    lowconf = []
    if show:
        color = (80, 200, 80) if 'IN ' in show['verdict'] else (60, 60, 230) if 'OUT' in show['verdict'] else (0, 180, 240)
        cv2.putText(fr, f"#{len(kept)} {show['verdict']}", (14, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, color, 3)
    else:
        # nothing survived: show the rejected candidates so the field test
        # tells us WHICH veto is eating real bounces (orange = low confidence)
        best_v = sorted(vetoed, key=lambda v: -v['w'])[:5]
        for v in best_v:
            bpx, bpy = int(v['bounce'][0] * W), int(v['bounce'][1] * H)
            cv2.circle(fr, (bpx, bpy), 12, (0, 150, 255), 2)
            cv2.putText(fr, v['why'], (bpx + 14, bpy + 5), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 150, 255), 2)
            verdict, cxy, d_in, m = call_at(calib, W, H, v['bounce'][0], v['bounce'][1])
            lowconf.append({'t': round(v['frame'] / (fps or 30), 1), 'why': v['why'],
                            'verdict': verdict, 'court_ft': [round(cxy[0], 2), round(cxy[1], 2)]})
        msg = f'NO CONFIDENT BOUNCE — {len(best_v)} vetoed candidates shown' if best_v \
              else 'NO BOUNCE FOUND (volleys? too short?)'
        cv2.putText(fr, msg, (14, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (0, 180, 240), 2)
    cv2.imwrite(req['out'], fr)
    try: os.remove(cache)
    except OSError: pass
    print(json.dumps({'frames': n_frames, 'n_tracks': len(tracks), 'bounces': len(kept),
                      'calls': kept, 'low_confidence': lowconf, 'overlay': req['out'],
                      'verdict': show['verdict'] if show else
                                 ('no confident bounce' if lowconf else 'no bounce')}))

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        import traceback; traceback.print_exc(file=sys.stderr)
        print(json.dumps({'error': str(e)}))
