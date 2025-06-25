// User registration API endpoint
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import {
  withAPIMiddleware,
  validateEmail,
  validatePassword,
  sanitizeInput,
  getClientIP,
} from '@/lib/security';
import { registrationRateLimiter, checkRateLimit } from '@/lib/rate-limiter';
import { auditLogger } from '@/lib/audit';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().optional(),
});

async function handler(request: NextRequest): Promise<NextResponse> {
  try {
    const clientIP = getClientIP(request);

    // Check registration rate limit
    const rateLimit = await checkRateLimit(registrationRateLimiter, clientIP);
    if (!rateLimit.allowed) {
      await auditLogger.log({
        action: 'register',
        ipAddress: clientIP,
        success: false,
        errorMessage: 'Registration rate limit exceeded',
      });

      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();

    // Validate input
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { email, password, firstName, lastName, phone } = validation.data;

    // Additional password validation
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          error: 'Password does not meet requirements',
          details: passwordValidation.errors,
        },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const sanitizedEmail = sanitizeInput(email.toLowerCase());
    const sanitizedFirstName = sanitizeInput(firstName);
    const sanitizedLastName = sanitizeInput(lastName);
    const sanitizedPhone = phone ? sanitizeInput(phone) : null;

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, sanitizedEmail));

    if (existingUser) {
      await auditLogger.log({
        action: 'register',
        ipAddress: clientIP,
        success: false,
        errorMessage: 'Email already registered',
        details: { email: sanitizedEmail },
      });

      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email: sanitizedEmail,
        passwordHash,
        firstName: sanitizedFirstName,
        lastName: sanitizedLastName,
        name: `${sanitizedFirstName} ${sanitizedLastName}`,
        phone: sanitizedPhone,
        role: 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      });

    await auditLogger.log({
      userId: newUser.id,
      action: 'register',
      ipAddress: clientIP,
      success: true,
      details: {
        email: sanitizedEmail,
        registrationMethod: 'email_password',
      },
    });

    return NextResponse.json(
      {
        message: 'User registered successfully',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          createdAt: newUser.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);

    await auditLogger.log({
      action: 'register',
      ipAddress: getClientIP(request),
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return withAPIMiddleware(request, handler);
}
