# Farin-style structured line-pixel detector (the classical broadcast method).
# A court-line pixel is BRIGHTER THAN THE SURFACE AT LINE-WIDTH DISTANCE ON BOTH
# SIDES (dark-bright-dark profile, tested horizontally and vertically at several
# widths), and lies in a region with ONE dominant gradient orientation (structure
# tensor coherence — rejects textured areas like crowds, players, trees).
# Luminance-relative, so dull/shadowed paint still fires (unlike absolute V/S
# thresholds), and colored surfaces don't matter.
import cv2
import numpy as np

def line_pixels(img, region=None, widths=None, tau=16):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.int16)
    h, w = g.shape
    widths = widths or [max(2, int(min(w, h) * f)) for f in (0.004, 0.008, 0.014)]
    m = np.zeros((h, w), bool)
    for d in sorted(set(widths)):
        L = np.roll(g, d, axis=1); R = np.roll(g, -d, axis=1)
        U = np.roll(g, d, axis=0); D = np.roll(g, -d, axis=0)
        m |= ((g - L > tau) & (g - R > tau)) | ((g - U > tau) & (g - D > tau))
        m[:, :d] = m[:, -d:] = False if d else m[:, :d]
        m[:d, :] = False; m[-d:, :] = False; m[:, :d] = False; m[:, -d:] = False
    # structure-tensor coherence: keep only single-orientation (line-like) areas
    gx = cv2.Sobel(g.astype(np.float32), cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(g.astype(np.float32), cv2.CV_32F, 0, 1, ksize=3)
    k = 7
    Jxx = cv2.boxFilter(gx * gx, -1, (k, k))
    Jyy = cv2.boxFilter(gy * gy, -1, (k, k))
    Jxy = cv2.boxFilter(gx * gy, -1, (k, k))
    coher = np.sqrt((Jxx - Jyy) ** 2 + 4 * Jxy ** 2) / (Jxx + Jyy + 1e-6)
    out = (m & (coher > 0.5)).astype(np.uint8) * 255
    if region is not None:
        near = cv2.dilate(region, np.ones((int(w * 0.03) | 1, int(w * 0.03) | 1), np.uint8))
        out = cv2.bitwise_and(out, near)
    # drop specks / blobs that aren't thin-and-long (same policy as auto2)
    num, lab, stats, _ = cv2.connectedComponentsWithStats(out)
    keep = np.zeros_like(out)
    for i in range(1, num):
        x, y, bw, bh, area = stats[i]
        if area < 40: continue
        fill = area / float(bw * bh)
        elong = max(bw, bh) / float(max(1, min(bw, bh)))
        if elong >= 4.0 or (fill < 0.35 and max(bw, bh) > w * 0.05): keep[lab == i] = 255
    return keep
