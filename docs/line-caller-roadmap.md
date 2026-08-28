# Whozin Line-Caller — Roadmap

_"Whozin already gets you the game. Now it referees it."_

## The wedge
SwingVision is **iOS-only** (leans on Apple's Neural Engine), charges **$15–40/mo**,
has 100k+ users and ~$8M raised. Gaps it leaves open: **no Android / cross-platform**,
rigid setup, side-angle inaccuracy, battery drain. Whozin already books the session
(activities) — bolting recording + AI calls + coaching + broadcast on top, **cross-platform**,
is the structural wedge.

## The bar (non-negotiable)
**When the app says "out," people believe it.** A confidently-wrong call is worse than no
app — it loses arguments instead of settling them. **Accuracy is the entire product.**

## Two layers (very different risk profiles)

### Layer 1 — Video platform (lower risk, shippable *first*, valuable without AI)
Known engineering, no accuracy cliff. People already want this.
- Per-player full recording
- Multi-angle capture + **switch** between cameras (playback and live)
- **Compiled** multi-angle record
- **Highlights** reel
- **Live broadcast (Twitch-style)** — the single biggest infra rock (ingest / transcode /
  CDN / bandwidth = ongoing $$). Also the best growth engine: shareable "watch my game" links.
  Later phase.

### Layer 2 — AI moat (higher risk, higher reward) — two separate CV pillars
- **Line calls (in/out)** — ball + court/line tracking. *The linchpin.*
- **Coaching tips ("what to do better")** — player **pose/technique** analysis
  (MediaPipe/pose). A whole second CV pillar.

## Build order (de-risk bottom-up; never build the cathedral before the foundation)
0. **✅ Logistics de-risked (done):** phone→Claude clip transfer (Remote Control),
   CV toolchain (OpenCV + ffmpeg), gated lab entry (super-admin + 999), lab UI shell
   (Record / Upload / Live).
1. **← WE ARE HERE — Spike: can we track a ball?** Single fixed camera → tag court corners →
   homography → track ball → detect bounce → in/out. Prove *believability* on real footage.
   This is the fork that decides how much of "huge" is real.
2. Court-calibration UX (tap 4 corners) + async analyze (record/upload → result playback).
3. Processing architecture (server-side vs on-device native) — chosen from spike results.
   Note: real-time on-device CV **can't run in the current WebView** → needs native modules
   or server processing.
4. **Video layer in parallel** (record, storage, playback, highlights) — doesn't depend on CV.
5. Live + multi-camera (WebRTC / 5-digit room codes) — only after single-cam is proven.
6. Coaching (pose/technique) — second CV pillar.
7. Broadcast / streaming — biggest infra rock, sequenced last.

## MVP scope (v0 — gated to Tim + 999 test accounts)
Record/upload a clip → calibrate the court → get an **in/out call on close balls**, async,
single camera. Prove the core before building any infrastructure.

## Business
SwingVision charges $15–40/mo. Natural fit: **video layer freemium** (retention hook),
**AI calls + coaching premium** (the moat). Ties into Whozin's existing Pro tier.

## Status (this session)
- ✅ RC clip transfer working (tested with a real phone upload)
- ✅ CV toolchain installed & verified (read an MP4, extracted frames)
- ✅ Gated lab + Record/Upload/Live UI shell live on the dev server
- ⏳ **Next:** a real gameplay clip → first ball-tracking pass
