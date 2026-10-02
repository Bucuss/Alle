import withAuth from '@/lib/auth/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { draftDB } from '@/lib/db/send';
import { sendMail, DEFAULT_FROM } from '@/lib/mail/send';

import { success, failure } from '@/types';

import type { NextApiRequest, NextApiResponse } from 'next';

async function sendDraftHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return failure(res, 'Method not allowed', 405);
  }

  const { env } = await getCloudflareContext();
  const id = Number(req.query.id);
  if (!id || isNaN(id)) return failure(res, 'Invalid draft id', 400);

  const draft = await draftDB.get(env as CloudflareEnv, id);
  if (!draft) return failure(res, '草稿不存在', 404);

  const parse = (s: string | null) =>
    (s || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

  try {
    const result = await sendMail(env as CloudflareEnv, {
      to: parse(draft.toAddresses),
      cc: parse(draft.ccAddresses),
      bcc: parse(draft.bccAddresses),
      subject: draft.subject || '',
      text: draft.bodyText || undefined,
      html: draft.bodyHtml || undefined,
      from: DEFAULT_FROM,
      inReplyTo: draft.inReplyTo || undefined,
      dryRun: false,
    });
    await draftDB.remove(env as CloudflareEnv, id);
    return success(res, result);
  } catch (e) {
    return failure(res, e instanceof Error ? e.message : '发送失败', 400);
  }
}

export default withAuth(sendDraftHandler);
