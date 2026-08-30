# Evaluate the keypoint net on the REAL sim courts against Tim's truths.
# Truth = 12 markers projected through the truth homography (Tim's pins).
import json, re, sys
import numpy as np
import cv2
import torch
import synth, kpnet

WT = '/Users/timcooley/whozin/.claude/worktrees/keen-germain-c2e4ef'

def truths():
    src = open(f'{WT}/src/app/app/lab/sim/page.tsx').read()
    T = {}
    for m in re.finditer(r"'/sim/(court\d+)\.jpg': \{ c: \[(.*?)\]", src):
        pts = re.findall(r'x: ([-\d.]+), y: ([-\d.]+)', m.group(2))
        T[m.group(1)] = [[float(x), float(y)] for x, y in pts]
    try:
        GT = json.load(open(f'{WT}/dev-cv/tim_ground_truth.json'))
        for u, v in GT.items(): T[u[5:12]] = v['corners']
    except Exception: pass
    try:
        fresh = json.load(open(f'{WT}/.dev-sim/corrections.json'))
        for u, r in fresh.items(): T[u[5:12]] = [[p['x'], p['y']] for p in r['yours']]
    except Exception: pass
    return T

CC = np.array([[0, 0], [20, 0], [20, 44], [0, 44]], float)

def marker_truth(corners, w, h):
    H, _ = cv2.findHomography(CC, np.array(corners, float) * [w, h])
    if H is None: return None
    out = []
    for mx, my in synth.MARKS:
        p = H @ [mx, my, 1.0]
        out.append((p[0] / p[2], p[1] / p[2]))
    return out

def main(model_path='kpnet.pt', conf_th=0.25):
    net = kpnet.KPNet()
    net.load_state_dict(torch.load(model_path, map_location='cpu'))
    net.eval()
    T = truths()
    rows = []
    for name in sorted(T):
        img0 = cv2.imread(f'{WT}/public/sim/{name}.jpg')
        if img0 is None: continue
        h, w = img0.shape[:2]
        img = cv2.resize(img0, (512, 288))
        x = torch.from_numpy(img.transpose(2, 0, 1)).float().div_(255)[None]
        with torch.no_grad():
            hm = net(x)[0].numpy()
        preds = kpnet.decode(hm)  # (x,y,conf) at 512x288
        mt = marker_truth(T[name], w, h)
        if mt is None: continue
        sx, sy = w / 512.0, h / 288.0
        errs, used = [], 0
        for (px, py, cf), (tx, ty) in zip(preds, mt):
            if not (0 <= tx < w and 0 <= ty < h): continue  # marker off-frame
            if cf < conf_th: continue
            errs.append(np.hypot(px * sx - tx, py * sy - ty))
            used += 1
        if errs:
            rows.append((name, float(np.mean(errs)), float(np.max(errs)), used))
            print(f'{name}: avg={np.mean(errs):6.1f}px worst={np.max(errs):6.1f}px markers={used}/12')
        else:
            print(f'{name}: no confident detections')
    if rows:
        print(f'OVERALL avg over {len(rows)} courts: {np.mean([r[1] for r in rows]):.1f}px')

if __name__ == '__main__':
    main(*sys.argv[1:2])
