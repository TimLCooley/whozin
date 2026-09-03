# Backyard scan v2 — lessons from the corner-mount footage where v1 found
# 1 call vs Tim's 14 spoken ones: the court sits in ~35% of frame height, so
# every fixed-size threshold must scale with the LOCAL court size instead.
#  - process at 1280 (not 960): the compressed far court needs the pixels
#  - net veto sized from local court depth-scale, not a fixed band
#  - vy bounce thresholds scaled by local px-per-foot
#  - hit-veto disc capped (near-camera players are huge; dinks land near feet)
# Evaluates against Tim's gold "camera" voice calls.
import json, time
import numpy as np
import cv2
import match_scan
from match_scan import link_all, med_speed, is_bally, vel
from rally_call import call_at

CC = np.array([[0, 0], [20, 0], [20, 44], [0, 44]], float)

def court_maps(calib):
    Hm, _ = cv2.findHomography(CC, np.array(calib, float))
    def img(cx, cy):
        P = Hm @ [cx, cy, 1.0]
        return P[0] / P[2], P[1] / P[2]
    return img

def find_bounces2(tracks, movers, calib, dets):
    img = court_maps(calib)
    Hm, _ = cv2.findHomography(np.array(calib, float), CC)
    def to_court(x, y):
        P = Hm @ [x, y, 1.0]
        return P[0] / P[2], P[1] / P[2]
    def ft_y(bx, by_):
        """local image-y pixels (normalized) per foot of court depth."""
        cx, cy = to_court(bx, by_)
        cx = min(20, max(0, cx)); cy = min(43, max(1, cy))
        _, y1 = img(cx, cy - 1); _, y2 = img(cx, cy + 1)
        return abs(y2 - y1) / 2
    det_by_frame = {}
    for d in dets: det_by_frame.setdefault(d[0], []).append(d)
    def loiter_count(fe, bx, by_):
        n = 0
        for fq in range(fe - 45, fe + 46):
            if abs(fq - fe) <= 8: continue
            for (_f, x, y) in det_by_frame.get(fq, []):
                if np.hypot(x - bx, (y - by_) * 0.5625) < 0.045: n += 1
        return n
    sample = dets[::max(1, len(dets) // 120)][:120]
    base = float(np.median([loiter_count(f, x, y) for (f, x, y) in sample])) if sample else 0
    loiter_thr = max(30.0, 3.0 * base)
    bally = [t for t in tracks if is_bally(t)]
    by_start = {}
    for t in bally: by_start.setdefault(t[0][0], []).append(t)
    joins, vetoed = [], []
    for A in bally:
        vxa, vya = vel(A, head=False)
        fe, xe, ye = A[-1]
        sc = ft_y(xe, ye)                    # normalized px per court-foot here
        vy_min = max(0.0008, 0.30 * sc)      # a bounce must dip ~1/3 ft/frame
        if vya < vy_min: continue
        for df in range(0, 8):
            for B in by_start.get(fe + df, []):
                if B is A: continue
                fb, xb, yb = B[0]
                if np.hypot(xb - xe, yb - ye) > 0.06: continue
                vxb, vyb = vel(B, head=True)
                if vyb > -0.3 * vy_min: continue
                bx, by_ = (xe + xb) / 2, (ye + yb) / 2
                def rej(why): vetoed.append({'frame': fe, 'bounce': (bx, by_), 'why': why, 'w': len(A) + len(B)})
                if not (0.02 < bx < 0.98 and 0.02 < by_ < 0.97):
                    rej('edge'); continue
                # net veto scaled to the local court: the net band is ~3ft of
                # depth-equivalent above the net ground line at this x
                _, ny = img(min(20, max(0, to_court(bx, by_)[0])), 22.0)
                band = max(0.02, 3.2 * ft_y(bx, ny))
                if ny - band < by_ < ny + 0.3 * band:
                    rej('net'); continue
                if loiter_count(fe, bx, by_) > loiter_thr:
                    rej('loiter'); continue
                near_player = False
                for fq in range(fe - 2, fe + 3):
                    for (mx, my, mr) in movers.get(str(fq), []):
                        if np.hypot(bx - mx, (by_ - my) * 0.5625) < min(mr, 0.055) + 0.01:
                            near_player = True; break
                    if near_player: break
                if near_player:
                    rej('near-player'); continue
                if abs(vyb) > 0.95 * abs(vya):
                    rej('physics-vy'); continue
                if abs(vxa) > 2.5 / 1280 and (vxb * vxa < 0 or abs(vxb) > 2.2 * abs(vxa)):
                    rej('physics-vx'); continue
                joins.append({'frame': fe, 'bounce': (bx, by_), 'w': len(A) + len(B)})
    return joins, vetoed

def main():
    match_scan.PROC_W = 1280
    calib = json.load(open('/tmp/calib_mtkuqnesyszhpf.json'))
    video = '/Users/timcooley/Downloads/PXL_20260903_013534424.mp4'
    print('detection @1280…', flush=True)
    dets, movers, n_frames, fps = match_scan.detect_stream(video, calib, '/tmp/backyard3_dets.json')
    print(f'{len(dets)} dets over {n_frames} frames', flush=True)
    tracks = link_all(dets)
    print(f'{len(tracks)} tracks', flush=True)
    joins, vetoed = find_bounces2(tracks, movers, calib, dets)
    from collections import Counter
    print(f'{len(joins)} kept; vetoes: {Counter(v["why"] for v in vetoed)}', flush=True)
    W, H = 1920, 1080
    events = []
    for j in joins:
        bx, by_ = j['bounce']
        verdict, cxy, d_in, m = call_at(calib, W, H, bx, by_)
        events.append({'frame': j['frame'], 't': round(j['frame'] / fps, 1), 'verdict': verdict,
                       'court_ft': [round(cxy[0], 2), round(cxy[1], 2)], 'd_in': round(d_in, 1),
                       'bounce': [round(bx, 4), round(by_, 4)], 'w': j['w']})
    events.sort(key=lambda e: e['t'])
    kept = []
    for e in events:
        dup = next((k for k in kept if abs(e['t'] - k['t']) < 0.6 and
                    np.hypot(e['court_ft'][0]-k['court_ft'][0], e['court_ft'][1]-k['court_ft'][1]) < 1.2), None)
        if dup:
            if e['w'] > dup['w']: kept[kept.index(dup)] = e
        else: kept.append(e)
    print(f'{len(kept)} bounces after dedup', flush=True)
    # eval vs gold voice anchors
    gold = [c for c in json.load(open('/tmp/backyard_voice_calls2.json')) if c['tier'] == 'gold']
    allc = [(e['t'], e) for e in kept] + [(v['frame']/fps, {'verdict': f"vetoed:{v['why']}", 'bounce': v['bounce']}) for v in vetoed]
    allc.sort(key=lambda x: x[0])
    hit = 0
    for g in gold:
        near = [(round(t, 1), e['verdict']) for (t, e) in allc if g['t'] - 12 <= t <= g['t'] + 2]
        keptnear = [x for x in near if not x[1].startswith('vetoed')]
        if near: hit += 1
        print(f"  {g['t']:7.1f}s {g['verdict']:3} \"{g['said'][:32]}\" -> kept:{len(keptnear)} candidates:{len(near)} {near[:4]}")
    print(f'gold anchors with ANY candidate: {hit}/{len(gold)}', flush=True)
    json.dump({'fps': fps, 'calls': kept, 'n_vetoed': len(vetoed),
               'vetoed': [{'t': round(v['frame']/fps, 1), 'why': v['why'],
                           'bounce': [round(v['bounce'][0], 4), round(v['bounce'][1], 4)]} for v in vetoed]},
              open('/tmp/backyard3_report.json', 'w'), indent=1)
    print('report written', flush=True)

if __name__ == '__main__':
    main()
