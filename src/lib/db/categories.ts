import { getDb, getDbFromEnv } from './common';
import { sql, asc, inArray } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

import type { Category, NewCategory } from '@/types';

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey(),
  name: text('name').notNull().unique(),
  enabled: integer('enabled').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
});

const categoriesDB = {
  /** 网页端：列出全部分类 */
  async list(): Promise<Category[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.id));
    return rows as Category[];
  },

  /** worker 收信时：取启用的分类名（供 AI 归类）。表不存在时返回 []（兼容迁移前） */
  async listEnabledNames(env: CloudflareEnv): Promise<string[]> {
    try {
      const db = getDbFromEnv(env);
      const rows = await db
        .select({ name: categories.name })
        .from(categories)
        .where(sql`${categories.enabled} = 1`)
        .orderBy(asc(categories.sortOrder), asc(categories.id));
      return rows.map((r) => r.name).filter(Boolean) as string[];
    } catch (e) {
      console.warn('categories table not available, skipping AI categorization:', e);
      return [];
    }
  },

  async create(data: NewCategory): Promise<Category> {
    const db = getDb();
    const row = await db.insert(categories).values(data).returning().get();
    return row as Category;
  },

  async update(id: number, data: Partial<NewCategory>): Promise<void> {
    const db = getDb();
    await db
      .update(categories)
      .set(data)
      .where(sql`${categories.id} = ${id}`);
  },

  async remove(ids: number[]): Promise<void> {
    const db = getDb();
    await db.delete(categories).where(inArray(categories.id, ids));
  },
};

export default categoriesDB;
