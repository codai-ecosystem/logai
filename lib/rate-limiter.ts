// Rate Limiting for LogAI
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'redis';

const redisClient = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', err => {
  console.error('Redis Client Error:', err);
});

// Connection handling
let isConnected = false;
async function ensureConnection() {
  if (!isConnected) {
    await redisClient.connect();
    isConnected = true;
  }
}

// Login rate limiter - 5 attempts per 15 minutes per IP
export const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'login_rate_limit',
  points: 5, // Number of attempts
  duration: 15 * 60, // Per 15 minutes
  blockDuration: 15 * 60, // Block for 15 minutes
});

// API rate limiter - 1000 requests per hour per IP
export const apiRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'api_rate_limit',
  points: 1000, // Number of requests
  duration: 60 * 60, // Per hour
  blockDuration: 60 * 60, // Block for 1 hour
});

// Registration rate limiter - 3 registrations per hour per IP
export const registrationRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'registration_rate_limit',
  points: 3, // Number of registrations
  duration: 60 * 60, // Per hour
  blockDuration: 60 * 60, // Block for 1 hour
});

// Password reset rate limiter - 3 attempts per hour per email
export const passwordResetRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'password_reset_rate_limit',
  points: 3, // Number of attempts
  duration: 60 * 60, // Per hour
  blockDuration: 60 * 60, // Block for 1 hour
});

// MFA rate limiter - 10 attempts per 5 minutes per user
export const mfaRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'mfa_rate_limit',
  points: 10, // Number of attempts
  duration: 5 * 60, // Per 5 minutes
  blockDuration: 15 * 60, // Block for 15 minutes
});

// Utility function to check rate limit
export async function checkRateLimit(
  limiter: RateLimiterRedis,
  key: string,
  points: number = 1
): Promise<{
  allowed: boolean;
  totalHits: number;
  totalTime: number;
  remainingPoints: number;
}> {
  try {
    await ensureConnection();
    const resRateLimiter = await limiter.consume(key, points);
    return {
      allowed: true,
      totalHits: resRateLimiter.totalHits,
      totalTime: resRateLimiter.totalTime,
      remainingPoints: resRateLimiter.remainingPoints,
    };
  } catch (rejRes: any) {
    return {
      allowed: false,
      totalHits: rejRes.totalHits,
      totalTime: rejRes.totalTime,
      remainingPoints: rejRes.remainingPoints || 0,
    };
  }
}

// Get rate limit info without consuming
export async function getRateLimitInfo(
  limiter: RateLimiterRedis,
  key: string
): Promise<{
  totalHits: number;
  remainingPoints: number;
  msBeforeNext: number;
} | null> {
  try {
    await ensureConnection();
    const resRateLimiter = await limiter.get(key);
    return resRateLimiter;
  } catch (error) {
    console.error('Error getting rate limit info:', error);
    return null;
  }
}

// Reset rate limit for a key
export async function resetRateLimit(
  limiter: RateLimiterRedis,
  key: string
): Promise<void> {
  try {
    await ensureConnection();
    await limiter.delete(key);
  } catch (error) {
    console.error('Error resetting rate limit:', error);
  }
}

export { redisClient };
