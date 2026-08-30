# Fine-tune the keypoint net on REAL labeled courts (Tim's truths), mixed with
# synthetic batches to prevent forgetting. Strict split: the held-out courts are
# never trained on; they are the only honest exam.
import time
import numpy as np
import cv2
import torch
import synth, kpnet
from eval_kp import truths, marker_truth, WT

DEV = 'mps' if torch.backends.mps.is_available() else 'cpu'
HOLD_OUT = {'court02', 'court08', 'court10', 'court13', 'court16', 'court23'}
EPOCHS, BATCH = 30, 16

def load_real():
    T = truths()
    data = []
    for name, corners in sorted(T.items()):
        img0 = cv2.imread(f'{WT}/public/sim/{name}.jpg')
        if img0 is None: continue
        h, w = img0.shape[:2]
        mt = marker_truth(corners, w, h)
        if mt is None: continue
        img = cv2.resize(img0, (512, 288))
        kps = np.array([[x * 512 / w, y * 288 / h] for x, y in mt], np.float32)
        vis = np.array([1.0 if (0 <= x < w and 0 <= y < h) else 0.0 for x, y in mt], np.float32)
        data.append((name, img, kps, vis))
    return data

def aug_real(img, kps, vis, rng):
    """random scale/translate crop + color jitter; keypoints follow."""
    s = rng.uniform(0.75, 1.15)
    tx, ty = rng.uniform(-60, 60), rng.uniform(-40, 40)
    M = np.array([[s, 0, tx + 256 * (1 - s)], [0, s, ty + 144 * (1 - s)]], np.float32)
    im2 = cv2.warpAffine(img, M, (512, 288), borderMode=cv2.BORDER_REFLECT)
    k2 = (kps @ M[:, :2].T) + M[:, 2]
    v2 = vis * ((k2[:, 0] >= -8) & (k2[:, 0] < 520) & (k2[:, 1] >= -8) & (k2[:, 1] < 296))
    im2 = np.clip(im2.astype(np.float32) * rng.uniform(0.75, 1.25, 3) + rng.uniform(-18, 18), 0, 255).astype(np.uint8)
    return im2, k2.astype(np.float32), v2.astype(np.float32)

def main():
    real = load_real()
    train = [d for d in real if d[0] not in HOLD_OUT]
    print(f'real: {len(train)} train / {len(real) - len(train)} held out', flush=True)
    rng = np.random.default_rng(11)
    print('generating 1500 synthetic for replay...', flush=True)
    synth_set = []
    while len(synth_set) < 1500:
        s = synth.gen_sample(rng)
        if s is not None: synth_set.append(s)
    net = kpnet.KPNet().to(DEV)
    net.load_state_dict(torch.load('kpnet.pt', map_location=DEV))
    opt = torch.optim.Adam(net.parameters(), lr=8e-5)
    def hm_loss(pred, t):
        w = 1.0 + 80.0 * t
        return ((pred - t) ** 2 * w).mean() * 100
    for ep in range(EPOCHS):
        net.train(); tot = 0.0; nb = 0
        t0 = time.time()
        for step in range(60):
            xs, ts = [], []
            for _ in range(BATCH):
                if rng.random() < 0.45:  # real, augmented
                    name, img, kps, vis = train[int(rng.integers(0, len(train)))]
                    im2, k2, v2 = aug_real(img, kps, vis, rng)
                else:                    # synthetic replay
                    im2, k2, v2 = synth_set[int(rng.integers(0, len(synth_set)))]
                xs.append(np.ascontiguousarray(im2.transpose(2, 0, 1)))
                ts.append(kpnet.make_target(k2, v2))
            x = torch.from_numpy(np.stack(xs)).float().div_(255).to(DEV)
            t = torch.from_numpy(np.stack(ts)).to(DEV)
            opt.zero_grad()
            loss = hm_loss(net(x), t)
            loss.backward(); opt.step()
            tot += float(loss.detach()); nb += 1
        print(f'ep {ep+1}/{EPOCHS}: loss {tot/nb:.4f} ({time.time()-t0:.0f}s)', flush=True)
    torch.save(net.state_dict(), 'kpnet_ft.pt')
    print('saved kpnet_ft.pt', flush=True)

if __name__ == '__main__':
    main()
