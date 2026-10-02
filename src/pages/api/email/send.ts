import withAuth from '@/lib/auth/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { sendMail, DEFAULT_FROM } from '@/lib/mail/send';
import { draftDB } from '@/lib/db/send';

import { success, failure } from '@/types';

import type { NextApiRequest, NextApiResponse } from 'next';

function parseAddrs(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  return String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function sendHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return failure(res, 'Method not allowed', 405);
  }

  const { env } = await getCloudflareContext();

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const result = await sendMail(env as CloudflareEnv, {
      to: parseAddrs(body.to),
      cc: parseAddrs(body.cc),
      bcc: parseAddrs(body.bcc),
      subject: body.subject || '',
      text: body.text,
      html: body.html,
      from: body.from || DEFAULT_FROM,
      fromName: body.fromName,
      replyTo: body.replyTo,
      inReplyTo: body.inReplyTo,
      dryRun: !!body.dryRun,
    });

    // 从草稿发送：成功后删除草稿
    if (!body.dryRun && body.draftId) {
      try {
        await draftDB.remove(env as CloudflareEnv, Number(body.draftId));
      } catch {
        /* 忽略 */
      }
    }

    return success(res, result);
  } catch (e) {
    return failure(res, e instanceof Error ? e.message : '发送失败', 400);
  }
}

export default withAuth(sendHandler);
