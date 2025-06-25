// Multi-Factor Authentication utilities for LogAI
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { db, users } from './db';
import { eq } from 'drizzle-orm';
import { auditLogger } from './audit';

export class MFAService {
  private readonly serviceName = 'LogAI';
  private readonly issuer = 'Codai Ecosystem';

  /**
   * Generate MFA secret for a user
   */
  async generateSecret(userId: string, userEmail: string) {
    const secret = speakeasy.generateSecret({
      name: `${this.serviceName} (${userEmail})`,
      issuer: this.issuer,
      length: 32,
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      manualEntryKey: secret.base32,
    };
  }

  /**
   * Generate QR code for MFA setup
   */
  async generateQRCode(otpauthUrl: string): Promise<string> {
    try {
      return await QRCode.toDataURL(otpauthUrl);
    } catch (error) {
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Verify MFA token
   */
  verifyToken(token: string, secret: string, window: number = 2): boolean {
    return speakeasy.authenticator.verify({
      token,
      secret,
      encoding: 'base32',
      window, // Allow tokens from 2 time steps before/after current
    });
  }

  /**
   * Enable MFA for a user
   */
  async enableMFA(
    userId: string,
    secret: string,
    token: string,
    ipAddress?: string
  ): Promise<{
    success: boolean;
    backupCodes?: string[];
    error?: string;
  }> {
    try {
      // Verify the token first
      if (!this.verifyToken(token, secret)) {
        await auditLogger.log({
          userId,
          action: 'mfa_enable',
          success: false,
          errorMessage: 'Invalid MFA token',
          ipAddress,
        });
        return { success: false, error: 'Invalid MFA token' };
      }

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      // Update user in database
      await db
        .update(users)
        .set({
          mfaEnabled: true,
          mfaSecret: secret,
          mfaBackupCodes: backupCodes,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      await auditLogger.log({
        userId,
        action: 'mfa_enable',
        success: true,
        ipAddress,
      });

      return {
        success: true,
        backupCodes,
      };
    } catch (error) {
      await auditLogger.log({
        userId,
        action: 'mfa_enable',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress,
      });
      return { success: false, error: 'Failed to enable MFA' };
    }
  }

  /**
   * Disable MFA for a user
   */
  async disableMFA(
    userId: string,
    token: string,
    ipAddress?: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Get user's current MFA secret
      const [user] = await db.select().from(users).where(eq(users.id, userId));

      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        return { success: false, error: 'MFA is not enabled for this user' };
      }

      // Verify the token
      if (!this.verifyToken(token, user.mfaSecret)) {
        await auditLogger.log({
          userId,
          action: 'mfa_disable',
          success: false,
          errorMessage: 'Invalid MFA token',
          ipAddress,
        });
        return { success: false, error: 'Invalid MFA token' };
      }

      // Disable MFA
      await db
        .update(users)
        .set({
          mfaEnabled: false,
          mfaSecret: null,
          mfaBackupCodes: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      await auditLogger.log({
        userId,
        action: 'mfa_disable',
        success: true,
        ipAddress,
      });

      return { success: true };
    } catch (error) {
      await auditLogger.log({
        userId,
        action: 'mfa_disable',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        ipAddress,
      });
      return { success: false, error: 'Failed to disable MFA' };
    }
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(
    userId: string,
    backupCode: string,
    ipAddress?: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));

      if (!user || !user.mfaEnabled || !user.mfaBackupCodes) {
        return { success: false, error: 'Invalid backup code' };
      }

      const backupCodes = user.mfaBackupCodes;
      const codeIndex = backupCodes.indexOf(backupCode);

      if (codeIndex === -1) {
        await auditLogger.log({
          userId,
          action: 'login',
          success: false,
          errorMessage: 'Invalid backup code',
          ipAddress,
        });
        return { success: false, error: 'Invalid backup code' };
      }

      // Remove used backup code
      backupCodes.splice(codeIndex, 1);

      await db
        .update(users)
        .set({
          mfaBackupCodes: backupCodes,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      await auditLogger.log({
        userId,
        action: 'login',
        success: true,
        details: { usedBackupCode: true },
        ipAddress,
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to verify backup code' };
    }
  }

  /**
   * Generate new backup codes
   */
  async regenerateBackupCodes(
    userId: string,
    token: string,
    ipAddress?: string
  ): Promise<{
    success: boolean;
    backupCodes?: string[];
    error?: string;
  }> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));

      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        return { success: false, error: 'MFA is not enabled for this user' };
      }

      // Verify the token
      if (!this.verifyToken(token, user.mfaSecret)) {
        return { success: false, error: 'Invalid MFA token' };
      }

      // Generate new backup codes
      const backupCodes = this.generateBackupCodes();

      await db
        .update(users)
        .set({
          mfaBackupCodes: backupCodes,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      await auditLogger.log({
        userId,
        action: 'admin_action',
        success: true,
        details: { action: 'regenerate_backup_codes' },
        ipAddress,
      });

      return {
        success: true,
        backupCodes,
      };
    } catch (error) {
      return { success: false, error: 'Failed to regenerate backup codes' };
    }
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(count: number = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Get MFA status for a user
   */
  async getMFAStatus(userId: string): Promise<{
    enabled: boolean;
    backupCodesCount: number;
    error?: string;
  }> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));

      if (!user) {
        return { enabled: false, backupCodesCount: 0, error: 'User not found' };
      }

      return {
        enabled: user.mfaEnabled || false,
        backupCodesCount: user.mfaBackupCodes?.length || 0,
      };
    } catch (error) {
      return {
        enabled: false,
        backupCodesCount: 0,
        error: 'Failed to get MFA status',
      };
    }
  }
}

export const mfaService = new MFAService();
