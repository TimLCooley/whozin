# Full-match scanner v3.
# v1 lesson: broadcast 720p sheds ~28 ball-sized noise blobs/frame, so
#   "detections/sec" cannot segment rallies and naive linking is hours-slow.
# v2 lesson: the constant-velocity link gate BREAKS tracks exactly at the
#   bounce (ball reverses direction), so bounces live at track JOINS —
#   track A ending in descent + track B starting nearby in ascent.
# v3 lesson: paddle hits and net-cord dips also reverse vy. Discriminate with
#   physics (a bounce loses vertical speed and keeps horizontal direction;
#   a hit doesn't) and geography (hits happen AT players — veto joins inside
#   player zones, which we record during detection).
# stdin: {"video": path, "calib": [[x,y]*4], "out_prefix": "/tmp/match"}
import sys, json, time, os
import cv2
import numpy as np
from rally_call import call_at

PROC_W = 960

def detect_stream(path, calib, cache):
    if os.path.exists(cache):
        d = json.load(open(cache))
        if 'movers' in d:
            return d['dets'], d['movers'], d['n_frames'], d['fps']
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    dets = []
    movers = {}   # frame -> [[cx,cy,r] normalized] big moving blobs (players)
    bg = None
    idx = 0
    W = H = None
    cmask = None
    t0 = time.time()
    while True:
        ok, frame = cap.read()
        if not ok: break
        if W is None:
            scale = PROC_W / frame.shape[1]
            W, H = PROC_W, int(frame.shape[0] * scale)
            m = np.zeros((H, W), np.uint8)
            q = np.array(calib, np.float32) * [W, H]
            c = q.mean(0); q = c + (q - c) * 1.18
            # FLIGHT PRISM: the ball arcs ABOVE the court — from an elevated
            # mount the quad hugs the ground and the arc exits its top edge,
            # shattering tracks. Mask = hull of the court quad + the quad
            # shifted up by ~60% of its own height (capped at 35% of frame).
            qh = float(q[:, 1].max() - q[:, 1].min())
            lift = min(0.6 * qh, 0.35 * H)
            pts = np.vstack([q, q - [0, lift]]).astype(np.int32)
            cv2.fillPoly(m, [cv2.convexHull(pts)], 1)
            cmask = m
        frame = cv2.resize(frame, (W, H))
        gray = cv2.GaussianBlur(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (5, 5), 0)
        if bg is None: bg = gray.astype(np.float32)
        diff = cv2.absdiff(gray, bg.astype(np.uint8))
        cv2.accumulateWeighted(gray, bg, 0.05)
        _, th_all = cv2.threshold(diff, 14, 255, cv2.THRESH_BINARY)
        # players: large movers ANYWHERE in frame (they stand outside the mask)
        num_a, lab_a, stats_a, cents_a = cv2.connectedComponentsWithStats(
            cv2.morphologyEx(th_all, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)))
        mv = []
        for i in range(1, num_a):
            if stats_a[i, cv2.CC_STAT_AREA] > 600:
                r = max(stats_a[i, cv2.CC_STAT_WIDTH], stats_a[i, cv2.CC_STAT_HEIGHT]) / 2
                mv.append([round(cents_a[i][0] / W, 4), round(cents_a[i][1] / H, 4),
                           round(r / W, 4)])
        if mv: movers[idx] = mv
        th = cv2.bitwise_and(th_all, th_all, mask=cmask)
        th = cv2.morphologyEx(th, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        num, lab, stats, cents = cv2.connectedComponentsWithStats(th)
        supp = np.zeros_like(th)
        for i in range(1, num):
            if stats[i, cv2.CC_STAT_AREA] > 600: supp[lab == i] = 255
        supp = cv2.dilate(supp, np.ones((41, 41), np.uint8))
        for i in range(1, num):
            a = stats[i, cv2.CC_STAT_AREA]
            bw, bh = stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT]
            if not (3 <= a <= 500): continue
            if max(bw, bh) > 44: continue
            if max(bw, bh) / max(1, min(bw, bh)) > 6.0: continue
            cx0, cy0 = int(cents[i][0]), int(cents[i][1])
            if supp[min(cy0, H - 1), min(cx0, W - 1)]: continue
            dets.append((idx, round(cents[i][0] / W, 4), round(cents[i][1] / H, 4)))
        idx += 1
        if idx % 6000 == 0:
            print(f'  scanned {idx} frames ({time.time()-t0:.0f}s), {len(dets)} dets', flush=True)
    cap.release()
    json.dump({'dets': dets, 'movers': {str(k): v for k, v in movers.items()},
               'n_frames': idx, 'fps': fps}, open(cache, 'w'))
    return dets, {str(k): v for k, v in movers.items()}, idx, fps

def link_all(dets):
    """One pass, active-track window: only tracks touched in the last 4 frames
    are link candidates, so cost stays O(dets * active)."""
    active, done = [], []
    by_frame = {}
    for d in dets: by_frame.setdefault(d[0], []).append(d)
    t0 = time.time()
    frames = sorted(by_frame)
    for n, f in enumerate(frames):
        still = []
        for t in active:
            if f - t[-1][0] > 4:
                if len(t) >= 8: done.append(t)
            else: still.append(t)
        active = still
        for (_f, x, y) in by_frame[f]:
            best = None
            for t in active:
                lf, lx, ly = t[-1]
                dt = f - lf
                if dt <= 0: continue
                if len(t) >= 2:
                    pf, px2, py2 = t[-2]
                    vx = (lx - px2) / max(1, lf - pf); vy = (ly - py2) / max(1, lf - pf)
                    ex, ey = lx + vx * dt, ly + vy * dt
                    gate = (28.0 * dt + 8) / 960.0
                else:
                    ex, ey = lx, ly
                    gate = 70.0 * dt / 960.0
                dd = ((x - ex) ** 2 + (y - ey) ** 2) ** 0.5
                if dd < gate and (best is None or dd < best[0]): best = (dd, t)
            if best: best[1].append((f, x, y))
            else: active.append([(f, x, y)])
        if n % 20000 == 0 and n:
            print(f'  linked {n}/{len(frames)} frames ({time.time()-t0:.0f}s)', flush=True)
    done.extend(t for t in active if len(t) >= 8)
    return done

def med_speed(t):
    if len(t) < 2: return 0.0
    return float(np.median([np.hypot(t[j+1][1]-t[j][1], t[j+1][2]-t[j][2]) / max(1, t[j+1][0]-t[j][0]) for j in range(len(t)-1)]))

def vel(t, head, k=3):
    """(vx, vy) per frame over the first/last k steps of a track."""
    if head: a, b = t[0], t[min(len(t) - 1, k)]
    else:    a, b = t[max(0, len(t) - k - 1)], t[-1]
    df = max(1, b[0] - a[0])
    return (b[1] - a[1]) / df, (b[2] - a[2]) / df

def is_bally(t):
    if len(t) < 8: return False
    if med_speed(t) * 960 < 5: return False
    xs = [p[1] for p in t]; ys = [p[2] for p in t]
    return np.hypot(max(xs) - min(xs), max(ys) - min(ys)) >= 0.05

def net_y_at(calib, x_img):
    """Image y of the net GROUND line (court y=22ft) at image x, by sampling."""
    import cv2 as _cv
    CC = np.array([[0, 0], [20, 0], [20, 44], [0, 44]], float)
    Hm, _ = _cv.findHomography(CC, np.array(calib, float))
    pts = np.array([[x, 22.0, 1.0] for x in np.linspace(-2, 22, 25)]).T
    P = Hm @ pts
    xs, ys = P[0] / P[2], P[1] / P[2]
    return float(np.interp(x_img, xs, ys))

def graphics_mask(dets, n_frames, gw=64, gh=36):
    """Cells that fire detections all match long are on-screen graphics
    (captions, scoreboards), not court: a real court spot is quiet."""
    hist = np.zeros((gh, gw))
    for _f, x, y in dets:
        hist[min(gh - 1, int(y * gh)), min(gw - 1, int(x * gw))] += 1
    med = np.median(hist[hist > 0]) if (hist > 0).any() else 1
    hot = hist > max(10 * med, 0.02 * n_frames)
    print(f'graphics mask: {int(hot.sum())} hot cells (median {med:.0f} dets/cell)', flush=True)
    return hot, gw, gh

def find_bounces(tracks, movers, calib, gfx, dets):
    hot, gw, gh = gfx
    det_by_frame = {}
    for d in dets: det_by_frame.setdefault(d[0], []).append(d)

    def loiter_count(fe, bx, by_):
        """Detections near this spot OUTSIDE the bounce moment itself.
        A ball visits once; a fidgeting body fires here for seconds."""
        n = 0
        for fq in range(fe - 45, fe + 46):
            if abs(fq - fe) <= 8: continue
            for (_f, x, y) in det_by_frame.get(fq, []):
                if np.hypot(x - bx, (y - by_) * 0.5625) < 0.045: n += 1
        return n

    # adaptive loiter threshold: measure the video's OWN background density
    # (broadcast noise can exceed a fixed count everywhere) — a loiterer must
    # be well above what any random spot sees
    sample = dets[::max(1, len(dets) // 120)][:120]
    base = float(np.median([loiter_count(f, x, y) for (f, x, y) in sample])) if sample else 0
    loiter_thr = max(30.0, 3.0 * base)
    print(f'loiter baseline {base:.0f} -> threshold {loiter_thr:.0f}', flush=True)

    bally = [t for t in tracks if is_bally(t)]
    by_start = {}
    for t in bally: by_start.setdefault(t[0][0], []).append(t)
    joins = []
    vetoed = []   # kept for debugging: what we rejected and why
    n_hit_veto = n_phys_veto = n_edge_veto = n_net_veto = n_gfx_veto = n_loiter_veto = 0
    for A in bally:
        vxa, vya = vel(A, head=False)
        if vya < 0.003: continue                     # must end descending
        fe, xe, ye = A[-1]
        for df in range(0, 8):
            for B in by_start.get(fe + df, []):
                if B is A: continue
                fb, xb, yb = B[0]
                if np.hypot(xb - xe, yb - ye) > 0.06: continue
                vxb, vyb = vel(B, head=True)
                if vyb > -0.001: continue            # must start ascending
                bx, by_ = (xe + xb) / 2, (ye + yb) / 2
                def rej(why):
                    vetoed.append({'frame': fe, 'bounce': (bx, by_), 'why': why,
                                   'w': len(A) + len(B)})
                # edge veto: track ends at the frame edge are balls leaving
                # view or paddles poking in — not observable bounces
                if not (0.04 < bx < 0.96 and 0.04 < by_ < 0.95):
                    n_edge_veto += 1; rej('edge'); continue
                if hot[min(gh - 1, int(by_ * gh)), min(gw - 1, int(bx * gw))]:
                    n_gfx_veto += 1; continue
                # net veto: a descent->ascent AT the net band is a net cord
                # or a ball passing behind the mesh, not a ground bounce
                ny = net_y_at(calib, bx)
                if ny - 0.10 < by_ < ny + 0.02:
                    n_net_veto += 1; rej('net'); continue
                if loiter_count(fe, bx, by_) > loiter_thr:
                    n_loiter_veto += 1; rej('loiter'); continue
                # geography veto: hits happen AT players
                near_player = False
                for fq in range(fe - 2, fe + 3):
                    for (mx, my, mr) in movers.get(str(fq), []):
                        if np.hypot(bx - mx, (by_ - my) * 0.5625) < mr + 0.02:
                            near_player = True; break
                    if near_player: break
                if near_player:
                    n_hit_veto += 1; rej('near-player'); continue
                # physics veto: a bounce loses vertical speed, keeps horizontal
                if abs(vyb) > 0.95 * abs(vya):
                    n_phys_veto += 1; rej('physics-vy'); continue
                if abs(vxa) > 2.5 / 960 and (vxb * vxa < 0 or abs(vxb) > 1.8 * abs(vxa)):
                    n_phys_veto += 1; rej('physics-vx'); continue
                joins.append({'frame': fe, 'bounce': (bx, by_), 'w': len(A) + len(B)})
    print(f'{len(joins)} bounces kept ({n_hit_veto} hit, {n_phys_veto} physics, '
          f'{n_edge_veto} edge, {n_net_veto} net, {n_gfx_veto} graphics, '
          f'{n_loiter_veto} loiter vetoed)', flush=True)
    return joins, vetoed

def main():
    req = json.load(sys.stdin)
    calib = req['calib']
    cache = req['out_prefix'] + '_dets.json'
    print('pass 1: streaming detection…', flush=True)
    dets, movers, n_frames, fps = detect_stream(req['video'], calib, cache)
    print(f'pass 1 done: {len(dets)} detections over {n_frames} frames', flush=True)
    print('pass 2: linking…', flush=True)
    tracks = link_all(dets)
    print(f'pass 2 done: {len(tracks)} tracks', flush=True)
    joins, _ = find_bounces(tracks, movers, calib, graphics_mask(dets, n_frames), dets)
    cap = cv2.VideoCapture(req['video'])
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    events = []
    for j in joins:
        bx, by_ = j['bounce']
        verdict, cxy, d_in, m = call_at(calib, W, H, bx, by_)
        events.append({'frame': j['frame'], 't': j['frame'] / fps, 'bounce': (bx, by_),
                       'verdict': verdict, 'court': cxy, 'd_in': d_in, 'w': j['w']})
    # dedup: same bounce within 0.6s and 1.2ft — keep heaviest evidence
    events.sort(key=lambda e: e['t'])
    kept = []
    for e in events:
        dup = next((k for k in kept if abs(e['t'] - k['t']) < 0.6 and
                    np.hypot(e['court'][0]-k['court'][0], e['court'][1]-k['court'][1]) < 1.2), None)
        if dup:
            if e['w'] > dup['w']: kept[kept.index(dup)] = e
        else: kept.append(e)
    # rallies: clusters of bounces with <=6s gaps
    rallies, cur = [], []
    for e in kept:
        if cur and e['t'] - cur[-1]['t'] > 6: rallies.append(cur); cur = []
        cur.append(e)
    if cur: rallies.append(cur)
    ins = sum(1 for e in kept if e['d_in'] > 0)
    close = [e for e in kept if abs(e['d_in']) <= 4]
    print(f'{len(kept)} bounces after dedup, {len(rallies)} rallies, {ins} in, {len(close)} within 4in', flush=True)
    json.dump({'n_dets': len(dets), 'n_tracks': len(tracks), 'bounces': len(kept),
               'rallies': len(rallies),
               'rally_spans': [[round(r[0]['t'], 1), round(r[-1]['t'], 1), len(r)] for r in rallies],
               'calls': [{'t': round(e['t'], 1), 'frame': e['frame'], 'verdict': e['verdict'],
                          'court_ft': [round(e['court'][0], 2), round(e['court'][1], 2)],
                          'd_in': round(e['d_in'], 1), 'evidence_pts': e['w'],
                          'bounce': [round(e['bounce'][0], 4), round(e['bounce'][1], 4)]}
                         for e in kept]},
              open(req['out_prefix'] + '_report.json', 'w'), indent=1)
    # contact sheet: 12 closest calls, in match order
    top = sorted(kept, key=lambda e: abs(e['d_in']))[:12]
    top.sort(key=lambda e: e['t'])
    tiles = []
    for c in top:
        cap.set(cv2.CAP_PROP_POS_FRAMES, c['frame'])
        ok, fr = cap.read()
        if not ok: continue
        bpx, bpy = int(c['bounce'][0] * W), int(c['bounce'][1] * H)
        q = (np.array(calib) * [W, H]).astype(np.int32)
        cv2.polylines(fr, [q], True, (20, 255, 57), 2)
        cv2.circle(fr, (bpx, bpy), 16, (0, 0, 255), 3)
        cv2.rectangle(fr, (0, 0), (W, 44), (20, 20, 20), -1)
        mm = int(c['t'] // 60)
        cv2.putText(fr, f"{mm}:{c['t'] % 60:04.1f} {c['verdict']}", (10, 32),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.85, (255, 255, 255), 2)
        tiles.append(cv2.resize(fr, (640, 360)))
    cap.release()
    if tiles:
        while len(tiles) % 2: tiles.append(np.zeros_like(tiles[0]))
        rows = [np.hstack(tiles[i:i+2]) for i in range(0, len(tiles), 2)]
        cv2.imwrite(req['out_prefix'] + '_calls.jpg', np.vstack(rows))
    print(f'DONE: {len(kept)} calls across {len(rallies)} rallies', flush=True)

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        import traceback; traceback.print_exc()
        print(json.dumps({'error': str(e)}))
