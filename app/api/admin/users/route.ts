// Admin users management API
import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { withAPIMiddleware, getClientIP } from '@/lib/security';
import { auditLogger } from '@/lib/audit';

async function handleGetUsers(
  request: NextRequest,
  token: any
): Promise<NextResponse> {
  try {
    // Get all users (admin only)
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        isLocked: users.isLocked,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        mfaEnabled: users.mfaEnabled,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    await auditLogger.log({
      userId: token.userId,
      action: 'admin_action',
      resource: 'users',
      ipAddress: getClientIP(request),
      success: true,
      details: { action: 'list_users', count: allUsers.length },
    });

    return NextResponse.json({ users: allUsers });
  } catch (error) {
    console.error('Admin get users error:', error);

    await auditLogger.log({
      userId: token.userId,
      action: 'admin_action',
      resource: 'users',
      ipAddress: getClientIP(request),
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return withAPIMiddleware(request, handleGetUsers, {
    requireAuth: true,
    requireRole: 'admin',
  });
}
