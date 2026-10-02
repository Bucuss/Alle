import withAuth from '@/lib/auth/auth';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { apiKeyDB } from '@/lib/db/send';

import { success, failure } from '@/types';

import type { NextApiRequest, NextApiResponse } from 'next';

async function apiKeyHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return failure(res, 'Method not allowed', 405);
  }

  const { env } = await getCloudflareContext();
  const id = Number(req.query.id);
  if (!id || isNaN(id)) return failure(res, 'Invalid key id', 400);

  await apiKeyDB.revoke(env as CloudflareEnv, id);
  return success(res, { id, revoked: true });
}

export default withAuth(apiKeyHandler);
