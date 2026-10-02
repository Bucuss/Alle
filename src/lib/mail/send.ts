// Cloudflare Email Sending (send_email binding) 发送封装
import emailDB from '@/lib/db/email';
import { recordSend, countSendsToday } from '@/lib/db/send';

import type { EmailSendOptions } from '@/types/email-send';

export const DEFAULT_FROM = 'me@gear4ai.com';
export const DEFAULT_DAILY_QUOTA = 100;

export interface SendMailInput {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
  inReplyTo?: string;
  headers?: Record<string, string>;
  /** 只组装不发送，返回将要发送的内容 */
  dryRun?: boolean;
  /** MCP/API key 场景：用于限额与日志 */
  apiKeyId?: number | null;
  dailyQuota?: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeAddrs(addrs: string[] | undefined, field: string): string[] {
  const list = (addrs || []).map((a) => a.trim().toLowerCase()).filter(Boolean);
  for (const a of list) {
    if (!EMAIL_RE.test(a)) throw new Error(`无效的邮箱地址 (${field}): ${a}`);
  }
  return [...new Set(list)];
}

export function buildReplySubject(subject: string | null): string {
  const s = (subject || '').trim();
  if (/^re:/i.test(s)) return s;
  return s ? `Re: ${s}` : 'Re:';
}

export function buildForwardSubject(subject: string | null): string {
  const s = (subject || '').trim();
  if (/^fw:/i.test(s)) return s;
  return s ? `Fw: ${s}` : 'Fw:';
}

/** 生成引用原文（回复时用） */
export function buildQuotedBody(from: string | null, sentAt: string | null, bodyText: string | null): string {
  const header = `On ${sentAt || ''}, ${from || ''} wrote:`;
  const quoted = (bodyText || '')
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');
  return `\n\n${header}\n${quoted}`;
}

export async function sendMail(env: CloudflareEnv, input: SendMailInput) {
  const to = normalizeAddrs(input.to, 'to');
  if (to.length === 0) throw new Error('收件人不能为空');

  const cc = normalizeAddrs(input.cc, 'cc');
  const bcc = normalizeAddrs(input.bcc, 'bcc');
  if (to.length + cc.length + bcc.length > 50) throw new Error('收件人总数不能超过 50');

  const subject = (input.subject || '').trim();
  if (!subject) throw new Error('主题不能为空');
  if (!input.text && !input.html) throw new Error('正文不能为空（text/html 至少其一）');

  const from = (input.from || DEFAULT_FROM).trim().toLowerCase();
  if (!from.endsWith('@gear4ai.com')) throw new Error('发件人必须是 gear4ai.com 域名');

  // 每日限额（仅 apiKey 场景）
  if (input.apiKeyId) {
    const quota = input.dailyQuota ?? DEFAULT_DAILY_QUOTA;
    const used = await countSendsToday(env, input.apiKeyId);
    if (used >= quota) throw new Error(`今日发送额度已用完 (${used}/${quota})`);
  }

  const options: EmailSendOptions = {
    to,
    from: input.fromName ? { email: from, name: input.fromName } : from,
    subject,
    ...(input.text ? { text: input.text } : {}),
    ...(input.html ? { html: input.html } : {}),
    ...(cc.length ? { cc } : {}),
    ...(bcc.length ? { bcc } : {}),
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    ...(input.inReplyTo ? { inReplyTo: input.inReplyTo } : {}),
    ...(input.headers ? { headers: input.headers } : {}),
  };

  if (input.dryRun) {
    return { dryRun: true as const, options };
  }

  const binding = (env as unknown as { EMAIL?: { send: (o: EmailSendOptions) => Promise<{ messageId: string }> } }).EMAIL;
  if (!binding) throw new Error('Email Sending 未配置（缺少 send_email binding）');

  let messageId: string | null = null;
  try {
    const res = await binding.send(options);
    messageId = res.messageId || null;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await recordSend(env, {
      apiKeyId: input.apiKeyId ?? null,
      messageId: null,
      fromAddress: from,
      toAddresses: to.join(','),
      subject,
      status: 'failed',
      error: err,
    });
    throw new Error(`发送失败: ${err}`);
  }

  // 存入已发送
  const stored = await emailDB.create(env, {
    messageId,
    fromAddress: from,
    fromName: input.fromName || null,
    toAddress: to.join(', '),
    recipient: JSON.stringify(to),
    title: subject,
    bodyText: input.text || '',
    bodyHtml: input.html || '',
    sentAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    emailType: 'none',
    emailResult: null,
    emailResultText: null,
    emailError: null,
    readStatus: 1,
    category: null,
    direction: 'outbound',
  });

  await recordSend(env, {
    apiKeyId: input.apiKeyId ?? null,
    messageId,
    fromAddress: from,
    toAddresses: to.join(','),
    subject,
    status: 'sent',
    error: null,
  });

  return { messageId, id: stored.id };
}
