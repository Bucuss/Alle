import withAuth from '@/lib/auth/auth';
import emailDB from '@/lib/db/email';

import { success, failure } from '@/types';

import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * 重要邮件入口的"已处理"标记：POST /api/email/important?id=<id>
 * 置 important_handled=1 后，该邮件不再出现在重要入口。
 */
async function importantHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return failure(res, 'Method not allowed', 405);
  }

  const { id } = req.query;

  try {
    if (id === undefined) {
      return failure(res, 'Email ID is required', 400);
    }

    const emailId = Number(id);
    if (isNaN(emailId) || !Number.isInteger(emailId) || emailId < 1) {
      return failure(res, 'Invalid email ID', 400);
    }

    await emailDB.markImportantHandled(emailId);

    return success(res, null, 200);
  } catch (e) {
    console.error('Failed to mark email as handled:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return failure(res, errorMessage, 500);
  }
}

export default withAuth(importantHandler);
