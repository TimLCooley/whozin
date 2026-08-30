# Synthetic venue generator for the keypoint net (Track B).
# Renders MULTI-COURT venues (the norm at real facilities) with true perspective
# cameras; only the TARGET court's 12 typed markers are labeled — the model's
# core skill is picking YOUR court out of a wall of courts.
# Ground truth is exact: image = warpPerspective(top-down venue texture).
import cv2
import numpy as np

FT = 8  # texture px per foot
W_OUT, H_OUT = 512, 288
COURT_W, COURT_L = 20.0, 44.0
MARKS = [(0, 0), (20, 0), (20, 44), (0, 44),
         (0, 15), (20, 15), (0, 29), (20, 29),
         (10, 0), (10, 44), (10, 15), (10, 29)]  # 4 L + 8 T, feet

PALETTES = [  # (court, kitchen, apron) BGR-ish ranges picked per scene
    ((150, 80, 30), (170, 120, 60), (60, 130, 60)),    # blue court, light blue kitchen, green apron
    ((60, 130, 60), (80, 160, 90), (150, 80, 30)),     # green court, blue apron
    ((50, 60, 160), (70, 90, 190), (70, 130, 70)),     # red-ish court
    ((90, 90, 90), (120, 120, 120), (75, 105, 75)),    # gray court
    ((140, 100, 40), (60, 140, 70), (100, 160, 110)),  # blue/green mix
]

def jitter(c, amt=25, rng=None):
    return tuple(int(np.clip(v + rng.integers(-amt, amt), 0, 255)) for v in c)

def render_venue(rng):
    """Top-down texture of a venue + the target court's origin (ft)."""
    ncourts = int(rng.integers(1, 7))
    cols = min(ncourts, int(rng.integers(1, 5)))
    rows = int(np.ceil(ncourts / cols))
    gap = float(rng.uniform(4, 14))
    apron = float(rng.uniform(6, 15))
    W_ft = apron * 2 + cols * COURT_W + (cols - 1) * gap
    L_ft = apron * 2 + rows * COURT_L + (rows - 1) * gap
    tw, th = int(W_ft * FT), int(L_ft * FT)
    court_c, kitch_c, apron_c = PALETTES[int(rng.integers(0, len(PALETTES)))]
    court_c, kitch_c, apron_c = jitter(court_c, 25, rng), jitter(kitch_c, 25, rng), jitter(apron_c, 25, rng)
    tex = np.full((th, tw, 3), apron_c, np.uint8)
    # per-court paint
    line_c = jitter((235, 235, 235), 20, rng)
    lw = max(1, int(rng.uniform(0.13, 0.30) * FT))
    origins = []
    for k in range(ncourts):
        r, c = divmod(k, cols)
        ox = apron + c * (COURT_W + gap)
        oy = apron + r * (COURT_L + gap)
        origins.append((ox, oy))
        x0, y0 = int(ox * FT), int(oy * FT)
        x1, y1 = int((ox + COURT_W) * FT), int((oy + COURT_L) * FT)
        tex[y0:y1, x0:x1] = court_c
        ky0, ky1 = int((oy + 15) * FT), int((oy + 29) * FT)
        tex[ky0:ky1, x0:x1] = kitch_c
        # 9 lines
        segs = [((0, 0), (20, 0)), ((20, 0), (20, 44)), ((20, 44), (0, 44)), ((0, 44), (0, 0)),
                ((0, 15), (20, 15)), ((0, 29), (20, 29)),
                ((10, 0), (10, 15)), ((10, 29), (10, 44))]
        if rng.random() < 0.85:  # net line painted sometimes
            segs.append(((0, 22), (20, 22)))
        for (ax, ay), (bx, by) in segs:
            cv2.line(tex, (int((ox + ax) * FT), int((oy + ay) * FT)),
                     (int((ox + bx) * FT), int((oy + by) * FT)), line_c, lw)
    # tile seams (half of venues)
    if rng.random() < 0.5:
        seam_c = jitter(tuple(int(v * 0.82) for v in apron_c), 12, rng)
        step = int(rng.uniform(0.9, 1.5) * FT)
        for x in range(0, tw, step): cv2.line(tex, (x, 0), (x, th), seam_c, 1)
        for y in range(0, th, step): cv2.line(tex, (0, y), (tw, y), seam_c, 1)
    # stains / shadows / puddles
    for _ in range(int(rng.integers(0, 8))):
        cx, cy = int(rng.integers(0, tw)), int(rng.integers(0, th))
        ax_, ay_ = int(rng.integers(20, 300)), int(rng.integers(20, 300))
        ov = tex.copy()
        col = tuple(int(v * rng.uniform(0.55, 1.35)) for v in tex[cy % th, cx % tw])
        cv2.ellipse(ov, (cx, cy), (ax_, ay_), float(rng.uniform(0, 180)), 0, 360,
                    tuple(int(np.clip(v, 0, 255)) for v in col), -1)
        a = rng.uniform(0.15, 0.5)
        tex = cv2.addWeighted(ov, a, tex, 1 - a, 0)
    target = int(rng.integers(0, ncourts))
    return tex, W_ft, L_ft, origins, target

def camera_H(rng, W_ft, L_ft, target_center):
    """Homography texture(px) -> image for a plausible camera looking at target."""
    tx, ty = target_center
    mode = rng.random()
    if mode < 0.25:   # elevated / drone
        eye_h = rng.uniform(25, 90)
        dist = rng.uniform(5, 60)
    elif mode < 0.8:  # behind baseline / fence, phone height-ish
        eye_h = rng.uniform(4, 15)
        dist = rng.uniform(12, 55)
    else:             # low sideline
        eye_h = rng.uniform(3, 8)
        dist = rng.uniform(10, 40)
    ang = rng.uniform(0, 2 * np.pi)
    eye = np.array([tx + dist * np.cos(ang), ty + dist * np.sin(ang), eye_h])
    look = np.array([tx + rng.uniform(-4, 4), ty + rng.uniform(-6, 6), 0.0])
    f = W_OUT * rng.uniform(0.7, 1.6)
    fwd = look - eye; fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, [0, 0, 1.0])
    if np.linalg.norm(right) < 1e-6: return None
    right /= np.linalg.norm(right)
    dn = np.cross(fwd, right); dn /= np.linalg.norm(dn)
    R = np.stack([right, dn, fwd])  # world -> cam
    K = np.array([[f, 0, W_OUT / 2], [0, f, H_OUT / 2], [0, 0, 1.0]])
    # ground plane z=0: world (x,y) -> cam: R @ ([x,y,0]-eye)
    M = np.c_[R[:, :2], -R @ eye]   # 3x3: [x,y,1] -> cam coords
    H = K @ M
    S = np.diag([1.0 / FT, 1.0 / FT, 1.0])  # texture px -> feet
    return H @ S

def gen_sample(rng):
    tex, W_ft, L_ft, origins, target = render_venue(rng)
    ox, oy = origins[target]
    for _ in range(30):
        H = camera_H(rng, W_ft, L_ft, (ox + 10, oy + 22))
        if H is None: continue
        # keypoints of target court
        kps, vis = [], []
        ok = True
        for mx, my in MARKS:
            p = H @ [ (ox + mx) * FT, (oy + my) * FT, 1.0]
            if p[2] <= 1e-6: ok = False; break
            x, y = p[0] / p[2], p[1] / p[2]
            kps.append((x, y))
            vis.append(1.0 if (0 <= x < W_OUT and 0 <= y < H_OUT) else 0.0)
        if not ok: continue
        if sum(vis) < 5: continue  # need a usable amount of court in frame
        img = cv2.warpPerspective(tex, H, (W_OUT, H_OUT), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0))
        # horizon fill: rows where ground doesn't project (black) -> sky/trees
        mask = (img.sum(2) == 0)
        if mask.any():
            sky = np.zeros_like(img)
            base = np.array([jitter((190, 160, 120), 40, rng)], np.uint8)
            for r in range(H_OUT):
                sky[r] = np.clip(base + int(r * 0.15), 0, 255)
            if rng.random() < 0.7:  # tree band
                tree_h = int(rng.uniform(0.05, 0.3) * H_OUT)
                hor = int(np.argmax(~mask.any(1))) if (~mask.any(1)).any() else H_OUT // 2
                y0 = max(0, hor - tree_h)
                if hor - y0 >= 3:
                    tr = np.random.default_rng(int(rng.integers(0, 1 << 30))).integers(20, 80, (hor - y0, W_OUT, 3))
                    sky[y0:hor] = cv2.GaussianBlur(tr.astype(np.uint8), (7, 7), 0)
            img[mask] = sky[mask]
        # net: dark translucent band across target court's net line + posts
        if rng.random() < 0.8:
            net_h_ft = 3.0
            a = H @ [(ox + 0) * FT, (oy + 22) * FT, 1.0]; b = H @ [(ox + 20) * FT, (oy + 22) * FT, 1.0]
            if a[2] > 1e-6 and b[2] > 1e-6:
                ax, ay = a[0] / a[2], a[1] / a[2]; bx, by = b[0] / b[2], b[1] / b[2]
                drop = int(rng.uniform(8, 26))
                pts = np.array([[ax, ay], [bx, by], [bx, by - drop], [ax, ay - drop]], np.int32)
                ov = img.copy(); cv2.fillPoly(ov, [pts], (30, 30, 30))
                img = cv2.addWeighted(ov, 0.45, img, 0.55, 0)
        # players: dark vertical blobs standing on the ground
        for _ in range(int(rng.integers(0, 5))):
            gx = ox + rng.uniform(-3, 23); gy = oy + rng.uniform(-4, 48)
            p = H @ [gx * FT, gy * FT, 1.0]
            if p[2] <= 1e-6: continue
            x, y = p[0] / p[2], p[1] / p[2]
            if not (0 <= x < W_OUT and 0 <= y < H_OUT): continue
            hgt = int(np.clip(rng.uniform(0.06, 0.14) * W_OUT * 400 / max(p[2], 1e-3) / W_OUT, 8, 90))
            wdt = max(3, hgt // 3)
            col = tuple(int(v) for v in np.random.default_rng(int(rng.integers(0, 1 << 30))).integers(20, 220, 3))
            cv2.ellipse(img, (int(x), int(y - hgt // 2)), (wdt, hgt // 2), 0, 0, 360, col, -1)
        # photometric junk
        if rng.random() < 0.5: img = cv2.GaussianBlur(img, (3, 3), 0)
        img = np.clip(img.astype(np.float32) * rng.uniform(0.7, 1.25) + rng.uniform(-20, 20), 0, 255).astype(np.uint8)
        if rng.random() < 0.5:
            q = int(rng.integers(35, 90))
            img = cv2.imdecode(cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, q])[1], cv2.IMREAD_COLOR)
        return img, np.array(kps, np.float32), np.array(vis, np.float32)
    return None

if __name__ == '__main__':
    rng = np.random.default_rng(1)
    tiles = []
    while len(tiles) < 8:
        s = gen_sample(rng)
        if s is None: continue
        img, kps, vis = s
        vz = img.copy()
        for (x, y), v in zip(kps, vis):
            if v: cv2.circle(vz, (int(x), int(y)), 4, (0, 255, 255), -1)
        tiles.append(vz)
    grid = np.vstack([np.hstack(tiles[:4]), np.hstack(tiles[4:])])
    out = '/private/tmp/claude-501/-Users-timcooley-whozin--claude-worktrees-new-session-setup-0771f3/ea9209fa-7d9d-40cf-b94e-04c70ab6c637/scratchpad/synth_sheet.jpg'
    cv2.imwrite(out, grid)
    print('wrote', out)
