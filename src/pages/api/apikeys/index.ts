import withAuth from '@/lib/auth/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { apiKeyDB } from '@/lib/db/send';

import { success, failure } from '@/types';

import type { NextApiRequest, NextApiResponse } from 'next';

async function apiKeysHandler(req: NextApiRequest, res: NextApiResponse) {
  const { env } = await getCloudflareContext();

  if (req.method === 'GET') {
    const list = await apiKeyDB.list(env as CloudflareEnv);
    return success(res, list);
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const name = (body.name || '').trim() || 'default';
      // key 明文仅此次返回
      const created = await apiKeyDB.create(env as CloudflareEnv, name);
      return success(res, created, 201);
    } catch (e) {
      return failure(res, e instanceof Error ? e.message : '创建失败', 400);
    }
  }

  return failure(res, 'Method not allowed', 405);
}

export default withAuth(apiKeysHandler);
