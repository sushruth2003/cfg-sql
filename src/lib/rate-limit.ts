type Bucket = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const buckets = new Map<string, Bucket>();

function readNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function getWindowMs(bucketType: "query" | "evals"): number {
  if (bucketType === "evals") {
    return readNumber(process.env.RATE_LIMIT_EVAL_WINDOW_SECONDS, 3600) * 1000;
  }
  return readNumber(process.env.RATE_LIMIT_QUERY_WINDOW_SECONDS, 3600) * 1000;
}

function getLimit(bucketType: "query" | "evals"): number {
  if (bucketType === "evals") {
    return readNumber(process.env.RATE_LIMIT_EVAL_MAX_REQUESTS, 12);
  }
  return readNumber(process.env.RATE_LIMIT_QUERY_MAX_REQUESTS, 120);
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

export function enforceRateLimit(request: Request, bucketType: "query" | "evals"): RateLimitResult {
  const now = Date.now();
  const limit = getLimit(bucketType);
  const windowMs = getWindowMs(bucketType);
  const ip = getClientIp(request);
  const key = `${bucketType}:${ip}`;

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: Math.max(limit - 1, 0),
      resetAt,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (existing.count >= limit) {
    const retryAfterMs = Math.max(existing.resetAt - now, 0);
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  existing.count += 1;
  buckets.set(key, existing);
  return {
    allowed: true,
    remaining: Math.max(limit - existing.count, 0),
    resetAt: existing.resetAt,
    retryAfterSeconds: Math.ceil(Math.max(existing.resetAt - now, 0) / 1000),
  };
}
