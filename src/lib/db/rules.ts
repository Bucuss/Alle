import { getDb, getDbFromEnv } from './common';
import { sql, asc, inArray } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

import type { ForwardRule, NewForwardRule } from '@/types';

export const forwardRules = sqliteTable('forward_rules', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  enabled: integer('enabled').notNull().default(1),
  priority: integer('priority').notNull().default(0),
  matchType: text('match_type').notNull().default('all'),
  matchValue: text('match_value').notNull().default(''),
  action: text('action').notNull().default('accept'),
  store: integer('store').notNull().default(1),
  forwardTo: text('forward_to'),
  notifyTelegram: integer('notify_telegram').notNull().default(0),
  notifyWebhook: integer('notify_webhook').notNull().default(0),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

const rulesDB = {
  /** 网页端：列出全部规则（按优先级排序） */
  async list(): Promise<ForwardRule[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(forwardRules)
      .orderBy(asc(forwardRules.priority), asc(forwardRules.id));
    return rows as ForwardRule[];
  },

  /** worker 收信时：只取启用的规则（按优先级排序）。表不存在时返回 []（兼容迁移前） */
  async listEnabled(env: CloudflareEnv): Promise<ForwardRule[]> {
    try {
      const db = getDbFromEnv(env);
      const rows = await db
        .select()
        .from(forwardRules)
        .where(sql`${forwardRules.enabled} = 1`)
        .orderBy(asc(forwardRules.priority), asc(forwardRules.id));
      return rows as ForwardRule[];
    } catch (e) {
      console.warn('forward_rules table not available, skipping rules:', e);
      return [];
    }
  },

  /** 是否存在任何规则（决定是否走规则引擎，空表=兼容旧行为） */
  async hasAny(env: CloudflareEnv): Promise<boolean> {
    try {
      const db = getDbFromEnv(env);
      const rows = await db
        .select({ id: forwardRules.id })
        .from(forwardRules)
        .limit(1);
      return rows.length > 0;
    } catch (e) {
      console.warn('forward_rules table not available, using legacy behavior:', e);
      return false;
    }
  },

  async create(data: NewForwardRule): Promise<ForwardRule> {
    const db = getDb();
    const row = await db.insert(forwardRules).values(data).returning().get();
    return row as ForwardRule;
  },

  async update(id: number, data: Partial<NewForwardRule>): Promise<void> {
    const db = getDb();
    await db
      .update(forwardRules)
      .set({ ...data, updatedAt: sql`datetime('now')` })
      .where(sql`${forwardRules.id} = ${id}`);
  },

  async remove(ids: number[]): Promise<void> {
    const db = getDb();
    await db.delete(forwardRules).where(inArray(forwardRules.id, ids));
  },
};

export default rulesDB;
