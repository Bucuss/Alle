import categoriesDB from '@/lib/db/categories';
import emailDB from '@/lib/db/email';
import OpenAI from 'openai';

/** 默认分类的描述（作为 jev criteria 用；用户自定义分类无描述时用分类名本身） */
const DEFAULT_CATEGORY_CRITERIA: Record<string, string> = {
  '验证码': 'login/verification codes, OTP, 验证码',
  '通知提醒': 'system notifications, shipping/delivery updates, alerts, 通知',
  '账单财务': 'bills, invoices, payment receipts, bank statements, 账单/扣款',
  '订阅营销': 'newsletters, promotions, marketing emails, 推广/订阅',
  '工作事务': 'work-related correspondence, meetings, 项目/工作',
  '个人往来': 'personal correspondence between individuals, 私人邮件',
  '其他': 'anything that does not fit the above',
};

/** 校验并归一化分类名：不在启用列表中则回退 */
function normalizeCategory(raw: string, categories: string[]): string {
  const name = (raw || '').trim();
  if (name && categories.includes(name)) return name;
  if (categories.includes('其他')) return '其他';
  return categories[0] || '';
}

interface JevChoiceAnswer {
  choice?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
}

interface JevResponse {
  // REST API 形态：{ answers: {...} }；Workers AI binding 会再包一层 { state, result: {...} }
  result?: { answers?: Record<string, JevChoiceAnswer> };
  answers?: Record<string, JevChoiceAnswer>;
}

/**
 * 用 typesafe/jev（Cloudflare Workers AI 第三方决策模型）做分类。
 * jev 不是生成式 LLM：输入 state + 类型化 questions，返回锁死在选项内的答案，
 * 附带 confidence，可做低置信度兜底。
 */
async function classifyWithJev(
  state: string,
  env: CloudflareEnv,
  categories: string[],
): Promise<string> {
  const criteria: Record<string, string> = {};
  for (const name of categories) {
    criteria[name] = DEFAULT_CATEGORY_CRITERIA[name] || name;
  }

  const res = (await env.AI.run(env.CLASSIFY_MODEL as keyof AiModels, {
    state,
    questions: {
      category: {
        type: 'choice',
        instructions: '这封邮件属于哪个分类？只根据邮件内容判断。',
        criteria,
      },
    },
  } as never)) as JevResponse;

  const answer = res?.result?.answers?.category ?? res?.answers?.category;
  const choice = (answer?.choice || '').trim();
  const confidence = typeof answer?.confidence === 'number' ? answer.confidence : 1;

  const minConfidence = parseFloat(env.CLASSIFY_MIN_CONFIDENCE || '0.5');
  if (!choice || (!Number.isNaN(minConfidence) && confidence < minConfidence)) {
    console.log(`Jev low confidence (${confidence}), fallback. choice=${choice || '(empty)'}`);
    return normalizeCategory('', categories);
  }

  return normalizeCategory(choice, categories);
}

function buildClassifyJsonSchema() {
  return {
    type: 'json_schema',
    json_schema: {
      name: 'response_object',
      schema: {
        type: 'object',
        properties: {
          category: { type: 'string' },
        },
        required: ['category'],
      },
    },
  } as const;
}

/** OpenAI 兼容接口兜底路径（CLASSIFY_PROVIDER=openai 时） */
async function classifyWithOpenAI(
  content: string,
  env: CloudflareEnv,
  categories: string[],
): Promise<string> {
  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
  });

  const list = categories.map((n) => `- "${n}"`).join('\n');
  const response = await client.chat.completions.create({
    model: env.CLASSIFY_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are an email classifier. Classify the email into EXACTLY ONE of these categories, return ONLY JSON.\n\n${list}`,
      },
      { role: 'user', content },
    ],
    response_format: buildClassifyJsonSchema(),
  });

  const jsonText = response.choices[0].message.content;
  if (!jsonText) {
    throw new Error('OpenAI returned empty response');
  }

  const parsed = JSON.parse(jsonText) as { category?: string };
  return normalizeCategory(parsed.category || '', categories);
}

/** 单封邮件分类：返回归一化后的分类名 */
export async function classifyEmail(
  title: string | null,
  bodyText: string | null,
  env: CloudflareEnv,
  categories: string[],
): Promise<string> {
  // state 保持干净：主题 + 正文前 4000 字符（无关内容会拉低 jev 准确率）
  const text = (bodyText || '').slice(0, 4000);
  const state = `Subject: ${title || '(no subject)'}\n\n${text}`;

  // CLASSIFY_PROVIDER 默认为 workers-ai（typesafe/jev）；openai 走 OpenAI 兼容接口
  const provider = (env.CLASSIFY_PROVIDER || 'workers-ai').trim().toLowerCase();
  if (provider === 'openai') {
    return classifyWithOpenAI(state, env, categories);
  }
  return classifyWithJev(state, env, categories);
}

/**
 * 分类队列消费：一批一批取出未分类邮件，逐封分类并回写 D1。
 * 由定时任务轮询触发。
 */
export async function runClassifyBatch(env: CloudflareEnv): Promise<{ total: number; done: number; failed: number }> {
  if ((env.ENABLE_CLASSIFY || 'true').trim().toLowerCase() === 'false') {
    console.log('Classify is disabled');
    return { total: 0, done: 0, failed: 0 };
  }

  if (!env.CLASSIFY_MODEL) {
    console.error('CLASSIFY_MODEL is not configured, skip classify batch');
    return { total: 0, done: 0, failed: 0 };
  }

  const batchSize = parseInt(env.CLASSIFY_BATCH_SIZE || '20', 10) || 20;
  const categories = await categoriesDB.listEnabledNames(env).catch(() => [] as string[]);
  if (categories.length === 0) {
    console.error('No enabled categories, skip classify batch');
    return { total: 0, done: 0, failed: 0 };
  }

  const pending = await emailDB.listUnclassified(env, batchSize);
  let done = 0;
  let failed = 0;

  for (const mail of pending) {
    try {
      const category = await classifyEmail(mail.title, mail.bodyText, env, categories);
      await emailDB.updateCategory(env, mail.id, category);
      done++;
    } catch (e) {
      failed++;
      console.error(`Classify failed for email ${mail.id}:`, e);
    }
  }

  console.log(`Classify batch finished: total=${pending.length} done=${done} failed=${failed}`);
  return { total: pending.length, done, failed };
}
