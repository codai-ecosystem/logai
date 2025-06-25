// Admin user actions API
import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { withAPIMiddleware, getClientIP } from '@/lib/security';
import { auditLogger } from '@/lib/audit';

async function handleUserAction(
  request: NextRequest,
  token: any,
  userId: string,
  action: string
): Promise<NextResponse> {
  try {
    const clientIP = getClientIP(request);

    // Prevent admin from modifying their own account status
    if (userId === token.userId) {
      return NextResponse.json(
        { error: 'Cannot modify your own account status' },
        { status: 400 }
      );
    }

    // Get current user data
    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let updateData: Partial<typeof users.$inferInsert> = {};
    let auditAction = 'admin_action';
    let actionDescription = '';

    switch (action) {
      case 'activate':
        updateData = { isActive: true, updatedAt: new Date() };
        actionDescription = 'activate_user';
        break;
      case 'deactivate':
        updateData = { isActive: false, updatedAt: new Date() };
        actionDescription = 'deactivate_user';
        break;
      case 'lock':
        updateData = {
          isLocked: true,
          lockReason: 'Locked by administrator',
          updatedAt: new Date(),
        };
        actionDescription = 'lock_user';
        break;
      case 'unlock':
        updateData = {
          isLocked: false,
          lockReason: null,
          loginAttempts: 0,
          updatedAt: new Date(),
        };
        actionDescription = 'unlock_user';
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Update user
    await db.update(users).set(updateData).where(eq(users.id, userId));

    // Log audit event
    await auditLogger.log({
      userId: token.userId,
      action: auditAction,
      resourceId: userId,
      ipAddress: clientIP,
      success: true,
      details: {
        action: actionDescription,
        targetUserEmail: targetUser.email,
        adminEmail: token.email,
      },
      oldValues: {
        isActive: targetUser.isActive,
        isLocked: targetUser.isLocked,
      },
      newValues: updateData,
    });

    return NextResponse.json({
      message: `User ${action}d successfully`,
      userId: userId,
    });
  } catch (error) {
    console.error(`Admin ${action} user error:`, error);

    await auditLogger.log({
      userId: token.userId,
      action: 'admin_action',
      resourceId: userId,
      ipAddress: getClientIP(request),
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      details: { action },
    });

    return NextResponse.json(
      { error: `Failed to ${action} user` },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string; action: string } }
) {
  const { userId, action } = params;

  return withAPIMiddleware(
    request,
    (req, token) => handleUserAction(req, token, userId, action),
    {
      requireAuth: true,
      requireRole: 'admin',
    }
  );
}
