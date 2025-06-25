// Health check endpoint for LogAI
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAPIMiddleware } from '@/lib/security';

async function handler(request: NextRequest): Promise<NextResponse> {
  try {
    // Check database connection
    const dbHealthy = await checkDatabase();

    // Check Redis connection (for rate limiting)
    const redisHealthy = await checkRedis();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        redis: redisHealthy ? 'healthy' : 'unhealthy',
      },
      uptime: process.uptime(),
    };

    const overallHealthy = dbHealthy && redisHealthy;

    return NextResponse.json(health, {
      status: overallHealthy ? 200 : 503,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      { status: 503 }
    );
  }
}

async function checkDatabase(): Promise<boolean> {
  try {
    // Simple query to check database connectivity
    await db.execute('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    const { redisClient } = await import('@/lib/rate-limiter');
    const result = await redisClient.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  return withAPIMiddleware(request, handler, { skipRateLimit: true });
}
