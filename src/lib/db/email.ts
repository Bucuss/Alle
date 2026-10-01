import { getDb, getDbFromEnv } from './common';
import { sql, inArray, desc } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

import type { Email, NewEmail, ListParams, ExtractResultType } from '@/types';

const email = sqliteTable('email', {
  id: integer('id').primaryKey(),
  messageId: text('message_id').unique(),
  fromAddress: text('from_address'),
  fromName: text('from_name'),
  toAddress: text('to_address'),
  recipient: text('recipient'),
  title: text('title'),
  bodyText: text('body_text'),
  bodyHtml: text('body_html'),
  sentAt: text('sent_at'),
  receivedAt: text('received_at'),
  emailType: text('email_type'),
  emailResult: text('email_result'),
  emailResultText: text('email_result_text'),
  emailError: text('email_error'),
  readStatus: integer('read_status').default(0),
  category: text('category'),
});

const UNCATEGORIZED = '__none__';

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function buildConditions(params: ListParams) {
  const { readStatus, emailType, recipient, search, category } = params;
  const conditions = [];

  if (readStatus === 1) {
    conditions.push(sql`${email.readStatus} = 1`);
  } else if (readStatus === 0) {
    conditions.push(sql`${email.readStatus} = 0`);
  }

  if (emailType) {
    const types = emailType.split(',').map(t => t.trim()).filter(Boolean);
    if (types.length > 1) {
      conditions.push(inArray(email.emailType, types));
    } else if (types.length === 1) {
      conditions.push(sql`${email.emailType} = ${types[0]}`);
    }
  }

  if (recipient) {
    const recipients = recipient.split(',').map(r => r.trim()).filter(Boolean);
    if (recipients.length > 1) {
      conditions.push(inArray(email.toAddress, recipients));
    } else if (recipients.length === 1) {
      conditions.push(sql`${email.toAddress} = ${recipients[0]}`);
    }
  }

  if (search) {
    const q = `%${escapeLike(search.trim())}%`;
    conditions.push(sql`(${email.title} LIKE ${q} ESCAPE '\\' OR ${email.bodyText} LIKE ${q} ESCAPE '\\' OR ${email.fromAddress} LIKE ${q} ESCAPE '\\' OR ${email.fromName} LIKE ${q} ESCAPE '\\')`);
  }

  if (category) {
    const cats = category.split(',').map(c => c.trim()).filter(Boolean);
    const named = cats.filter(c => c !== UNCATEGORIZED);
    const includeNone = cats.includes(UNCATEGORIZED);
    if (named.length > 0 && includeNone) {
      conditions.push(sql`(${inArray(email.category, named)} OR ${email.category} IS NULL OR ${email.category} = '')`);
    } else if (named.length > 0) {
      conditions.push(inArray(email.category, named));
    } else if (includeNone) {
      conditions.push(sql`(${email.category} IS NULL OR ${email.category} = '')`);
    }
  }

  if (conditions.length === 0) return undefined;
  return conditions.length === 1
    ? conditions[0]
    : conditions.reduce((acc, condition) => sql`${acc} AND ${condition}`);
}

const emailDB = {
  async list(params: ListParams = {}): Promise<Email[]> {
    const db = getDb();
    const { limit = 100, offset = 0 } = params;
    const whereClause = buildConditions(params);

    const query = whereClause
      ? db.select().from(email).where(whereClause)
      : db.select().from(email);

    const rows = await query
      .orderBy(desc(email.sentAt))
      .limit(limit)
      .offset(offset);
    return rows as Email[];
  },

  async count(params: ListParams = {}): Promise<number> {
    const db = getDb();
    const whereClause = buildConditions(params);

    const query = whereClause
      ? db.select({ count: sql<number>`count(*)` }).from(email).where(whereClause)
      : db.select({ count: sql<number>`count(*)` }).from(email);

    const result = await query;
    return result[0]?.count || 0;
  },
  async delete(items: number[] = []): Promise<void> {
    const db = getDb();
    await db.delete(email).where(inArray(email.id, items));
  },

  async update(params: {
    id: number;
    emailResult: string | null;
    emailType: ExtractResultType;
  }): Promise<void> {
    const db = getDb();
    const { id, emailType, emailResult } = params;

    await db.update(email)
      .set({ emailType, emailResult })
      .where(sql`${email.id} = ${id}`);
  },

  async markAsRead(id: number): Promise<void> {
    const db = getDb();
    await db.update(email)
      .set({ readStatus: 1 })
      .where(sql`${email.id} = ${id}`);
  },

  /** 分类队列：取出一批尚未分类的邮件（category IS NULL），按 id 升序 */
  async listUnclassified(env: CloudflareEnv, limit: number): Promise<Pick<Email, 'id' | 'title' | 'bodyText'>[]> {
    const db = getDbFromEnv(env);
    return db
      .select({ id: email.id, title: email.title, bodyText: email.bodyText })
      .from(email)
      .where(sql`${email.category} IS NULL`)
      .orderBy(email.id)
      .limit(limit);
  },

  /** 分类结果回写 */
  async updateCategory(env: CloudflareEnv, id: number, category: string): Promise<void> {
    const db = getDbFromEnv(env);
    await db.update(email)
      .set({ category })
      .where(sql`${email.id} = ${id}`);
  },

  async markAsUnread(id: number): Promise<void> {
    const db = getDb();
    await db.update(email)
      .set({ readStatus: 0 })
      .where(sql`${email.id} = ${id}`);
  },

  async markMultipleAsRead(ids: number[]): Promise<void> {
    const db = getDb();
    await db.update(email)
      .set({ readStatus: 1 })
      .where(inArray(email.id, ids));
  },

  async markMultipleAsUnread(ids: number[]): Promise<void> {
    const db = getDb();
    await db.update(email)
      .set({ readStatus: 0 })
      .where(inArray(email.id, ids));
  },


  async deleteExpiredByType(env: CloudflareEnv, types: string[], expiredDate: string): Promise<number[]> {
    const db = getDbFromEnv(env);

    const typeConditions = types.map(type => sql`${email.emailType} = ${type}`);
    const combinedCondition = typeConditions.length > 1
      ? sql`${typeConditions[0]} OR ${typeConditions.slice(1).reduce((acc, condition) => sql`${acc} OR ${condition}`)}`
      : typeConditions[0];

    const expiredEmails = await db
      .select({ id: email.id })
      .from(email)
      .where(
        sql`(${combinedCondition}) AND ${email.sentAt} < ${expiredDate}`
      );

    if (!expiredEmails || expiredEmails.length === 0) {
      return [];
    }

    const ids = expiredEmails.map((e: { id: number }) => e.id);
    await db.delete(email).where(inArray(email.id, ids));
    return ids;
  },

  async create(env: CloudflareEnv, data: NewEmail): Promise<Email> {
    const db = getDbFromEnv(env);

    // 确保 emailType 不为 null
    if (!data.emailType) {
      throw new Error('emailType is required and cannot be null');
    }

    const row = await db.insert(email).values(data).returning().get();
    return row as Email;
  },

  async getAllRecipients(): Promise<string[]> {
    const db = getDb();

    const recipients = await db
      .select({ toAddress: email.toAddress })
      .from(email)
      .where(sql`${email.toAddress} IS NOT NULL`)
      .groupBy(email.toAddress)
      .orderBy(email.toAddress);

    return recipients.map(r => r.toAddress).filter(Boolean) as string[];
  },
};

export default emailDB;
