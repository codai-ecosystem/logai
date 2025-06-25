import { describe, it, expect, vi } from 'vitest';
import { MFAService } from '../lib/mfa';

describe('MFA Service', () => {
  const mfaService = new MFAService();

  it('generates valid secret', () => {
    const secret = mfaService.generateSecret();

    expect(secret).toBeDefined();
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThan(0);
  });

  it('generates QR code URL', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const email = 'test@example.com';

    const qrUrl = mfaService.generateQRCode(secret, email);

    expect(qrUrl).toContain('otpauth://totp/');
    expect(qrUrl).toContain(email);
    expect(qrUrl).toContain(secret);
    expect(qrUrl).toContain('Codai%20Ecosystem');
  });

  it('verifies valid token', () => {
    const secret = 'JBSWY3DPEHPK3PXP';

    // Mock the current time for predictable token generation
    const mockTime = Math.floor(Date.now() / 1000);
    vi.spyOn(Date, 'now').mockReturnValue(mockTime * 1000);

    // Generate a token for the mocked time
    const token = mfaService.generateToken(secret);

    // Verify the token
    const isValid = mfaService.verifyToken(token, secret);

    expect(isValid).toBe(true);

    vi.restoreAllMocks();
  });

  it('rejects invalid token', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const invalidToken = '000000';

    const isValid = mfaService.verifyToken(invalidToken, secret);

    expect(isValid).toBe(false);
  });

  it('handles backup codes generation', () => {
    const backupCodes = mfaService.generateBackupCodes();

    expect(backupCodes).toHaveLength(10);
    expect(backupCodes.every(code => code.length === 8)).toBe(true);
    expect(backupCodes.every(code => /^[A-Z0-9]{8}$/.test(code))).toBe(true);
  });
});
