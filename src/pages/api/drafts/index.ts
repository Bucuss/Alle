import withAuth from '@/lib/auth/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { draftDB } from '@/lib/db/send';

import { success, failure } from '@/types';

import type { NextApiRequest, NextApiResponse } from 'next';

async function draftsHandler(req: NextApiRequest, res: NextApiResponse) {
  const { env } = await getCloudflareContext();

  if (req.method === 'GET') {
    const list = await draftDB.list(env as CloudflareEnv);
    return success(res, list);
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const draft = await draftDB.create(env as CloudflareEnv, {
        toAddresses: body.toAddresses || '',
        ccAddresses: body.ccAddresses || '',
        bccAddresses: body.bccAddresses || '',
        subject: body.subject || '',
        bodyText: body.bodyText || '',
        bodyHtml: body.bodyHtml || '',
        inReplyTo: body.inReplyTo || null,
      });
      return success(res, draft, 201);
    } catch (e) {
      return failure(res, e instanceof Error ? e.message : '创建草稿失败', 400);
    }
  }

  return failure(res, 'Method not allowed', 405);
}

export default withAuth(draftsHandler);
