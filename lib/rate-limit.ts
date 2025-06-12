import { kv } from "@vercel/kv";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export class RateLimit {
  private readonly prefix: string;
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(options: { limit: number; windowMs: number; prefix?: string }) {
    this.maxRequests = options.limit;
    this.windowMs = options.windowMs;
    this.prefix = options.prefix ?? "rate_limit";
  }

  async limit(identifier: string): Promise<RateLimitResult> {
    const key = `${this.prefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    try {
      // Get current request count and timestamps
      const pipeline = kv.pipeline();

      // Remove old entries outside the window
      pipeline.zremrangebyscore(key, 0, windowStart);

      // Count current requests in window
      pipeline.zcard(key);

      // Add current request
      pipeline.zadd(key, { score: now, member: `${now}-${Math.random()}` });

      // Set expiration
      pipeline.expire(key, Math.ceil(this.windowMs / 1000));

      const results = await pipeline.exec();

      // Extract count from pipeline results
      // results[1] is the zcard result (count of items in sorted set)
      const currentCount = (results?.[1] as number) || 0;

      const success = currentCount < this.maxRequests;
      const remaining = Math.max(0, this.maxRequests - currentCount - 1);
      const reset = Math.ceil((now + this.windowMs) / 1000);

      return {
        success,
        limit: this.maxRequests,
        remaining,
        reset,
      };
    } catch (error) {
      console.error("Rate limit error:", error);
      // On error, allow the request but log the issue
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        reset: Math.ceil((now + this.windowMs) / 1000),
      };
    }
  }

  async reset(identifier: string): Promise<void> {
    const key = `${this.prefix}:${identifier}`;
    try {
      await kv.del(key);
    } catch (error) {
      console.error("Error resetting rate limit:", error);
    }
  }

  async check(identifier: string): Promise<RateLimitResult> {
    const key = `${this.prefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    try {
      // Clean old entries and count current ones
      await kv.zremrangebyscore(key, 0, windowStart);
      const currentCount = await kv.zcard(key);

      const success = currentCount < this.maxRequests;
      const remaining = Math.max(0, this.maxRequests - currentCount);
      const reset = Math.ceil((now + this.windowMs) / 1000);

      return {
        success,
        limit: this.maxRequests,
        remaining,
        reset,
      };
    } catch (error) {
      console.error("Rate limit check error:", error);
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests,
        reset: Math.ceil((now + this.windowMs) / 1000),
      };
    }
  }
}

// Pre-configured rate limiters based on the blueprint recommendations
export const ratelimit = new RateLimit({
  limit: 10, // 10 requests
  windowMs: 10 * 1000, // per 10 seconds
  prefix: "api_rate_limit",
});

// More aggressive rate limiting for expensive operations
export const heavyRateLimit = new RateLimit({
  limit: 3, // 3 requests
  windowMs: 60 * 1000, // per minute
  prefix: "heavy_rate_limit",
});

// Per-user daily limits
export const dailyLimit = new RateLimit({
  limit: 100, // 100 requests
  windowMs: 24 * 60 * 60 * 1000, // per day
  prefix: "daily_limit",
});

// Anonymous user rate limiters (more restrictive)
export const anonymousMessageLimit = new RateLimit({
  limit: 10, // 10 messages total
  windowMs: 24 * 60 * 60 * 1000, // per day
  prefix: "anon_message_limit",
});

export const anonymousMinuteLimit = new RateLimit({
  limit: 5, // 5 requests
  windowMs: 60 * 1000, // per minute
  prefix: "anon_minute_limit",
});

export const anonymousSecondLimit = new RateLimit({
  limit: 1, // 1 request
  windowMs: 2 * 1000, // per 2 seconds (prevent spam)
  prefix: "anon_second_limit",
});
