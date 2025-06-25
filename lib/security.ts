// Security middleware for LogAI
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { apiRateLimiter, checkRateLimit } from './rate-limiter';
import { auditLogger } from './audit';

// Security headers
export const securityHeaders = {
  'X-DNS-Prefetch-Control': 'on',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-XSS-Protection': '1; mode=block',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'origin-when-cross-origin',
  'Content-Security-Policy': `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://apis.google.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' data: https: blob:;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' https://api.github.com https://accounts.google.com;
    frame-src 'self' https://accounts.google.com;
  `
    .replace(/\s+/g, ' ')
    .trim(),
};

// Get client IP address
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');
  const remote = request.headers.get('x-remote-addr');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (real) {
    return real;
  }
  if (remote) {
    return remote;
  }

  return 'unknown';
}

// Rate limiting middleware
export async function withRateLimit(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const clientIP = getClientIP(request);

  try {
    const rateLimit = await checkRateLimit(apiRateLimiter, clientIP);

    if (!rateLimit.allowed) {
      await auditLogger.log({
        action: 'api_access',
        ipAddress: clientIP,
        success: false,
        errorMessage: 'Rate limit exceeded',
        details: {
          path: request.nextUrl.pathname,
          method: request.method,
          totalHits: rateLimit.totalHits,
        },
      });

      return new NextResponse(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': '1000',
            'X-RateLimit-Remaining': rateLimit.remainingPoints.toString(),
            'X-RateLimit-Reset': new Date(
              Date.now() + rateLimit.totalTime
            ).toISOString(),
          },
        }
      );
    }

    // Add rate limit headers to successful responses
    const response = await handler(request);
    response.headers.set('X-RateLimit-Limit', '1000');
    response.headers.set(
      'X-RateLimit-Remaining',
      rateLimit.remainingPoints.toString()
    );

    return response;
  } catch (error) {
    console.error('Rate limiting error:', error);
    // Continue without rate limiting if there's an error
    return await handler(request);
  }
}

// Authentication middleware
export async function withAuth(
  request: NextRequest,
  handler: (request: NextRequest, token: any) => Promise<NextResponse>,
  requiredRole?: string
): Promise<NextResponse> {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return new NextResponse(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check role if required
    if (requiredRole && token.role !== requiredRole) {
      await auditLogger.log({
        userId: token.userId as string,
        action: 'api_access',
        ipAddress: getClientIP(request),
        success: false,
        errorMessage: 'Insufficient permissions',
        details: {
          requiredRole,
          userRole: token.role,
          path: request.nextUrl.pathname,
        },
      });

      return new NextResponse(
        JSON.stringify({ error: 'Insufficient permissions' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return await handler(request, token);
  } catch (error) {
    console.error('Authentication error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Authentication failed' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Admin authentication middleware
export async function withAdminAuth(
  request: NextRequest,
  handler: (request: NextRequest, token: any) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, handler, 'admin');
}

// Security headers middleware
export function withSecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

// CORS middleware
export function withCORS(
  response: NextResponse,
  origin?: string
): NextResponse {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
  ];

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'development') {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }

  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );
  response.headers.set('Access-Control-Max-Age', '86400');

  return response;
}

// Combined middleware for API routes
export async function withAPIMiddleware(
  request: NextRequest,
  handler: (request: NextRequest, token?: any) => Promise<NextResponse>,
  options: {
    requireAuth?: boolean;
    requireRole?: string;
    skipRateLimit?: boolean;
  } = {}
): Promise<NextResponse> {
  const { requireAuth = false, requireRole, skipRateLimit = false } = options;

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });
    return withCORS(
      withSecurityHeaders(response),
      request.headers.get('origin') || undefined
    );
  }

  let response: NextResponse;

  // Apply rate limiting if not skipped
  if (!skipRateLimit) {
    response = await withRateLimit(request, async req => {
      if (requireAuth || requireRole) {
        return withAuth(req, handler, requireRole);
      } else {
        return handler(req);
      }
    });
  } else {
    if (requireAuth || requireRole) {
      response = await withAuth(request, handler, requireRole);
    } else {
      response = await handler(request);
    }
  }

  // Apply security headers and CORS
  response = withSecurityHeaders(response);
  response = withCORS(response, request.headers.get('origin') || undefined);

  return response;
}

// Input validation helpers
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim()
    .substring(0, 1000); // Limit length
}

// Request logging
export async function logRequest(
  request: NextRequest,
  response: NextResponse,
  userId?: string
) {
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';

  await auditLogger.log({
    userId,
    action: 'api_access',
    resource: request.nextUrl.pathname,
    ipAddress: clientIP,
    userAgent,
    success: response.status < 400,
    details: {
      method: request.method,
      statusCode: response.status,
    },
  });
}
