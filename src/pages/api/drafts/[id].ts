import withAuth from '@/lib/auth/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { draftDB } from '@/lib/db/send';

import { success, failure } from '@/types';

import type { NextApiRequest, NextApiResponse } from 'next';

async function draftHandler(req: NextApiRequest, res: NextApiResponse) {
  const { env } = await getCloudflareContext();
  const id = Number(req.query.id);
  if (!id || isNaN(id)) return failure(res, 'Invalid draft id', 400);

  if (req.method === 'GET') {
    const draft = await draftDB.get(env as CloudflareEnv, id);
    if (!draft) return failure(res, '草稿不存在', 404);
    return success(res, draft);
  }

  if (req.method === 'PUT') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const draft = await draftDB.update(env as CloudflareEnv, id, {
        toAddresses: body.toAddresses,
        ccAddresses: body.ccAddresses,
        bccAddresses: body.bccAddresses,
        subject: body.subject,
        bodyText: body.bodyText,
        bodyHtml: body.bodyHtml,
        inReplyTo: body.inReplyTo,
      });
      if (!draft) return failure(res, '草稿不存在', 404);
      return success(res, draft);
    } catch (e) {
      return failure(res, e instanceof Error ? e.message : '更新草稿失败', 400);
    }
  }

  if (req.method === 'DELETE') {
    await draftDB.remove(env as CloudflareEnv, id);
    return success(res, { id });
  }

  return failure(res, 'Method not allowed', 405);
}

export default withAuth(draftHandler);
