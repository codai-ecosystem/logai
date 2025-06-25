// Enterprise Authentication configuration for LogAI
import { NextAuthOptions } from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import bcrypt from 'bcryptjs';
import {
  db,
  users,
  sessions,
  accounts,
  verificationTokens,
  auditLogs,
} from './db';
import { eq } from 'drizzle-orm';
import { auditLogger } from './audit';
import { rateLimiter } from './rate-limiter';

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        mfaCode: { label: 'MFA Code', type: 'text' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const clientIp =
          req?.headers?.['x-forwarded-for'] ||
          req?.headers?.['x-real-ip'] ||
          'unknown';

        try {
          // Rate limiting
          await rateLimiter.consume(clientIp as string);
        } catch {
          await auditLogger.log({
            action: 'login',
            ipAddress: clientIp as string,
            success: false,
            errorMessage: 'Rate limit exceeded',
            details: { email: credentials.email },
          });
          throw new Error('Too many login attempts. Please try again later.');
        }

        // Find user
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email.toLowerCase()));

        if (!user) {
          await auditLogger.log({
            action: 'login',
            ipAddress: clientIp as string,
            success: false,
            errorMessage: 'User not found',
            details: { email: credentials.email },
          });
          return null;
        }

        // Check if account is locked
        if (user.isLocked) {
          await auditLogger.log({
            userId: user.id,
            action: 'login',
            ipAddress: clientIp as string,
            success: false,
            errorMessage: 'Account locked',
            details: { reason: user.lockReason },
          });
          throw new Error('Account is locked. Please contact support.');
        }

        // Check if account is active
        if (!user.isActive) {
          await auditLogger.log({
            userId: user.id,
            action: 'login',
            ipAddress: clientIp as string,
            success: false,
            errorMessage: 'Account inactive',
          });
          throw new Error('Account is inactive. Please contact support.');
        }

        // Verify password
        if (
          !user.passwordHash ||
          !(await bcrypt.compare(credentials.password, user.passwordHash))
        ) {
          // Increment login attempts
          await db
            .update(users)
            .set({
              loginAttempts: user.loginAttempts + 1,
              isLocked: user.loginAttempts + 1 >= 5,
              lockReason:
                user.loginAttempts + 1 >= 5
                  ? 'Too many failed login attempts'
                  : null,
            })
            .where(eq(users.id, user.id));

          await auditLogger.log({
            userId: user.id,
            action: 'login',
            ipAddress: clientIp as string,
            success: false,
            errorMessage: 'Invalid password',
            details: { attempts: user.loginAttempts + 1 },
          });
          return null;
        }

        // Check MFA if enabled
        if (user.mfaEnabled) {
          if (!credentials.mfaCode) {
            return null; // Frontend should prompt for MFA code
          }

          const speakeasy = await import('speakeasy');
          const verified = speakeasy.authenticator.verify({
            token: credentials.mfaCode,
            secret: user.mfaSecret!,
            encoding: 'base32',
            window: 2,
          });

          if (!verified) {
            await auditLogger.log({
              userId: user.id,
              action: 'login',
              ipAddress: clientIp as string,
              success: false,
              errorMessage: 'Invalid MFA code',
            });
            return null;
          }
        }

        // Successful login - reset attempts and update last login
        await db
          .update(users)
          .set({
            loginAttempts: 0,
            lastLoginAt: new Date(),
            lastLoginIp: clientIp as string,
          })
          .where(eq(users.id, user.id));

        await auditLogger.log({
          userId: user.id,
          action: 'login',
          ipAddress: clientIp as string,
          success: true,
          details: { provider: 'credentials' },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
          mfaEnabled: user.mfaEnabled,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
    GithubProvider({
      clientId: process.env.GITHUB_ID ?? '',
      clientSecret: process.env.GITHUB_SECRET ?? '',
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      // Additional security checks can be added here
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.role = user.role;
        token.mfaEnabled = user.mfaEnabled;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string;
        session.user.role = token.role as string;
        session.user.mfaEnabled = token.mfaEnabled as boolean;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      await auditLogger.log({
        userId: user.id,
        action: 'login',
        success: true,
        details: {
          provider: account?.provider,
          isNewUser,
        },
      });
    },
    async signOut({ session, token }) {
      if (token?.userId) {
        await auditLogger.log({
          userId: token.userId as string,
          action: 'logout',
          success: true,
        });
      }
    },
    async createUser({ user }) {
      await auditLogger.log({
        userId: user.id,
        action: 'register',
        success: true,
        details: { email: user.email },
      });
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

// Type augmentation
declare module 'next-auth' {
  interface User {
    role?: string;
    mfaEnabled?: boolean;
  }
  interface Session {
    user: User & {
      id: string;
      role?: string;
      mfaEnabled?: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    mfaEnabled?: boolean;
    userId?: string;
  }
}

// Helper functions
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateSecureToken(): string {
  return require('crypto').randomBytes(32).toString('hex');
}
