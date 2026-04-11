// Simple in-memory sliding-window rate limiter.
//
// Caveats:
// - State is per serverless instance. On Vercel Fluid Compute, instances are
//   reused across requests, so this catches the common abuse cases (spam bots,
//   runaway scripts). It is NOT a strict global limiter — if you need that,
//   move to Vercel KV / Upstash Ratelimit.
// - Keys should be namespaced (e.g. `avatar:${userId}`) to avoid collisions.

type Bucket = { timestamps: number[] }

const buckets = new Map<string, Bucket>()

// Periodic cleanup so keys don't grow unbounded.
setInterval(() => {
  const now = Date.now()
  const ttl = 10 * 60 * 1000
  for (const [key, bucket] of buckets) {
    if (bucket.timestamps.length === 0 || now - bucket.timestamps[bucket.timestamps.length - 1] > ttl) {
      buckets.delete(key)
    }
  }
}, 5 * 60 * 1000).unref?.()

export interface RateLimitOptions {
  /** Unique key for the actor (e.g. user id, phone number, IP). */
  key: string
  /** Max requests allowed inside the window. */
  max: number
  /** Window duration in milliseconds. */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** ms until the oldest request in the window drops off (0 when allowed). */
  retryAfterMs: number
}

export function rateLimit(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const windowStart = now - opts.windowMs

  let bucket = buckets.get(opts.key)
  if (!bucket) {
    bucket = { timestamps: [] }
    buckets.set(opts.key, bucket)
  }

  // Drop old entries
  while (bucket.timestamps.length && bucket.timestamps[0] < windowStart) {
    bucket.timestamps.shift()
  }

  if (bucket.timestamps.length >= opts.max) {
    const oldest = bucket.timestamps[0]
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, oldest + opts.windowMs - now),
    }
  }

  bucket.timestamps.push(now)
  return {
    allowed: true,
    remaining: opts.max - bucket.timestamps.length,
    retryAfterMs: 0,
  }
}
