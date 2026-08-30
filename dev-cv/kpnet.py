# Keypoint net: small conv net predicting 12 typed court markers as heatmaps.
# ~1.1M params — phone-class, trains on the M5 in minutes.
import torch
import torch.nn as nn

HM_W, HM_H = 128, 72  # quarter resolution of 512x288

def block(cin, cout, s=1):
    return nn.Sequential(
        nn.Conv2d(cin, cout, 3, s, 1, bias=False), nn.BatchNorm2d(cout), nn.ReLU(inplace=True),
        nn.Conv2d(cout, cout, 3, 1, 1, bias=False), nn.BatchNorm2d(cout), nn.ReLU(inplace=True),
    )

class KPNet(nn.Module):
    def __init__(self, k=12):
        super().__init__()
        self.d1 = block(3, 24, 2)     # 256x144
        self.d2 = block(24, 48, 2)    # 128x72
        self.d3 = block(48, 96, 2)    # 64x36
        self.d4 = block(96, 128, 2)   # 32x18
        self.u1 = block(128, 64)      # -> up 64x36
        self.u2 = block(64 + 96, 64)  # skip d3
        self.u3 = block(64 + 48, 48)  # -> 128x72, skip d2
        self.head = nn.Conv2d(48, k, 1)
        self.up = nn.Upsample(scale_factor=2, mode='bilinear', align_corners=False)

    def forward(self, x):
        x1 = self.d1(x); x2 = self.d2(x1); x3 = self.d3(x2); x4 = self.d4(x3)
        y = self.up(self.u1(x4))                    # 64x36
        y = self.up(self.u2(torch.cat([y, x3], 1))) # 128x72
        y = self.u3(torch.cat([y, x2], 1))
        return self.head(y)                         # B x 12 x 72 x 128

def make_target(kps, vis, sigma=2.2):
    """Gaussian heatmaps at quarter res; zeros for invisible keypoints."""
    import numpy as np
    t = np.zeros((12, HM_H, HM_W), np.float32)
    yy, xx = np.mgrid[0:HM_H, 0:HM_W]
    for i, ((x, y), v) in enumerate(zip(kps, vis)):
        if not v: continue
        cx, cy = x / 4.0, y / 4.0
        if not (-4 <= cx < HM_W + 4 and -4 <= cy < HM_H + 4): continue
        t[i] = np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * sigma ** 2))
    return t

def decode(hm):
    """heatmaps (12,H,W) -> [(x,y,conf)] at 512x288 scale."""
    out = []
    for i in range(hm.shape[0]):
        idx = hm[i].argmax()
        cy, cx = divmod(int(idx), hm.shape[2])
        out.append((cx * 4.0 + 2, cy * 4.0 + 2, float(hm[i].max())))
    return out
