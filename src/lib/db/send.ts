// drafts / api_keys / send_log 的 DB 层
import { getDbFromEnv } from './common';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { eq, and, gte, sql } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';

export const drafts = sqliteTable('drafts', {
  id: integer('id').primaryKey(),
  toAddresses: text('to_addresses').default(''),
  ccAddresses: text('cc_addresses').default(''),
  bccAddresses: text('bcc_addresses').default(''),
  subject: text('subject').default(''),
  bodyText: text('body_text').default(''),
  bodyHtml: text('body_html').default(''),
  inReplyTo: text('in_reply_to'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const apiKeys = sqliteTable('api_keys', {
  id: integer('id').primaryKey(),
  name: text('name'),
  keyPrefix: text('key_prefix'),
  keyHash: text('key_hash').unique(),
  createdAt: text('created_at'),
  lastUsedAt: text('last_used_at'),
  revoked: integer('revoked').default(0),
});

export const sendLog = sqliteTable('send_log', {
  id: integer('id').primaryKey(),
  apiKeyId: integer('api_key_id'),
  messageId: text('message_id'),
  fromAddress: text('from_address'),
  toAddresses: text('to_addresses'),
  subject: text('subject').default(''),
  status: text('status').default('sent'),
  error: text('error'),
  createdAt: text('created_at'),
});

export interface DraftInput {
  toAddresses?: string;
  ccAddresses?: string;
  bccAddresses?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  inReplyTo?: string | null;
}

const now = () => new Date().toISOString();

export const draftDB = {
  async list(env: CloudflareEnv) {
    const db = getDbFromEnv(env);
    return db.select().from(drafts).orderBy(sql`${drafts.updatedAt} DESC`).all();
  },
  async get(env: CloudflareEnv, id: number) {
    const db = getDbFromEnv(env);
    return db.select().from(drafts).where(eq(drafts.id, id)).get();
  },
  async create(env: CloudflareEnv, input: DraftInput) {
    const db = getDbFromEnv(env);
    const t = now();
    return db
      .insert(drafts)
      .values({
        toAddresses: input.toAddresses || '',
        ccAddresses: input.ccAddresses || '',
        bccAddresses: input.bccAddresses || '',
        subject: input.subject || '',
        bodyText: input.bodyText || '',
        bodyHtml: input.bodyHtml || '',
        inReplyTo: input.inReplyTo || null,
        createdAt: t,
        updatedAt: t,
      })
      .returning()
      .get();
  },
  async update(env: CloudflareEnv, id: number, input: DraftInput) {
    const db = getDbFromEnv(env);
    const patch: Record<string, unknown> = { updatedAt: now() };
    if (input.toAddresses !== undefined) patch.toAddresses = input.toAddresses;
    if (input.ccAddresses !== undefined) patch.ccAddresses = input.ccAddresses;
    if (input.bccAddresses !== undefined) patch.bccAddresses = input.bccAddresses;
    if (input.subject !== undefined) patch.subject = input.subject;
    if (input.bodyText !== undefined) patch.bodyText = input.bodyText;
    if (input.bodyHtml !== undefined) patch.bodyHtml = input.bodyHtml;
    if (input.inReplyTo !== undefined) patch.inReplyTo = input.inReplyTo;
    return db.update(drafts).set(patch).where(eq(drafts.id, id)).returning().get();
  },
  async remove(env: CloudflareEnv, id: number) {
    const db = getDbFromEnv(env);
    return db.delete(drafts).where(eq(drafts.id, id)).run();
  },
};

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function generateApiKey(): { raw: string; prefix: string } {
  const raw = 'ak_' + randomBytes(24).toString('base64url');
  return { raw, prefix: raw.slice(0, 11) };
}

export const apiKeyDB = {
  async create(env: CloudflareEnv, name: string) {
    const db = getDbFromEnv(env);
    const { raw, prefix } = generateApiKey();
    const row = await db
      .insert(apiKeys)
      .values({ name, keyPrefix: prefix, keyHash: hashApiKey(raw), createdAt: now(), revoked: 0 })
      .returning()
      .get();
    // raw 只返回一次
    return { id: row.id, name: row.name, prefix, raw, createdAt: row.createdAt };
  },
  async list(env: CloudflareEnv) {
    const db = getDbFromEnv(env);
    return db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        createdAt: apiKeys.createdAt,
        lastUsedAt: apiKeys.lastUsedAt,
        revoked: apiKeys.revoked,
      })
      .from(apiKeys)
      .orderBy(sql`${apiKeys.id} DESC`)
      .all();
  },
  async verify(env: CloudflareEnv, raw: string) {
    const db = getDbFromEnv(env);
    const row = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, hashApiKey(raw)), eq(apiKeys.revoked, 0)))
      .get();
    if (!row) return null;
    await db
      .update(apiKeys)
      .set({ lastUsedAt: now() })
      .where(eq(apiKeys.id, row.id))
      .run();
    return row;
  },
  async revoke(env: CloudflareEnv, id: number) {
    const db = getDbFromEnv(env);
    return db.update(apiKeys).set({ revoked: 1 }).where(eq(apiKeys.id, id)).run();
  },
};

export async function recordSend(
  env: CloudflareEnv,
  data: {
    apiKeyId: number | null;
    messageId: string | null;
    fromAddress: string;
    toAddresses: string;
    subject: string;
    status: string;
    error: string | null;
  }
) {
  const db = getDbFromEnv(env);
  return db
    .insert(sendLog)
    .values({ ...data, createdAt: now() })
    .run();
}

/** 某 key 今日已发送数（UTC 日） */
export async function countSendsToday(env: CloudflareEnv, apiKeyId: number): Promise<number> {
  const db = getDbFromEnv(env);
  const dayStart = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
  const row = await db
    .select({ c: sql<number>`count(*)` })
    .from(sendLog)
    .where(and(eq(sendLog.apiKeyId, apiKeyId), eq(sendLog.status, 'sent'), gte(sendLog.createdAt, dayStart)))
    .get();
  return row?.c ?? 0;
}
