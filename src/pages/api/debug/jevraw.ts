import { getCloudflareContext } from '@opennextjs/cloudflare';

import type { NextApiRequest, NextApiResponse } from 'next';

// 临时调试：返回 jev 原始响应（choice/confidence/probabilities），调试完即删除
const SAMPLES = [
  { title: '招商银行信用卡电子账单', body: '尊敬的客户，您尾号1234的招商银行信用卡本期账单已出，账单金额 5230.50 元，最低还款额 523.05 元，到期还款日为10月25日。' },
  { title: 'Boring Report: Furniture Reviewing Site', body: 'View it on your browser. This week we look at furniture reviewing sites and their business models. Unsubscribe here.' },
  { title: '您的登录验证码', body: '尊敬的用户，您本次登录的验证码是 483920，5分钟内有效，请勿泄露给他人。' },
];

const CRITERIA: Record<string, string> = {
  '验证码': 'login/verification codes, OTP, 验证码',
  '通知提醒': 'system notifications, shipping/delivery updates, alerts, 通知',
  '账单财务': 'bills, invoices, payment receipts, bank statements, 账单/扣款',
  '订阅营销': 'newsletters, promotions, marketing emails, 推广/订阅',
  '工作事务': 'work-related correspondence, meetings, 项目/工作',
  '个人往来': 'personal correspondence between individuals, 私人邮件',
  '其他': 'anything that does not fit the above',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { env } = (await getCloudflareContext()) as unknown as { env: CloudflareEnv };
  const out: unknown[] = [];
  try {
    for (const s of SAMPLES) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = (await (env.AI as any).run('typesafe/jev', {
        state: `Subject: ${s.title}\n\n${s.body}`,
        questions: {
          category: {
            type: 'choice',
            instructions: '这封邮件属于哪个分类？只根据邮件内容判断。',
            criteria: CRITERIA,
          },
        },
      }));
      out.push({ title: s.title, raw });
    }
    return res.status(200).json(out);
  } catch (e) {
    const err = e as Error;
    return res.status(500).json({ out, error: err?.message || String(e) });
  }
}
