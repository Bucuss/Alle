// Alle MCP Server — 给 agent 用的邮件读写接口
// 极简无状态 Streamable HTTP 实现：POST JSON-RPC 2.0
// 认证：Authorization: Bearer <api_key>
import { getCloudflareContext } from '@opennextjs/cloudflare';
import emailDB from '@/lib/db/email';
import { draftDB, apiKeyDB } from '@/lib/db/send';
import { sendMail, buildReplySubject, buildForwardSubject, buildQuotedBody, DEFAULT_FROM } from '@/lib/mail/send';

import type { NextApiRequest, NextApiResponse } from 'next';

const PROTOCOL_VERSION = '2025-06-18';

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const TOOLS: ToolDef[] = [
  {
    name: 'list_emails',
    description: '分页列出邮件，支持按收发方向/分类/已读/收件人/关键词过滤',
    inputSchema: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['inbound', 'outbound'], description: 'inbound=收件 outbound=发件' },
        category: { type: 'string', description: '分类名，如 验证码/通知提醒/订阅营销/其他' },
        read_status: { type: 'integer', enum: [0, 1], description: '0=未读 1=已读' },
        recipient: { type: 'string', description: '收件地址过滤' },
        q: { type: 'string', description: '关键词搜索（标题/正文/发件人）' },
        limit: { type: 'integer', default: 20, description: '1-100' },
        offset: { type: 'integer', default: 0 },
      },
    },
  },
  {
    name: 'get_email',
    description: '取一封邮件的完整内容（含正文、AI 提取结果、分类）',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer', description: '邮件 id' } },
      required: ['id'],
    },
  },
  {
    name: 'set_read_status',
    description: '设置已读/未读',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer' }, is_read: { type: 'boolean' } },
      required: ['id', 'is_read'],
    },
  },
  {
    name: 'set_category',
    description: '修改邮件分类',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer' }, category: { type: 'string' } },
      required: ['id', 'category'],
    },
  },
  {
    name: 'delete_email',
    description: '删除邮件（不可恢复）',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer' } },
      required: ['id'],
    },
  },
  {
    name: 'send_email',
    description: '发送新邮件。dry_run=true 只组装不发送，用于发送前确认内容',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'array', items: { type: 'string' }, description: '收件人' },
        cc: { type: 'array', items: { type: 'string' } },
        bcc: { type: 'array', items: { type: 'string' } },
        subject: { type: 'string' },
        text: { type: 'string', description: '纯文本正文' },
        html: { type: 'string', description: 'HTML 正文' },
        reply_to: { type: 'string' },
        dry_run: { type: 'boolean', default: false },
      },
      required: ['to', 'subject'],
    },
  },
  {
    name: 'reply_email',
    description: '回复一封邮件（自动处理主题 Re:、引用原文、threading）',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: '要回复的邮件 id' },
        text: { type: 'string', description: '回复正文' },
        html: { type: 'string', description: '回复 HTML 正文' },
        dry_run: { type: 'boolean', default: false },
      },
      required: ['id'],
    },
  },
  {
    name: 'forward_email',
    description: '转发一封邮件',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: '要转发的邮件 id' },
        to: { type: 'array', items: { type: 'string' } },
        dry_run: { type: 'boolean', default: false },
      },
      required: ['id', 'to'],
    },
  },
  {
    name: 'list_drafts',
    description: '列出草稿',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_draft',
    description: '取一条草稿',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer' } },
      required: ['id'],
    },
  },
  {
    name: 'create_draft',
    description: '创建草稿',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: '收件人，逗号分隔' },
        cc: { type: 'string' },
        bcc: { type: 'string' },
        subject: { type: 'string' },
        body_text: { type: 'string' },
        body_html: { type: 'string' },
      },
    },
  },
  {
    name: 'update_draft',
    description: '更新草稿（只传要改的字段）',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        to: { type: 'string' },
        cc: { type: 'string' },
        bcc: { type: 'string' },
        subject: { type: 'string' },
        body_text: { type: 'string' },
        body_html: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_draft',
    description: '删除草稿',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer' } },
      required: ['id'],
    },
  },
  {
    name: 'send_draft',
    description: '发送一条草稿（发送后草稿自动删除）',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer' }, dry_run: { type: 'boolean', default: false } },
      required: ['id'],
    },
  },
];

type Ctx = { env: CloudflareEnv; apiKeyId: number };

function textResult(data: unknown) {
  return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] };
}

function errResult(msg: string) {
  return { content: [{ type: 'text', text: msg }], isError: true };
}

const parseList = (s: string | null) =>
  (s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

async function callTool(name: string, args: Record<string, unknown>, ctx: Ctx) {
  const { env, apiKeyId } = ctx;
  switch (name) {
    case 'list_emails': {
      const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100);
      const rows = await emailDB.list({
        direction: args.direction as string | undefined,
        category: args.category as string | undefined,
        readStatus: args.read_status as number | undefined,
        recipient: args.recipient as string | undefined,
        search: args.q as string | undefined,
        limit,
        offset: Math.max(Number(args.offset) || 0, 0),
      });
      // 列表只返回摘要
      return textResult(
        rows.map((r) => ({
          id: r.id,
          from: r.fromAddress,
          to: r.toAddress,
          subject: r.title,
          category: r.category,
          read: r.readStatus,
          direction: r.direction,
          sent_at: r.sentAt,
          snippet: (r.bodyText || '').slice(0, 120),
        }))
      );
    }
    case 'get_email': {
      const row = await emailDB.getById(Number(args.id));
      if (!row) throw new Error('邮件不存在');
      return textResult(row);
    }
    case 'set_read_status': {
      const id = Number(args.id);
      if (args.is_read) await emailDB.markAsRead(id);
      else await emailDB.markAsUnread(id);
      return textResult({ id, is_read: !!args.is_read });
    }
    case 'set_category': {
      await emailDB.updateCategory(env, Number(args.id), String(args.category));
      return textResult({ id: Number(args.id), category: args.category });
    }
    case 'delete_email': {
      await emailDB.delete([Number(args.id)]);
      return textResult({ id: Number(args.id), deleted: true });
    }
    case 'send_email': {
      const r = await sendMail(env, {
        to: (args.to as string[]) || [],
        cc: args.cc as string[] | undefined,
        bcc: args.bcc as string[] | undefined,
        subject: String(args.subject || ''),
        text: args.text as string | undefined,
        html: args.html as string | undefined,
        replyTo: args.reply_to as string | undefined,
        dryRun: !!args.dry_run,
        apiKeyId,
      });
      return textResult(r);
    }
    case 'reply_email': {
      const orig = await emailDB.getById(Number(args.id));
      if (!orig) throw new Error('邮件不存在');
      const toAddr = orig.direction === 'outbound' ? parseList(orig.toAddress) : [orig.fromAddress].filter(Boolean) as string[];
      if (!toAddr.length) throw new Error('找不到回复目标地址');
      const body = (args.text as string | undefined) || '';
      const r = await sendMail(env, {
        to: toAddr,
        subject: buildReplySubject(orig.title),
        text: body + buildQuotedBody(orig.fromAddress, orig.sentAt, orig.bodyText),
        ...(args.html ? { html: args.html as string } : {}),
        inReplyTo: orig.messageId || undefined,
        dryRun: !!args.dry_run,
        apiKeyId,
      });
      return textResult(r);
    }
    case 'forward_email': {
      const orig = await emailDB.getById(Number(args.id));
      if (!orig) throw new Error('邮件不存在');
      const header = `---------- Forwarded message ----------\nFrom: ${orig.fromAddress || ''}\nDate: ${orig.sentAt || ''}\nSubject: ${orig.title || ''}\nTo: ${orig.toAddress || ''}\n\n`;
      const r = await sendMail(env, {
        to: (args.to as string[]) || [],
        subject: buildForwardSubject(orig.title),
        text: header + (orig.bodyText || ''),
        ...(orig.bodyHtml ? { html: `<p>---------- Forwarded message ----------<br>From: ${orig.fromAddress || ''}<br>Date: ${orig.sentAt || ''}<br>Subject: ${orig.title || ''}</p>` + orig.bodyHtml } : {}),
        dryRun: !!args.dry_run,
        apiKeyId,
      });
      return textResult(r);
    }
    case 'list_drafts': {
      return textResult(await draftDB.list(env));
    }
    case 'get_draft': {
      const d = await draftDB.get(env, Number(args.id));
      if (!d) throw new Error('草稿不存在');
      return textResult(d);
    }
    case 'create_draft': {
      const d = await draftDB.create(env, {
        toAddresses: (args.to as string) || '',
        ccAddresses: (args.cc as string) || '',
        bccAddresses: (args.bcc as string) || '',
        subject: (args.subject as string) || '',
        bodyText: (args.body_text as string) || '',
        bodyHtml: (args.body_html as string) || '',
      });
      return textResult(d);
    }
    case 'update_draft': {
      const d = await draftDB.update(env, Number(args.id), {
        ...(args.to !== undefined ? { toAddresses: args.to as string } : {}),
        ...(args.cc !== undefined ? { ccAddresses: args.cc as string } : {}),
        ...(args.bcc !== undefined ? { bccAddresses: args.bcc as string } : {}),
        ...(args.subject !== undefined ? { subject: args.subject as string } : {}),
        ...(args.body_text !== undefined ? { bodyText: args.body_text as string } : {}),
        ...(args.body_html !== undefined ? { bodyHtml: args.body_html as string } : {}),
      });
      if (!d) throw new Error('草稿不存在');
      return textResult(d);
    }
    case 'delete_draft': {
      await draftDB.remove(env, Number(args.id));
      return textResult({ id: Number(args.id), deleted: true });
    }
    case 'send_draft': {
      const d = await draftDB.get(env, Number(args.id));
      if (!d) throw new Error('草稿不存在');
      const r = await sendMail(env, {
        to: parseList(d.toAddresses),
        cc: parseList(d.ccAddresses),
        bcc: parseList(d.bccAddresses),
        subject: d.subject || '',
        text: d.bodyText || undefined,
        html: d.bodyHtml || undefined,
        from: DEFAULT_FROM,
        inReplyTo: d.inReplyTo || undefined,
        dryRun: !!args.dry_run,
        apiKeyId,
      });
      if (!args.dry_run) await draftDB.remove(env, Number(args.id));
      return textResult(r);
    }
    default:
      throw new Error(`未知工具: ${name}`);
  }
}

async function authenticate(req: NextApiRequest): Promise<{ env: CloudflareEnv; apiKeyId: number } | null> {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  const { env } = await getCloudflareContext();
  const row = await apiKeyDB.verify(env as CloudflareEnv, h.slice(7).trim());
  if (!row) return null;
  return { env: env as CloudflareEnv, apiKeyId: row.id as number };
}

export default async function mcpHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed, use POST' });
  }

  const auth = await authenticate(req);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized: 需要有效的 API Key（Authorization: Bearer <key>）' });
  }

  let body: { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }

  const { id = null, method, params = {} } = body || {};
  const ok = (result: unknown) => res.status(200).json({ jsonrpc: '2.0', id, result });
  const fail = (code: number, message: string) =>
    res.status(200).json({ jsonrpc: '2.0', id, error: { code, message } });

  try {
    // 通知类消息：直接 202
    if (method && method.startsWith('notifications/')) {
      return res.status(202).end();
    }

    switch (method) {
      case 'initialize':
        return ok({
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: 'alle-mail', version: '1.0.0' },
        });
      case 'tools/list':
        return ok({ tools: TOOLS });
      case 'tools/call': {
        const { name, arguments: args } = params as { name: string; arguments: Record<string, unknown> };
        if (!name) return fail(-32602, '缺少工具名');
        try {
          const result = await callTool(name, args || {}, auth);
          return ok(result);
        } catch (e) {
          return ok(errResult(e instanceof Error ? e.message : String(e)));
        }
      }
      case 'ping':
        return ok({});
      default:
        return fail(-32601, `不支持的方法: ${method}`);
    }
  } catch (e) {
    return fail(-32603, e instanceof Error ? e.message : '内部错误');
  }
}
