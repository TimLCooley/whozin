# Typed junction detection + matching — Tim's "12 easy detectable things":
# 4 corners (L junctions) + 8 Ts. Junction TYPE constrains identification:
# an L can only be a model corner, a T only a T-spot. Any 4 visible junctions
# calibrate the court — corners not required (clipped views become solvable).
import itertools
import cv2
import numpy as np
import verify

# model keypoints (feet): (x, y, type)  L=corner, T=three-arm
MODEL_JUNCTIONS = [
    (0, 0, 'L'), (20, 0, 'L'), (20, 44, 'L'), (0, 44, 'L'),          # corners
    (0, 15, 'T'), (20, 15, 'T'), (0, 29, 'T'), (20, 29, 'T'),        # kitchen x sideline
    (10, 0, 'T'), (10, 44, 'T'),                                     # centerline x baseline
    (10, 15, 'T'), (10, 29, 'T'),                                    # centerline x kitchen
]

def arm_support(lm, P, direction, reach, w, h):
    """Fraction of sampled points along one arm that sit on white paint."""
    n, hit = 0, 0
    for r in np.linspace(reach * 0.15, reach, 12):
        x, y = int(P[0] + direction[0] * r), int(P[1] + direction[1] * r)
        if 0 <= x < w and 0 <= y < h:
            n += 1
            if lm[max(0, y - 2):y + 3, max(0, x - 2):x + 3].any(): hit += 1
    return hit / n if n else 0.0

def detect_junctions(det, lm, w, h, reach=None):
    """Intersect detected paint lines pairwise; type each junction by which arms
    carry paint. Returns [(x, y, type, arms)] with arms = per-direction support."""
    reach = reach or 0.045 * min(w, h)
    out = []
    for (r1, t1, s1), (r2, t2, s2) in itertools.combinations(det, 2):
        dt = abs(t1 - t2) % np.pi
        if min(dt, np.pi - dt) < 0.30: continue  # near-parallel — no junction
        A = np.array([[np.cos(t1), np.sin(t1)], [np.cos(t2), np.sin(t2)]])
        if abs(np.linalg.det(A)) < 1e-9: continue
        P = np.linalg.solve(A, [r1, r2])
        m = 0.06 * min(w, h)
        if not (-m <= P[0] < w + m and -m <= P[1] < h + m): continue
        arms = []
        for th in (t1, t2):
            d = np.array([-np.sin(th), np.cos(th)])  # along-line direction
            arms.append(arm_support(lm, P, d, reach, w, h))
            arms.append(arm_support(lm, P, -d, reach, w, h))
        # per-line pattern: 'through' (paint both ways), 'end' (one way), else ambiguous
        def pat(a, b):
            if a >= 0.5 and b >= 0.5: return 'through'
            if (a >= 0.5 and b < 0.45) or (b >= 0.5 and a < 0.45): return 'end'
            return None
        p1, p2 = pat(arms[0], arms[1]), pat(arms[2], arms[3])
        if p1 is None or p2 is None: continue
        if p1 == 'end' and p2 == 'end': out.append((P[0], P[1], 'L', tuple(arms)))
        elif p1 == 'through' and p2 == 'through': out.append((P[0], P[1], 'X', tuple(arms)))
        else: out.append((P[0], P[1], 'T', tuple(arms)))
    # dedup near-identical junctions (keep strongest total support)
    ded = []
    for j in sorted(out, key=lambda j: -sum(j[3])):
        if all(np.hypot(j[0] - k[0], j[1] - k[1]) > 0.02 * min(w, h) for k in ded):
            ded.append(j)
    return ded

def junction_homographies(junctions, w, h, max_out=40):
    """Enumerate type-consistent 4-junction assignments -> homography candidates."""
    Ls = [j for j in junctions if j[2] == 'L']
    Ts = [j for j in junctions if j[2] == 'T']
    pts = Ls + Ts
    if len(pts) < 4: return []
    modL = [m for m in MODEL_JUNCTIONS if m[2] == 'L']
    modT = [m for m in MODEL_JUNCTIONS if m[2] == 'T']
    cands = []
    for quad in itertools.combinations(pts[:10], 4):
        opts = [modL if j[2] == 'L' else modT for j in quad]
        for assign in itertools.product(*opts):
            if len({(m[0], m[1]) for m in assign}) < 4: continue
            src = np.array([[m[0], m[1]] for m in assign], float)
            dst = np.array([[j[0], j[1]] for j in quad], float)
            # colinear model points can't fix H
            if abs(np.cross(src[1] - src[0], src[2] - src[0])) < 1e-6 and \
               abs(np.cross(src[1] - src[0], src[3] - src[0])) < 1e-6: continue
            Hm, _ = cv2.findHomography(src, dst)
            if Hm is None: continue
            C = np.array([[0, 0, 1], [20, 0, 1], [20, 44, 1], [0, 44, 1]], float)
            Q = (Hm @ C.T).T
            with np.errstate(all='ignore'):
                Q = Q[:, :2] / Q[:, 2:3]
            if not np.isfinite(Q).all() or np.any(np.abs(Q) > 6 * max(w, h)): continue
            if cv2.contourArea(Q.astype(np.float32)) < 0.03 * w * h: continue
            cands.append(Q / [w, h])
            if len(cands) >= max_out * 50: break
    return cands
