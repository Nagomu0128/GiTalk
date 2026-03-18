import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const visibilityType = pgEnum('visibility_type', ['private', 'public']);
export const nodeType = pgEnum('node_type', ['message', 'summary', 'system']);

// ============================================================
// User
// ============================================================
export const users = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseUid: varchar('firebase_uid', { length: 128 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 2048 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// Repository
// ============================================================
export const repositories = pgTable(
  'repository',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    visibility: visibilityType('visibility').notNull().default('private'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_repository_owner').on(table.ownerId),
    index('idx_repository_deleted').on(table.deletedAt),
  ],
);

// ============================================================
// Conversation
// ============================================================
export const conversations = pgTable(
  'conversation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    repositoryId: uuid('repository_id').references(() => repositories.id, {
      onDelete: 'set null',
    }),
    activeBranchId: uuid('active_branch_id'),
    contextMode: varchar('context_mode', { length: 10 }).notNull().default('summary'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_conversation_owner').on(table.ownerId),
    index('idx_conversation_deleted').on(table.deletedAt),
  ],
);

// ============================================================
// Branch
// ============================================================
export const branches = pgTable(
  'branch',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    headNodeId: uuid('head_node_id'),
    baseNodeId: uuid('base_node_id'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_branch_conversation').on(table.conversationId)],
);

// ============================================================
// Node
// ============================================================
export const nodes = pgTable(
  'node',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    parentId: uuid('parent_id'),
    nodeType: nodeType('node_type').notNull().default('message'),
    userMessage: text('user_message').notNull(),
    aiResponse: text('ai_response').notNull(),
    model: varchar('model', { length: 50 }).notNull(),
    tokenCount: integer('token_count').notNull().default(0),
    metadata: jsonb('metadata'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_node_parent').on(table.parentId),
    index('idx_node_conversation').on(table.conversationId),
    index('idx_node_branch').on(table.branchId),
  ],
);

// ============================================================
// RepositoryBranch
// ============================================================
export const repositoryBranches = pgTable(
  'repository_branch',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    sourceBranchId: uuid('source_branch_id').references(() => branches.id, {
      onDelete: 'set null',
    }),
    name: varchar('name', { length: 100 }).notNull(),
    pushedAt: timestamp('pushed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_repository_branch_repo').on(table.repositoryId),
    uniqueIndex('idx_repository_branch_unique')
      .on(table.repositoryId, table.sourceBranchId),
  ],
);

// ============================================================
// RepositoryNode
// ============================================================
export const repositoryNodes = pgTable(
  'repository_node',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    repositoryBranchId: uuid('repository_branch_id')
      .notNull()
      .references(() => repositoryBranches.id, { onDelete: 'cascade' }),
    originalNodeId: uuid('original_node_id'),
    parentRepositoryNodeId: uuid('parent_repository_node_id'),
    nodeType: nodeType('node_type').notNull().default('message'),
    userMessage: text('user_message').notNull(),
    aiResponse: text('ai_response').notNull(),
    model: varchar('model', { length: 50 }).notNull(),
    tokenCount: integer('token_count').notNull().default(0),
    metadata: jsonb('metadata'),
    originalBranchName: varchar('original_branch_name', { length: 100 }),
    originalCreatedAt: timestamp('original_created_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_repository_node_branch').on(table.repositoryBranchId),
    index('idx_repository_node_parent').on(table.parentRepositoryNodeId),
  ],
);
