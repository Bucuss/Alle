import { getCloudflareContext } from '@opennextjs/cloudflare';

import type { NextApiRequest, NextApiResponse } from 'next';

// 临时调试：验证线上变量 + 单次 jev 调用，调试完即删除
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { env } = (await getCloudflareContext()) as unknown as { env: CloudflareEnv };
  const vars = {
    CLASSIFY_PROVIDER: env.CLASSIFY_PROVIDER ?? null,
    CLASSIFY_MODEL: env.CLASSIFY_MODEL ?? null,
    CLASSIFY_CRON: env.CLASSIFY_CRON ?? null,
    CLASSIFY_BATCH_SIZE: env.CLASSIFY_BATCH_SIZE ?? null,
    ENABLE_CLASSIFY: env.ENABLE_CLASSIFY ?? null,
    CLASSIFY_MIN_CONFIDENCE: env.CLASSIFY_MIN_CONFIDENCE ?? null,
    hasAI: !!env.AI,
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (await (env.AI as any).run('typesafe/jev', {
      state: 'Subject: test\n\nhello',
      questions: {
        category: {
          type: 'choice',
          instructions: 'Which category?',
          criteria: { a: 'test a', b: 'test b' },
        },
      },
    }));
    return res.status(200).json({ vars, jevOk: true, choice: raw?.result?.answers?.category?.choice ?? raw?.answers?.category?.choice ?? null });
  } catch (e) {
    const err = e as Error;
    return res.status(500).json({ vars, jevOk: false, error: err?.message || String(e) });
  }
}
