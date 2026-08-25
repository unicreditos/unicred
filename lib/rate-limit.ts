type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const current = buckets.get(key)
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true as const, remaining: limit - 1 }
  }
  if (current.count >= limit) {
    return { ok: false as const, remaining: 0, retryInMs: current.resetAt - now }
  }
  current.count += 1
  return { ok: true as const, remaining: limit - current.count }
}
