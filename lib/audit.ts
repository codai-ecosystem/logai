// Audit Logging System for LogAI
import winston from 'winston';
import { db, auditLogs, auditActionEnum } from './db';
import { eq, gte, lte, desc } from 'drizzle-orm';

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'logai' },
  transports: [
    // Write all logs with importance level of 'error' or less to 'error.log'
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // Write all logs with importance level of 'info' or less to 'combined.log'
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// If we're not in production then log to the console with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

export interface AuditLogEntry {
  userId?: string;
  action: (typeof auditActionEnum.enumValues)[number];
  resource?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  success?: boolean;
  errorMessage?: string;
}

class AuditLogger {
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Log to database
      await db.insert(auditLogs).values({
        userId: entry.userId || null,
        action: entry.action,
        resource: entry.resource || null,
        resourceId: entry.resourceId || null,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
        details: entry.details || null,
        oldValues: entry.oldValues || null,
        newValues: entry.newValues || null,
        success: entry.success ?? true,
        errorMessage: entry.errorMessage || null,
        createdAt: new Date(),
      });

      // Log to Winston for external monitoring
      const logLevel = entry.success === false ? 'error' : 'info';
      logger.log(logLevel, 'Audit Event', {
        ...entry,
        timestamp: new Date().toISOString(),
      });

      // Send to external systems if configured
      if (process.env.SENTRY_DSN && entry.success === false) {
        // Send error events to Sentry
        const Sentry = await import('@sentry/nextjs');
        Sentry.addBreadcrumb({
          message: `Audit: ${entry.action}`,
          level: 'error',
          data: entry,
        });
      }
    } catch (error) {
      // Fallback logging - ensure audit events are never lost
      logger.error('Failed to write audit log', {
        error: error instanceof Error ? error.message : String(error),
        originalEntry: entry,
      });

      console.error('Audit logging failed:', error);
    }
  }

  // Batch logging for performance
  async logBatch(entries: AuditLogEntry[]): Promise<void> {
    try {
      const auditEntries = entries.map(entry => ({
        userId: entry.userId || null,
        action: entry.action,
        resource: entry.resource || null,
        resourceId: entry.resourceId || null,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
        details: entry.details || null,
        oldValues: entry.oldValues || null,
        newValues: entry.newValues || null,
        success: entry.success ?? true,
        errorMessage: entry.errorMessage || null,
        createdAt: new Date(),
      }));

      await db.insert(auditLogs).values(auditEntries);

      // Log batch to Winston
      logger.info('Batch Audit Events', {
        count: entries.length,
        actions: entries.map(e => e.action),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to write batch audit log', {
        error: error instanceof Error ? error.message : String(error),
        entriesCount: entries.length,
      });
    }
  }

  // Query audit logs with filtering
  async query(filters: {
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
    limit?: number;
    offset?: number;
  }) {
    try {
      let query = db.select().from(auditLogs);

      if (filters.userId) {
        query = query.where(eq(auditLogs.userId, filters.userId));
      }
      if (filters.action) {
        query = query.where(eq(auditLogs.action, filters.action as any));
      }
      if (filters.resource) {
        query = query.where(eq(auditLogs.resource, filters.resource));
      }
      if (filters.success !== undefined) {
        query = query.where(eq(auditLogs.success, filters.success));
      }
      if (filters.startDate) {
        query = query.where(gte(auditLogs.createdAt, filters.startDate));
      }
      if (filters.endDate) {
        query = query.where(lte(auditLogs.createdAt, filters.endDate));
      }

      query = query.orderBy(desc(auditLogs.createdAt));

      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      if (filters.offset) {
        query = query.offset(filters.offset);
      }

      return await query;
    } catch (error) {
      logger.error('Failed to query audit logs', {
        error: error instanceof Error ? error.message : String(error),
        filters,
      });
      throw error;
    }
  }

  // Get audit statistics
  async getStats(timeframe: '24h' | '7d' | '30d' = '24h') {
    try {
      const startDate = new Date();
      switch (timeframe) {
        case '24h':
          startDate.setHours(startDate.getHours() - 24);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
      }

      const logs = await this.query({ startDate, limit: 10000 });

      const stats = {
        total: logs.length,
        successful: logs.filter(log => log.success).length,
        failed: logs.filter(log => !log.success).length,
        byAction: {} as Record<string, number>,
        byUser: {} as Record<string, number>,
        recentFailures: logs.filter(log => !log.success).slice(0, 10),
      };

      logs.forEach(log => {
        stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
        if (log.userId) {
          stats.byUser[log.userId] = (stats.byUser[log.userId] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get audit stats', {
        error: error instanceof Error ? error.message : String(error),
        timeframe,
      });
      throw error;
    }
  }
}

export const auditLogger = new AuditLogger();

// Helper functions for common audit events
export const auditEvents = {
  userLogin: (userId: string, ipAddress?: string, provider?: string) =>
    auditLogger.log({
      userId,
      action: 'login',
      ipAddress,
      details: { provider },
    }),

  userLogout: (userId: string, ipAddress?: string) =>
    auditLogger.log({
      userId,
      action: 'logout',
      ipAddress,
    }),

  userRegistration: (userId: string, email: string, ipAddress?: string) =>
    auditLogger.log({
      userId,
      action: 'register',
      ipAddress,
      details: { email },
    }),

  passwordChange: (userId: string, ipAddress?: string) =>
    auditLogger.log({
      userId,
      action: 'password_change',
      ipAddress,
    }),

  mfaEnabled: (userId: string, ipAddress?: string) =>
    auditLogger.log({
      userId,
      action: 'mfa_enable',
      ipAddress,
    }),

  mfaDisabled: (userId: string, ipAddress?: string) =>
    auditLogger.log({
      userId,
      action: 'mfa_disable',
      ipAddress,
    }),

  roleChange: (
    userId: string,
    oldRole: string,
    newRole: string,
    changedBy?: string,
    ipAddress?: string
  ) =>
    auditLogger.log({
      userId,
      action: 'role_change',
      ipAddress,
      oldValues: { role: oldRole },
      newValues: { role: newRole },
      details: { changedBy },
    }),

  accountLocked: (userId: string, reason: string, ipAddress?: string) =>
    auditLogger.log({
      userId,
      action: 'account_lock',
      ipAddress,
      details: { reason },
    }),

  accountUnlocked: (userId: string, unlockedBy?: string, ipAddress?: string) =>
    auditLogger.log({
      userId,
      action: 'account_unlock',
      ipAddress,
      details: { unlockedBy },
    }),

  apiAccess: (
    userId: string,
    endpoint: string,
    method: string,
    ipAddress?: string,
    userAgent?: string
  ) =>
    auditLogger.log({
      userId,
      action: 'api_access',
      resource: endpoint,
      ipAddress,
      userAgent,
      details: { method },
    }),

  adminAction: (
    adminId: string,
    action: string,
    targetUserId?: string,
    details?: Record<string, any>,
    ipAddress?: string
  ) =>
    auditLogger.log({
      userId: adminId,
      action: 'admin_action',
      resourceId: targetUserId,
      ipAddress,
      details: { adminAction: action, ...details },
    }),
};

export { logger };
