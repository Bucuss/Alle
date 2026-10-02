import { getCloudflareContext } from '@opennextjs/cloudflare';
import { runClassifyBatch } from '@/lib/email/classify';

import type { NextApiRequest, NextApiResponse } from 'next';

// 临时诊断：直接调用 runClassifyBatch，验证非 cron 路径，调试完即删除
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { env } = (await getCloudflareContext()) as unknown as { env: CloudflareEnv };
  try {
    const result = await runClassifyBatch(env);
    return res.status(200).json({ ok: true, result });
  } catch (e) {
    const err = e as Error;
    return res.status(500).json({ ok: false, error: err?.message || String(e), stack: (err?.stack || '').slice(0, 1500) });
  }
}
