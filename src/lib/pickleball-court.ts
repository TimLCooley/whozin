// Regulation pickleball court model, in feet. Everything about calibration and
// line-calling is anchored to these real-world dimensions.
//
// Coordinate frame: origin at the back-left corner. x runs across the width
// (0 → 20), y runs down the length toward the camera (0 → 44). The net is the
// halfway line at y = 22; the non-volley zone ("kitchen") extends 7 ft to each
// side of the net.
//
// A regulation court is 20 ft × 44 ft measured to the *outside* of the lines,
// which is what a player taps when marking the 4 outer corners.

export const COURT = {
  width: 20,
  length: 44,
  netY: 22,
  kitchen: 7,
  lineWidthIn: 2, // regulation line width, inches (USA Pickleball 2.C)
  lineWidthFt: 2 / 12, // 0.1667 ft
} as const

// The court model corners are the OUTER edge of the boundary lines, because a
// ball is only OUT when it lands completely past the outer edge of the line
// (touching any part of the line is IN). Tap the outer corner when calibrating.
export const LINE_WIDTH_FT = COURT.lineWidthFt

// Regulation ball (USA Pickleball 2.D). Its known real size is a scale
// reference: after calibration the homography predicts the ball's pixel radius
// anywhere on court, which powers detection, false-positive rejection, and
// locating the bounce contact point relative to the line's outer edge.
export const BALL = {
  diameterInMin: 2.874,
  diameterInMax: 2.972,
  diameterIn: 2.92, // nominal
  diameterFt: 2.92 / 12, // ~0.243 ft
} as const

// Net height (USA Pickleball 2.C): 34 in at center, 36 in at the posts. Needed
// for the ball's 3-D arc / bounce model once we go beyond the ground plane.
export const NET = {
  heightCenterIn: 34,
  heightPostIn: 36,
} as const

// Derived line positions (feet).
export const NVZ_BACK = COURT.netY - COURT.kitchen // 15 — back kitchen line
export const NVZ_FRONT = COURT.netY + COURT.kitchen // 29 — front kitchen line
export const CENTER_X = COURT.width / 2 // 10 — centerline

// Outer corners, in the same order as the calibration slots:
// back-left, back-right, front-right, front-left (clockwise).
export const COURT_CORNERS: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: COURT.width, y: 0 },
  { x: COURT.width, y: COURT.length },
  { x: 0, y: COURT.length },
]

// Inner lines that the corner outline does NOT already cover, as [x1,y1,x2,y2]
// in feet. Projecting these through the homography is the alignment check: when
// they land on the real painted lines, the calibration is correct.
// (The centerline does not cross the kitchen.)
export const COURT_INNER_LINES: [number, number, number, number][] = [
  [0, COURT.netY, COURT.width, COURT.netY], // net
  [0, NVZ_BACK, COURT.width, NVZ_BACK], // back kitchen line
  [0, NVZ_FRONT, COURT.width, NVZ_FRONT], // front kitchen line
  [CENTER_X, 0, CENTER_X, NVZ_BACK], // centerline, back half
  [CENTER_X, NVZ_FRONT, CENTER_X, COURT.length], // centerline, front half
]

// Mid-court landmarks a user can pin directly. These sit where the net and
// kitchen lines meet the sidelines — clear, near the middle of the frame, and
// far easier to place precisely than the outer corners. Every pinned landmark
// (plus the on-screen corners) feeds the least-squares court fit.
export const COURT_INNER_LANDMARKS: { id: string; label: string; court: { x: number; y: number } }[] = [
  { id: 'net-l', label: 'Net · left', court: { x: 0, y: COURT.netY } },
  { id: 'net-r', label: 'Net · right', court: { x: COURT.width, y: COURT.netY } },
  { id: 'kb-l', label: 'Back kitchen · left', court: { x: 0, y: NVZ_BACK } },
  { id: 'kb-r', label: 'Back kitchen · right', court: { x: COURT.width, y: NVZ_BACK } },
  { id: 'kf-l', label: 'Front kitchen · left', court: { x: 0, y: NVZ_FRONT } },
  { id: 'kf-r', label: 'Front kitchen · right', court: { x: COURT.width, y: NVZ_FRONT } },
]

// The full set of unambiguous court landmarks — the points a person can point
// to in any frame: 4 corners, the centerline "T"s at each baseline and kitchen
// line, the 4 kitchen corners, and the net at each sideline. You only need any
// 4 of these to lock the court; every extra one you mark tightens the fit.
export const COURT_POINTS: { id: string; label: string; short: string; court: { x: number; y: number } }[] = [
  { id: 'c-bl', label: 'Back-left corner', short: 'BL', court: { x: 0, y: 0 } },
  { id: 'c-br', label: 'Back-right corner', short: 'BR', court: { x: COURT.width, y: 0 } },
  { id: 'c-fr', label: 'Front-right corner', short: 'FR', court: { x: COURT.width, y: COURT.length } },
  { id: 'c-fl', label: 'Front-left corner', short: 'FL', court: { x: 0, y: COURT.length } },
  { id: 't-b', label: 'Back baseline center-T', short: 'T', court: { x: CENTER_X, y: 0 } },
  { id: 't-f', label: 'Front baseline center-T', short: 'T', court: { x: CENTER_X, y: COURT.length } },
  { id: 'k-bl', label: 'Back-left kitchen corner', short: 'kBL', court: { x: 0, y: NVZ_BACK } },
  { id: 'k-br', label: 'Back-right kitchen corner', short: 'kBR', court: { x: COURT.width, y: NVZ_BACK } },
  { id: 'k-fl', label: 'Front-left kitchen corner', short: 'kFL', court: { x: 0, y: NVZ_FRONT } },
  { id: 'k-fr', label: 'Front-right kitchen corner', short: 'kFR', court: { x: COURT.width, y: NVZ_FRONT } },
  { id: 'kt-b', label: 'Back kitchen center-T', short: 'kT', court: { x: CENTER_X, y: NVZ_BACK } },
  { id: 'kt-f', label: 'Front kitchen center-T', short: 'kT', court: { x: CENTER_X, y: NVZ_FRONT } },
  { id: 'n-l', label: 'Net at left sideline', short: 'NL', court: { x: 0, y: COURT.netY } },
  { id: 'n-r', label: 'Net at right sideline', short: 'NR', court: { x: COURT.width, y: COURT.netY } },
]

// Every painted line, as [x1,y1,x2,y2] in feet — the outline plus the inner
// lines. Project through the homography to draw the whole court on the frame.
export const COURT_ALL_LINES: [number, number, number, number][] = [
  [0, 0, COURT.width, 0], // back baseline
  [COURT.width, 0, COURT.width, COURT.length], // right sideline
  [COURT.width, COURT.length, 0, COURT.length], // front baseline
  [0, COURT.length, 0, 0], // left sideline
  ...COURT_INNER_LINES,
]
