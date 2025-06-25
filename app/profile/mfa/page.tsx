'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormField,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import {
  Alert,
  ErrorAlert,
  SuccessAlert,
  InfoAlert,
  WarningAlert,
} from '@/components/ui/alert';
import Image from 'next/image';

interface MFAStatus {
  enabled: boolean;
  backupCodes: string[];
  qrCode?: string;
  secret?: string;
}

export default function MFAPage() {
  const { data: session, status } = useSession();
  const [mfaStatus, setMfaStatus] = useState<MFAStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [step, setStep] = useState<'setup' | 'verify' | 'backup' | 'manage'>(
    'setup'
  );
  const [verificationCode, setVerificationCode] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchMFAStatus();
    }
  }, [status]);

  const fetchMFAStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/mfa/status');

      if (!response.ok) {
        throw new Error('Failed to fetch MFA status');
      }

      const data = await response.json();
      setMfaStatus(data);
      setStep(data.enabled ? 'manage' : 'setup');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load MFA status'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSetupMFA = async () => {
    try {
      setProcessing(true);
      setError('');

      const response = await fetch('/api/mfa/setup', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to setup MFA');
      }

      const data = await response.json();
      setMfaStatus(data);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup MFA');
    } finally {
      setProcessing(false);
    }
  };

  const handleVerifyMFA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      setProcessing(true);
      setError('');

      const response = await fetch('/api/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: verificationCode }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Invalid verification code');
      }

      const data = await response.json();
      setMfaStatus(data);
      setSuccess('Two-factor authentication has been enabled successfully!');
      setStep('backup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify MFA');
    } finally {
      setProcessing(false);
    }
  };

  const handleDisableMFA = async () => {
    if (
      !confirm(
        'Are you sure you want to disable two-factor authentication? This will make your account less secure.'
      )
    ) {
      return;
    }

    try {
      setProcessing(true);
      setError('');

      const response = await fetch('/api/mfa/disable', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disable MFA');
      }

      const data = await response.json();
      setMfaStatus(data);
      setSuccess('Two-factor authentication has been disabled');
      setStep('setup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable MFA');
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateBackupCodes = async () => {
    try {
      setProcessing(true);
      setError('');

      const response = await fetch('/api/mfa/backup-codes', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate backup codes');
      }

      const data = await response.json();
      setMfaStatus(prev =>
        prev ? { ...prev, backupCodes: data.backupCodes } : null
      );
      setShowBackupCodes(true);
      setSuccess('New backup codes generated successfully');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate backup codes'
      );
    } finally {
      setProcessing(false);
    }
  };

  const downloadBackupCodes = () => {
    if (!mfaStatus?.backupCodes) return;

    const content = [
      'LogAI - Two-Factor Authentication Backup Codes',
      '============================================',
      '',
      'These codes can be used to access your account if you lose access to your authenticator app.',
      'Each code can only be used once. Store them in a safe place.',
      '',
      ...mfaStatus.backupCodes.map((code, index) => `${index + 1}. ${code}`),
      '',
      `Generated on: ${new Date().toLocaleString()}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'logai-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <ErrorAlert description="You must be signed in to manage two-factor authentication." />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Two-Factor Authentication
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Add an extra layer of security to your account.
          </p>
        </div>

        {error && <ErrorAlert description={error} />}
        {success && <SuccessAlert description={success} />}

        {/* Setup Step */}
        {step === 'setup' && (
          <Card>
            <CardHeader>
              <CardTitle>Enable Two-Factor Authentication</CardTitle>
              <CardDescription>
                Secure your account with time-based one-time passwords (TOTP)
                using an authenticator app.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <InfoAlert
                  title="What you'll need"
                  description="An authenticator app like Google Authenticator, Authy, or 1Password installed on your phone."
                />

                <div className="space-y-2">
                  <h4 className="font-medium">How it works:</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <li>We'll generate a QR code for your authenticator app</li>
                    <li>Scan the QR code with your authenticator app</li>
                    <li>Enter the 6-digit code from your app to verify</li>
                    <li>Save your backup codes in case you lose your phone</li>
                  </ol>
                </div>

                <Button onClick={handleSetupMFA} disabled={processing}>
                  {processing ? 'Setting up...' : 'Start Setup'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Verify Step */}
        {step === 'verify' && mfaStatus && (
          <Card>
            <CardHeader>
              <CardTitle>Scan QR Code</CardTitle>
              <CardDescription>
                Scan this QR code with your authenticator app, then enter the
                6-digit code below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* QR Code */}
                <div className="flex justify-center">
                  {mfaStatus.qrCode && (
                    <div className="p-4 bg-white rounded-lg border">
                      <Image
                        src={mfaStatus.qrCode}
                        alt="QR Code for MFA setup"
                        width={200}
                        height={200}
                      />
                    </div>
                  )}
                </div>

                {/* Manual entry option */}
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Can't scan? Enter this code manually:
                  </p>
                  <code className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-sm font-mono">
                    {mfaStatus.secret}
                  </code>
                </div>

                {/* Verification form */}
                <Form onSubmit={handleVerifyMFA}>
                  <div className="space-y-4">
                    <FormField>
                      <FormLabel htmlFor="code">Verification Code</FormLabel>
                      <FormControl>
                        <Input
                          id="code"
                          value={verificationCode}
                          onChange={e =>
                            setVerificationCode(
                              e.target.value.replace(/\D/g, '').slice(0, 6)
                            )
                          }
                          placeholder="000000"
                          maxLength={6}
                          className="text-center text-2xl tracking-widest font-mono"
                        />
                      </FormControl>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Enter the 6-digit code from your authenticator app
                      </p>
                    </FormField>

                    <div className="flex space-x-3">
                      <Button
                        type="submit"
                        disabled={processing || verificationCode.length !== 6}
                      >
                        {processing ? 'Verifying...' : 'Verify & Enable'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep('setup')}
                      >
                        Back
                      </Button>
                    </div>
                  </div>
                </Form>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Backup Codes Step */}
        {step === 'backup' && mfaStatus && (
          <Card>
            <CardHeader>
              <CardTitle>Save Your Backup Codes</CardTitle>
              <CardDescription>
                These codes can be used to access your account if you lose your
                phone. Each code can only be used once.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <WarningAlert
                  title="Important"
                  description="Store these codes in a safe place. You won't be able to see them again after leaving this page."
                />

                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                    {mfaStatus.backupCodes.map((code, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <span className="text-gray-500 w-4">{index + 1}.</span>
                        <span>{code}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Button onClick={downloadBackupCodes}>Download Codes</Button>
                  <Button variant="outline" onClick={() => setStep('manage')}>
                    I've Saved Them
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manage Step */}
        {step === 'manage' && mfaStatus && (
          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication Status</CardTitle>
              <CardDescription>
                Your account is protected with two-factor authentication.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center space-x-3">
                  <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                  <span className="font-medium">
                    Two-factor authentication is enabled
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Backup Codes</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Generate new backup codes if you've lost access to your
                        current ones.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateBackupCodes}
                      disabled={processing}
                    >
                      {processing ? 'Generating...' : 'Generate New Codes'}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-red-200 dark:border-red-800 rounded-lg">
                    <div>
                      <p className="font-medium">
                        Disable Two-Factor Authentication
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Remove two-factor authentication from your account.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDisableMFA}
                      disabled={processing}
                    >
                      {processing ? 'Disabling...' : 'Disable'}
                    </Button>
                  </div>
                </div>

                {showBackupCodes && mfaStatus.backupCodes && (
                  <div className="border-t pt-6">
                    <h4 className="font-medium mb-4">Your New Backup Codes</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                      <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                        {mfaStatus.backupCodes.map((code, index) => (
                          <div
                            key={index}
                            className="flex items-center space-x-2"
                          >
                            <span className="text-gray-500 w-4">
                              {index + 1}.
                            </span>
                            <span>{code}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button className="mt-4" onClick={downloadBackupCodes}>
                      Download Codes
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Back to Profile */}
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/profile')}
          >
            Back to Profile
          </Button>
        </div>
      </div>
    </div>
  );
}
