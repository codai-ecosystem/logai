// Enterprise Database Schema for LogAI
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  jsonb,
  varchar,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { AdapterAccount } from '@auth/core/adapters';

// Enums
export const userRoleEnum = pgEnum('user_role', [
  'super_admin',
  'admin',
  'manager',
  'user',
  'guest',
  'service_account',
]);

export const sessionStatusEnum = pgEnum('session_status', [
  'active',
  'expired',
  'revoked',
  'suspended',
]);

export const auditActionEnum = pgEnum('audit_action', [
  'login',
  'logout',
  'register',
  'password_change',
  'mfa_enable',
  'mfa_disable',
  'role_change',
  'permission_grant',
  'permission_revoke',
  'account_lock',
  'account_unlock',
  'password_reset',
  'email_change',
  'profile_update',
  'api_access',
  'admin_action',
]);

// Users table - Core identity management
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    emailVerified: timestamp('email_verified', { mode: 'date' }),
    name: varchar('name', { length: 255 }),
    image: text('image'),
    role: userRoleEnum('role').default('user').notNull(),

    // Security fields
    passwordHash: text('password_hash'),
    isActive: boolean('is_active').default(true).notNull(),
    isLocked: boolean('is_locked').default(false).notNull(),
    lockReason: text('lock_reason'),
    loginAttempts: integer('login_attempts').default(0).notNull(),
    lastLoginAt: timestamp('last_login_at', { mode: 'date' }),
    lastLoginIp: varchar('last_login_ip', { length: 45 }),

    // MFA fields
    mfaEnabled: boolean('mfa_enabled').default(false).notNull(),
    mfaSecret: text('mfa_secret'),
    mfaBackupCodes: text('mfa_backup_codes').array(),

    // Profile fields
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    phone: varchar('phone', { length: 20 }),
    timezone: varchar('timezone', { length: 50 }).default('UTC'),
    locale: varchar('locale', { length: 10 }).default('en'),

    // Metadata
    metadata: jsonb('metadata'),
    preferences: jsonb('preferences'),

    // Timestamps
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  table => ({
    emailIdx: index('users_email_idx').on(table.email),
    roleIdx: index('users_role_idx').on(table.role),
    activeIdx: index('users_active_idx').on(table.isActive),
  })
);

// OAuth Accounts
export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccount['type']>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  table => ({
    pk: uniqueIndex('accounts_provider_provider_account_id_idx').on(
      table.provider,
      table.providerAccountId
    ),
    userIdx: index('accounts_user_id_idx').on(table.userId),
  })
);

// Sessions - Enhanced session management
export const sessions = pgTable(
  'sessions',
  {
    sessionToken: text('session_token').notNull().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
    status: sessionStatusEnum('status').default('active').notNull(),

    // Enhanced session tracking
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    device: varchar('device', { length: 100 }),
    location: jsonb('location'), // City, country, etc.

    // Security
    isSecure: boolean('is_secure').default(false).notNull(),
    lastActivity: timestamp('last_activity', { mode: 'date' })
      .defaultNow()
      .notNull(),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  table => ({
    userIdx: index('sessions_user_id_idx').on(table.userId),
    statusIdx: index('sessions_status_idx').on(table.status),
    expiresIdx: index('sessions_expires_idx').on(table.expires),
  })
);

// Verification tokens
export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
    type: varchar('type', { length: 50 })
      .default('email_verification')
      .notNull(),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  table => ({
    pk: uniqueIndex('verification_tokens_identifier_token_idx').on(
      table.identifier,
      table.token
    ),
  })
);

// Permissions system
export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull().unique(),
    description: text('description'),
    resource: varchar('resource', { length: 100 }).notNull(),
    action: varchar('action', { length: 50 }).notNull(),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  table => ({
    nameIdx: uniqueIndex('permissions_name_idx').on(table.name),
    resourceActionIdx: index('permissions_resource_action_idx').on(
      table.resource,
      table.action
    ),
  })
);

// Role permissions
export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    role: userRoleEnum('role').notNull(),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  table => ({
    rolePermissionIdx: uniqueIndex('role_permissions_role_permission_idx').on(
      table.role,
      table.permissionId
    ),
  })
);

// User permissions (individual overrides)
export const userPermissions = pgTable(
  'user_permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    granted: boolean('granted').default(true).notNull(),
    grantedBy: uuid('granted_by').references(() => users.id),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  table => ({
    userPermissionIdx: uniqueIndex('user_permissions_user_permission_idx').on(
      table.userId,
      table.permissionId
    ),
  })
);

// Audit logs
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id),
    action: auditActionEnum('action').notNull(),
    resource: varchar('resource', { length: 100 }),
    resourceId: text('resource_id'),

    // Request context
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),

    // Metadata
    details: jsonb('details'),
    oldValues: jsonb('old_values'),
    newValues: jsonb('new_values'),

    // Success/failure
    success: boolean('success').default(true).notNull(),
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  table => ({
    userIdx: index('audit_logs_user_id_idx').on(table.userId),
    actionIdx: index('audit_logs_action_idx').on(table.action),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
    resourceIdx: index('audit_logs_resource_idx').on(table.resource),
  })
);

// API Keys for service-to-service authentication
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    keyHash: text('key_hash').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Permissions
    permissions: text('permissions').array(),
    scopes: text('scopes').array(),

    // Status
    isActive: boolean('is_active').default(true).notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date' }),
    lastUsedAt: timestamp('last_used_at', { mode: 'date' }),

    // Rate limiting
    rateLimit: integer('rate_limit').default(1000).notNull(), // requests per hour

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  table => ({
    userIdx: index('api_keys_user_id_idx').on(table.userId),
    activeIdx: index('api_keys_active_idx').on(table.isActive),
  })
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  userPermissions: many(userPermissions),
  auditLogs: many(auditLogs),
  apiKeys: many(apiKeys),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const userPermissionsRelations = relations(
  userPermissions,
  ({ one }) => ({
    user: one(users, {
      fields: [userPermissions.userId],
      references: [users.id],
    }),
    permission: one(permissions, {
      fields: [userPermissions.permissionId],
      references: [permissions.id],
    }),
  })
);

export const rolePermissionsRelations = relations(
  rolePermissions,
  ({ one }) => ({
    permission: one(permissions, {
      fields: [rolePermissions.permissionId],
      references: [permissions.id],
    }),
  })
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}));

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
