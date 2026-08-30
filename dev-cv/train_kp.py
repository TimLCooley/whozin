# Train the keypoint net on synthetic venues. M5/MPS, ~minutes per thousand steps.
import time, sys
import numpy as np
import torch
import torch.nn.functional as F
import synth, kpnet

DEV = 'mps' if torch.backends.mps.is_available() else 'cpu'
N_TRAIN = int(sys.argv[1]) if len(sys.argv) > 1 else 2400
EPOCHS = int(sys.argv[2]) if len(sys.argv) > 2 else 18
BATCH = 16

def gen_set(n, seed):
    rng = np.random.default_rng(seed)
    X = np.zeros((n, 3, 288, 512), np.uint8)
    K = np.zeros((n, 12, 2), np.float32)
    V = np.zeros((n, 12), np.float32)
    i = 0
    t0 = time.time()
    while i < n:
        s = synth.gen_sample(rng)
        if s is None: continue
        img, kps, vis = s
        X[i] = img.transpose(2, 0, 1)
        K[i], V[i] = kps, vis
        i += 1
        if i % 800 == 0: print(f'  gen {i}/{n} ({time.time()-t0:.0f}s)', flush=True)
    return X, (K, V)

print(f'device={DEV}; generating {N_TRAIN} train + 120 val...', flush=True)
Xtr, Ttr = gen_set(N_TRAIN, 7)
Xva, Tva = gen_set(120, 999)

net = kpnet.KPNet().to(DEV)
opt = torch.optim.Adam(net.parameters(), lr=3e-4)

def hm_loss(pred, t):
    # plain MSE collapses to all-zero on sparse heatmaps — weight the peaks
    w = 1.0 + 80.0 * t
    return ((pred - t) ** 2 * w).mean() * 100
print(f'params: {sum(p.numel() for p in net.parameters())/1e6:.2f}M', flush=True)

def batches(X, T, shuffle=True):
    K, V = T
    idx = np.random.permutation(len(X)) if shuffle else np.arange(len(X))
    for k in range(0, len(idx) - BATCH + 1, BATCH):
        j = idx[k:k + BATCH]
        x = torch.from_numpy(X[j]).float().div_(255.0)
        if shuffle:  # photometric augmentation: per-channel gain, offset, noise
            g = torch.tensor(np.random.uniform(0.7, 1.3, (len(j), 3, 1, 1)), dtype=torch.float32)
            x = (x * g + np.random.uniform(-0.1, 0.1)).clamp(0, 1)
            if np.random.rand() < 0.4: x = (x + torch.randn_like(x) * np.random.uniform(0.01, 0.05)).clamp(0, 1)
        t = np.stack([kpnet.make_target(K[i2], V[i2]) for i2 in j])
        yield x.to(DEV), torch.from_numpy(t).to(DEV)

best = 1e9
for ep in range(EPOCHS):
    net.train(); tr = 0.0; nb = 0
    t0 = time.time()
    for x, t in batches(Xtr, Ttr):
        opt.zero_grad()
        loss = hm_loss(net(x), t)
        loss.backward(); opt.step()
        tr += float(loss); nb += 1
    net.eval(); va = 0.0; vb = 0
    with torch.no_grad():
        for x, t in batches(Xva, Tva, shuffle=False):
            va += float(hm_loss(net(x), t)); vb += 1
    va /= max(vb, 1)
    print(f'epoch {ep+1}/{EPOCHS}: train {tr/max(nb,1):.4f} val {va:.4f} ({time.time()-t0:.0f}s)', flush=True)
    if va < best:
        best = va
        torch.save(net.state_dict(), 'kpnet.pt')
print('done; best val', best, flush=True)
