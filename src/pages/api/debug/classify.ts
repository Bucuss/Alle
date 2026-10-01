import { getCloudflareContext } from '@opennextjs/cloudflare';
import categoriesDB from '@/lib/db/categories';
import { classifyEmail } from '@/lib/email/classify';

import type { NextApiRequest, NextApiResponse } from 'next';

// 临时调试接口：验证分类变量注入与 jev 调用，调试完即删除
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { env } = (await getCloudflareContext()) as unknown as { env: CloudflareEnv };
  const debug = {
    CLASSIFY_PROVIDER: env.CLASSIFY_PROVIDER ?? null,
    CLASSIFY_MODEL: env.CLASSIFY_MODEL ?? null,
    CLASSIFY_CRON: env.CLASSIFY_CRON ?? null,
    CLASSIFY_BATCH_SIZE: env.CLASSIFY_BATCH_SIZE ?? null,
    ENABLE_CLASSIFY: env.ENABLE_CLASSIFY ?? null,
    CLASSIFY_MIN_CONFIDENCE: env.CLASSIFY_MIN_CONFIDENCE ?? null,
    hasAI: !!env.AI,
  };
  try {
    const categories = await categoriesDB.listEnabledNames(env);
    const category = await classifyEmail(
      '您的登录验证码',
      '尊敬的用户，您本次登录的验证码是 483920，5分钟内有效，请勿泄露给他人。',
      env,
      categories,
    );
    return res.status(200).json({ debug, categories, category });
  } catch (e) {
    const err = e as Error;
    return res.status(500).json({ debug, error: err?.message || String(e), stack: (err?.stack || '').slice(0, 2000) });
  }
}
