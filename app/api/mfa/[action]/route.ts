// MFA setup and management API
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAPIMiddleware, getClientIP } from '@/lib/security';
import { mfaService } from '@/lib/mfa';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';

const setupMFASchema = z.object({
  token: z.string().length(6, 'MFA token must be 6 digits'),
});

const verifyMFASchema = z.object({
  token: z.string().length(6, 'MFA token must be 6 digits'),
});

const regenerateBackupCodesSchema = z.object({
  token: z.string().length(6, 'MFA token must be 6 digits'),
});

// Generate MFA secret and QR code
async function handleGenerateSecret(
  request: NextRequest,
  token: any
): Promise<NextResponse> {
  try {
    const userId = token.userId as string;

    // Get user details
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate MFA secret
    const mfaData = await mfaService.generateSecret(userId, user.email);
    const qrCodeDataUrl = await mfaService.generateQRCode(mfaData.otpauthUrl!);

    return NextResponse.json({
      secret: mfaData.secret,
      qrCode: qrCodeDataUrl,
      manualEntryKey: mfaData.manualEntryKey,
    });
  } catch (error) {
    console.error('MFA secret generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate MFA secret' },
      { status: 500 }
    );
  }
}

// Enable MFA
async function handleEnableMFA(
  request: NextRequest,
  token: any
): Promise<NextResponse> {
  try {
    const userId = token.userId as string;
    const clientIP = getClientIP(request);
    const body = await request.json();

    const validation = setupMFASchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 400 }
      );
    }

    const { token: mfaToken } = validation.data;
    const { secret } = body; // This should come from the previous step

    if (!secret) {
      return NextResponse.json(
        { error: 'MFA secret is required' },
        { status: 400 }
      );
    }

    const result = await mfaService.enableMFA(
      userId,
      secret,
      mfaToken,
      clientIP
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      message: 'MFA enabled successfully',
      backupCodes: result.backupCodes,
    });
  } catch (error) {
    console.error('MFA enable error:', error);
    return NextResponse.json(
      { error: 'Failed to enable MFA' },
      { status: 500 }
    );
  }
}

// Disable MFA
async function handleDisableMFA(
  request: NextRequest,
  token: any
): Promise<NextResponse> {
  try {
    const userId = token.userId as string;
    const clientIP = getClientIP(request);
    const body = await request.json();

    const validation = verifyMFASchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 400 }
      );
    }

    const { token: mfaToken } = validation.data;

    const result = await mfaService.disableMFA(userId, mfaToken, clientIP);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      message: 'MFA disabled successfully',
    });
  } catch (error) {
    console.error('MFA disable error:', error);
    return NextResponse.json(
      { error: 'Failed to disable MFA' },
      { status: 500 }
    );
  }
}

// Get MFA status
async function handleGetMFAStatus(
  request: NextRequest,
  token: any
): Promise<NextResponse> {
  try {
    const userId = token.userId as string;

    const status = await mfaService.getMFAStatus(userId);

    if (status.error) {
      return NextResponse.json({ error: status.error }, { status: 404 });
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error('MFA status error:', error);
    return NextResponse.json(
      { error: 'Failed to get MFA status' },
      { status: 500 }
    );
  }
}

// Regenerate backup codes
async function handleRegenerateBackupCodes(
  request: NextRequest,
  token: any
): Promise<NextResponse> {
  try {
    const userId = token.userId as string;
    const clientIP = getClientIP(request);
    const body = await request.json();

    const validation = regenerateBackupCodesSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid token format' },
        { status: 400 }
      );
    }

    const { token: mfaToken } = validation.data;

    const result = await mfaService.regenerateBackupCodes(
      userId,
      mfaToken,
      clientIP
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Backup codes regenerated successfully',
      backupCodes: result.backupCodes,
    });
  } catch (error) {
    console.error('MFA regenerate backup codes error:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate backup codes' },
      { status: 500 }
    );
  }
}

// Route handlers
export async function GET(
  request: NextRequest,
  { params }: { params: { action: string } }
) {
  const action = params.action;

  switch (action) {
    case 'generate-secret':
      return withAPIMiddleware(request, handleGenerateSecret, {
        requireAuth: true,
      });
    case 'status':
      return withAPIMiddleware(request, handleGetMFAStatus, {
        requireAuth: true,
      });
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { action: string } }
) {
  const action = params.action;

  switch (action) {
    case 'enable':
      return withAPIMiddleware(request, handleEnableMFA, { requireAuth: true });
    case 'disable':
      return withAPIMiddleware(request, handleDisableMFA, {
        requireAuth: true,
      });
    case 'regenerate-backup-codes':
      return withAPIMiddleware(request, handleRegenerateBackupCodes, {
        requireAuth: true,
      });
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}
