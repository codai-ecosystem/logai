/**
 * Email Service for LogAI
 * Handles transactional emails, notifications, and communication
 */

import nodemailer from 'nodemailer';
import { render } from '@react-email/render';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface EmailOptions {
  to: string;
  from?: string;
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  data?: Record<string, any>;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private defaultFrom: string;

  constructor() {
    this.defaultFrom = process.env.EMAIL_FROM || 'noreply@codai.ro';

    // Configure transporter based on environment
    if (process.env.NODE_ENV === 'production') {
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
    } else {
      // Development: Use Ethereal Email for testing
      this.transporter = nodemailer.createTransporter({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
          user: 'ethereal.user@ethereal.email',
          pass: 'ethereal.pass',
        },
      });
    }
  }

  /**
   * Send email with template
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const emailOptions = {
        from: options.from || this.defaultFrom,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      if (options.template && options.data) {
        const template = await this.getTemplate(options.template, options.data);
        emailOptions.html = template.html;
        emailOptions.text = template.text;
        emailOptions.subject = template.subject;
      }

      const result = await this.transporter.sendMail(emailOptions);
      console.log('Email sent successfully:', result.messageId);

      if (process.env.NODE_ENV === 'development') {
        console.log('Preview URL:', nodemailer.getTestMessageUrl(result));
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error('Email delivery failed');
    }
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Welcome to LogAI - Your Identity Hub',
      template: 'welcome',
      data: { name },
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}`;

    await this.sendEmail({
      to,
      subject: 'Password Reset Request - LogAI',
      template: 'password-reset',
      data: { resetUrl },
    });
  }

  /**
   * Send MFA setup email
   */
  async sendMFASetupEmail(to: string, qrCodeUrl: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Multi-Factor Authentication Setup - LogAI',
      template: 'mfa-setup',
      data: { qrCodeUrl },
    });
  }

  /**
   * Send security alert email
   */
  async sendSecurityAlertEmail(
    to: string,
    alertType: string,
    details: any
  ): Promise<void> {
    await this.sendEmail({
      to,
      subject: `Security Alert - ${alertType}`,
      template: 'security-alert',
      data: { alertType, details, timestamp: new Date().toISOString() },
    });
  }

  /**
   * Send login notification email
   */
  async sendLoginNotificationEmail(
    to: string,
    location: string,
    device: string
  ): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'New Login Detected - LogAI',
      template: 'login-notification',
      data: { location, device, timestamp: new Date().toISOString() },
    });
  }

  /**
   * Get email template with data
   */
  private async getTemplate(
    templateName: string,
    data: Record<string, any>
  ): Promise<EmailTemplate> {
    const templates = {
      welcome: {
        subject: 'Welcome to LogAI - Your Identity Hub',
        html: this.generateWelcomeHTML(data),
        text: this.generateWelcomeText(data),
      },
      'password-reset': {
        subject: 'Password Reset Request - LogAI',
        html: this.generatePasswordResetHTML(data),
        text: this.generatePasswordResetText(data),
      },
      'mfa-setup': {
        subject: 'Multi-Factor Authentication Setup - LogAI',
        html: this.generateMFASetupHTML(data),
        text: this.generateMFASetupText(data),
      },
      'security-alert': {
        subject: `Security Alert - ${data.alertType}`,
        html: this.generateSecurityAlertHTML(data),
        text: this.generateSecurityAlertText(data),
      },
      'login-notification': {
        subject: 'New Login Detected - LogAI',
        html: this.generateLoginNotificationHTML(data),
        text: this.generateLoginNotificationText(data),
      },
    };

    return (
      templates[templateName as keyof typeof templates] || templates.welcome
    );
  }

  private generateWelcomeHTML(data: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Welcome to LogAI</h1>
        <p>Hello ${data.name},</p>
        <p>Welcome to LogAI, your secure identity and authentication hub in the Codai ecosystem.</p>
        <p>Your account has been successfully created and you can now access all Codai services with enhanced security features.</p>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Next Steps:</h3>
          <ul>
            <li>Set up Multi-Factor Authentication for enhanced security</li>
            <li>Complete your profile information</li>
            <li>Explore the Codai ecosystem</li>
          </ul>
        </div>
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        <p>Best regards,<br>The Codai Team</p>
      </div>
    `;
  }

  private generateWelcomeText(data: any): string {
    return `
Welcome to LogAI

Hello ${data.name},

Welcome to LogAI, your secure identity and authentication hub in the Codai ecosystem.

Your account has been successfully created and you can now access all Codai services with enhanced security features.

Next Steps:
- Set up Multi-Factor Authentication for enhanced security
- Complete your profile information
- Explore the Codai ecosystem

If you have any questions, please don't hesitate to contact our support team.

Best regards,
The Codai Team
    `;
  }

  private generatePasswordResetHTML(data: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc2626;">Password Reset Request</h1>
        <p>We received a request to reset your password for your LogAI account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.resetUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
        </div>
        <p>If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
        <p>This link will expire in 1 hour for security reasons.</p>
        <p>Best regards,<br>The Codai Team</p>
      </div>
    `;
  }

  private generatePasswordResetText(data: any): string {
    return `
Password Reset Request

We received a request to reset your password for your LogAI account.

Reset your password by visiting this link: ${data.resetUrl}

If you didn't request this password reset, please ignore this email or contact support if you have concerns.

This link will expire in 1 hour for security reasons.

Best regards,
The Codai Team
    `;
  }

  private generateMFASetupHTML(data: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #059669;">Multi-Factor Authentication Setup</h1>
        <p>You're setting up Multi-Factor Authentication for enhanced account security.</p>
        <p>Scan the QR code below with your authenticator app:</p>
        <div style="text-align: center; margin: 20px 0;">
          <img src="${data.qrCodeUrl}" alt="MFA QR Code" style="max-width: 200px;">
        </div>
        <p>Recommended authenticator apps:</p>
        <ul>
          <li>Google Authenticator</li>
          <li>Authy</li>
          <li>Microsoft Authenticator</li>
        </ul>
        <p>Keep your backup codes safe - you'll need them if you lose access to your authenticator app.</p>
        <p>Best regards,<br>The Codai Team</p>
      </div>
    `;
  }

  private generateMFASetupText(data: any): string {
    return `
Multi-Factor Authentication Setup

You're setting up Multi-Factor Authentication for enhanced account security.

Visit this URL to view your QR code: ${data.qrCodeUrl}

Recommended authenticator apps:
- Google Authenticator
- Authy
- Microsoft Authenticator

Keep your backup codes safe - you'll need them if you lose access to your authenticator app.

Best regards,
The Codai Team
    `;
  }

  private generateSecurityAlertHTML(data: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc2626;">Security Alert: ${data.alertType}</h1>
        <p>We detected unusual activity on your LogAI account.</p>
        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3>Alert Details:</h3>
          <p><strong>Type:</strong> ${data.alertType}</p>
          <p><strong>Time:</strong> ${data.timestamp}</p>
          <p><strong>Details:</strong> ${JSON.stringify(data.details)}</p>
        </div>
        <p>If this was you, no action is needed. If you don't recognize this activity, please:</p>
        <ul>
          <li>Change your password immediately</li>
          <li>Review your account settings</li>
          <li>Contact support if needed</li>
        </ul>
        <p>Best regards,<br>The Codai Security Team</p>
      </div>
    `;
  }

  private generateSecurityAlertText(data: any): string {
    return `
Security Alert: ${data.alertType}

We detected unusual activity on your LogAI account.

Alert Details:
Type: ${data.alertType}
Time: ${data.timestamp}
Details: ${JSON.stringify(data.details)}

If this was you, no action is needed. If you don't recognize this activity, please:
- Change your password immediately
- Review your account settings
- Contact support if needed

Best regards,
The Codai Security Team
    `;
  }

  private generateLoginNotificationHTML(data: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">New Login Detected</h1>
        <p>A new login to your LogAI account was detected.</p>
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3>Login Details:</h3>
          <p><strong>Location:</strong> ${data.location}</p>
          <p><strong>Device:</strong> ${data.device}</p>
          <p><strong>Time:</strong> ${data.timestamp}</p>
        </div>
        <p>If this was you, no action is needed. If you don't recognize this login, please secure your account immediately.</p>
        <p>Best regards,<br>The Codai Security Team</p>
      </div>
    `;
  }

  private generateLoginNotificationText(data: any): string {
    return `
New Login Detected

A new login to your LogAI account was detected.

Login Details:
Location: ${data.location}
Device: ${data.device}
Time: ${data.timestamp}

If this was you, no action is needed. If you don't recognize this login, please secure your account immediately.

Best regards,
The Codai Security Team
    `;
  }
}

export const emailService = new EmailService();
