// Planar homography from 4 point correspondences, solved in the browser.
//
// A pickleball court is flat, so the map from court coordinates (feet) to image
// coordinates (normalized 0..1) is a single 3×3 homography. Given the 4 outer
// corners a user tapped, this recovers that map — which also encodes the camera
// angle — so we can project the rest of the known court model onto the frame.

export type P = { x: number; y: number }
export type Homography = number[] // length 9, row-major, h[8] normalized to 1

// src → dst (both arrays of 4 points, matching order). Returns null if the 4
// points are degenerate (collinear / coincident) and no unique map exists.
export function homographyFromCorners(src: P[], dst: P[]): Homography | null {
  if (src.length < 4 || dst.length < 4) return null
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const X = src[i].x
    const Y = src[i].y
    const x = dst[i].x
    const y = dst[i].y
    A.push([X, Y, 1, 0, 0, 0, -X * x, -Y * x]); b.push(x)
    A.push([0, 0, 0, X, Y, 1, -X * y, -Y * y]); b.push(y)
  }
  const h = solveLinear(A, b, 8)
  if (!h) return null
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1]
}

export function applyHomography(h: Homography, p: P): P {
  const w = h[6] * p.x + h[7] * p.y + h[8]
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  }
}

// Least-squares homography from N ≥ 4 correspondences. With more than 4 points
// the fit is over-determined — pinning easy-to-see mid-court lines (net,
// kitchen) as well as corners makes the solve stable and forgiving, instead of
// hinging on 4 hard-to-place corners. src is in court feet, dst in image 0..1.
export function homographyLeastSquares(src: P[], dst: P[]): Homography | null {
  const N = Math.min(src.length, dst.length)
  if (N < 4) return null
  // Scale court coords toward unit range so the normal equations stay well
  // conditioned (court feet reach 44; image coords are 0..1).
  const S = 20
  // Normal equations: (AᵀA) h = Aᵀb, an 8×8 solve.
  const AtA: number[][] = Array.from({ length: 8 }, () => new Array(8).fill(0))
  const Atb: number[] = new Array(8).fill(0)
  const addRow = (row: number[], rhs: number) => {
    for (let a = 0; a < 8; a++) {
      Atb[a] += row[a] * rhs
      for (let b = 0; b < 8; b++) AtA[a][b] += row[a] * row[b]
    }
  }
  for (let i = 0; i < N; i++) {
    const X = src[i].x / S
    const Y = src[i].y / S
    const x = dst[i].x
    const y = dst[i].y
    addRow([X, Y, 1, 0, 0, 0, -X * x, -Y * x], x)
    addRow([0, 0, 0, X, Y, 1, -X * y, -Y * y], y)
  }
  const h = solveLinear(AtA, Atb, 8)
  if (!h) return null
  // Undo the src scaling (H was solved for scaled court coords): divide the two
  // court-coordinate columns by S so the result maps raw feet → image.
  return [h[0] / S, h[1] / S, h[2], h[3] / S, h[4] / S, h[5], h[6] / S, h[7] / S, 1]
}

// Gaussian elimination with partial pivoting. Returns the solution vector, or
// null if the system is singular.
function solveLinear(A: number[][], b: number[], n: number): number[] | null {
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r
    }
    if (Math.abs(M[piv][col]) < 1e-12) return null
    const tmp = M[col]; M[col] = M[piv]; M[piv] = tmp
    const d = M[col][col]
    for (let c = col; c <= n; c++) M[col][c] /= d
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col]
      if (f === 0) continue
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]
    }
  }
  return M.map((row) => row[n])
}
