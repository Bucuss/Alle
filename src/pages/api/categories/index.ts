import withAuth from '@/lib/auth/auth';
import categoriesDB from '@/lib/db/categories';

import { success, failure } from '@/types';

import type { NextApiRequest, NextApiResponse } from 'next';
import type { Category, NewCategory } from '@/types';

async function categoriesHandler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const list = await categoriesDB.list();
      return success<Category[]>(res, list);
    }

    if (req.method === 'POST') {
      const body = (req.body || {}) as Record<string, unknown>;
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) return failure(res, 'name is required', 400);

      const data: NewCategory = {
        name,
        enabled: body.enabled === undefined ? 1 : body.enabled ? 1 : 0,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
      };

      try {
        const created = await categoriesDB.create(data);
        return success<Category>(res, created, 201);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('UNIQUE')) return failure(res, 'Category already exists', 400);
        throw e;
      }
    }

    return failure(res, 'Method not allowed', 405);
  } catch (e) {
    console.error('Categories API failed:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return failure(res, errorMessage, 500);
  }
}

export default withAuth(categoriesHandler);
