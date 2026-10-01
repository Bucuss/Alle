import withAuth from '@/lib/auth/auth';
import categoriesDB from '@/lib/db/categories';

import { success, failure } from '@/types';

import type { NextApiRequest, NextApiResponse } from 'next';
import type { NewCategory } from '@/types';

async function categoryByIdHandler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number(req.query.id);
  if (!Number.isInteger(id) || id <= 0) {
    return failure(res, 'Invalid category id', 400);
  }

  try {
    if (req.method === 'PUT') {
      const body = (req.body || {}) as Record<string, unknown>;
      const patch: Partial<NewCategory> = {};

      if (body.name !== undefined) {
        const name = String(body.name).trim();
        if (!name) return failure(res, 'name cannot be empty', 400);
        patch.name = name;
      }
      if (body.enabled !== undefined) patch.enabled = body.enabled ? 1 : 0;
      if (body.sortOrder !== undefined) {
        const s = Number(body.sortOrder);
        if (!Number.isFinite(s)) return failure(res, 'sortOrder must be a number', 400);
        patch.sortOrder = Math.trunc(s);
      }

      try {
        await categoriesDB.update(id, patch);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('UNIQUE')) return failure(res, 'Category already exists', 400);
        throw e;
      }
      return success<null>(res, null);
    }

    if (req.method === 'DELETE') {
      await categoriesDB.remove([id]);
      return success<null>(res, null);
    }

    return failure(res, 'Method not allowed', 405);
  } catch (e) {
    console.error('Category API failed:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return failure(res, errorMessage, 500);
  }
}

export default withAuth(categoryByIdHandler);
