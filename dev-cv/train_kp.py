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
    T = np.zeros((n, 12, kpnet.HM_H, kpnet.HM_W), np.float32)
    i = 0
    t0 = time.time()
    while i < n:
        s = synth.gen_sample(rng)
        if s is None: continue
        img, kps, vis = s
        X[i] = img.transpose(2, 0, 1)
        T[i] = kpnet.make_target(kps, vis)
        i += 1
        if i % 400 == 0: print(f'  gen {i}/{n} ({time.time()-t0:.0f}s)', flush=True)
    return X, T

print(f'device={DEV}; generating {N_TRAIN} train + 120 val...', flush=True)
Xtr, Ttr = gen_set(N_TRAIN, 7)
Xva, Tva = gen_set(120, 999)

net = kpnet.KPNet().to(DEV)
opt = torch.optim.Adam(net.parameters(), lr=3e-4)
print(f'params: {sum(p.numel() for p in net.parameters())/1e6:.2f}M', flush=True)

def batches(X, T, shuffle=True):
    idx = np.random.permutation(len(X)) if shuffle else np.arange(len(X))
    for k in range(0, len(idx) - BATCH + 1, BATCH):
        j = idx[k:k + BATCH]
        x = torch.from_numpy(X[j]).float().div_(255.0)
        # light photometric augmentation
        if shuffle:
            x = (x * np.random.uniform(0.8, 1.2) + np.random.uniform(-0.08, 0.08)).clamp(0, 1)
        yield x.to(DEV), torch.from_numpy(T[j]).to(DEV)

best = 1e9
for ep in range(EPOCHS):
    net.train(); tr = 0.0; nb = 0
    t0 = time.time()
    for x, t in batches(Xtr, Ttr):
        opt.zero_grad()
        loss = F.mse_loss(net(x), t) * 100
        loss.backward(); opt.step()
        tr += float(loss); nb += 1
    net.eval(); va = 0.0; vb = 0
    with torch.no_grad():
        for x, t in batches(Xva, Tva, shuffle=False):
            va += float(F.mse_loss(net(x), t) * 100); vb += 1
    va /= max(vb, 1)
    print(f'epoch {ep+1}/{EPOCHS}: train {tr/max(nb,1):.4f} val {va:.4f} ({time.time()-t0:.0f}s)', flush=True)
    if va < best:
        best = va
        torch.save(net.state_dict(), 'kpnet.pt')
print('done; best val', best, flush=True)
