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

/** 重要性选项（jev importance question 的合法选择） */
const IMPORTANCE_CHOICES = ['需尽快处理', '有价值', '无需关注'] as const;

/** 校验并归一化重要性选项：非法值回退为"无需关注" */
function normalizeImportance(raw: string): string {
  const name = (raw || '').trim();
  if ((IMPORTANCE_CHOICES as readonly string[]).includes(name)) return name;
  return '无需关注';
}

/** 该选项是否值得收录进重要邮件入口 */
function isValuableImportance(choice: string): boolean {
  return choice === '需尽快处理' || choice === '有价值';
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

interface JevDecideOptions {
  /** 需要分类时传入启用中的分类列表；不传则不问分类 */
  categories?: string[];
  /** 是否同时判断邮件重要性（收件箱的重要邮件入口用） */
  askImportance?: boolean;
}

interface JevDecideResult {
  /** 归一化后的分类名；未请求分类时为空字符串 */
  category: string;
  /** 归一化后的重要性选项；未请求时为空字符串 */
  importanceChoice: string;
}

/**
 * 用 typesafe/jev（Cloudflare Workers AI 第三方决策模型）做分类和重要性判断。
 * jev 不是生成式 LLM：输入 state + 类型化 questions，返回锁死在选项内的答案，
 * 附带 confidence，可做低置信度兜底。分类和重要性在同一次调用里完成，不增加调用次数。
 */
async function jevDecide(
  state: string,
  env: CloudflareEnv,
  opts: JevDecideOptions,
): Promise<JevDecideResult> {
  const questions: Record<string, unknown> = {};

  if (opts.categories && opts.categories.length > 0) {
    const criteria: Record<string, string> = {};
    for (const name of opts.categories) {
      criteria[name] = DEFAULT_CATEGORY_CRITERIA[name] || name;
    }
    questions.category = {
      type: 'choice',
      instructions: '这封邮件属于哪个分类？只根据邮件内容判断。',
      criteria,
    };
  }

  if (opts.askImportance) {
    questions.importance = {
      type: 'choice',
      instructions:
        '从收件人的角度判断这封邮件是否值得被重点标记：只有「需要尽快处理或知晓的事务」（如待办事项、截止日期、异常告警、账单扣款、账户安全），或「能给收件人带来实际好处的信息」（如专属优惠、权益变动、重要机会），才算值得标记。普通的营销群发、常规通知、社交动态都不算。',
      criteria: {
        '需尽快处理': 'urgent: 收件人需要尽快处理或知晓的事务，如待办、截止、异常、账单、账户安全',
        '有价值': 'beneficial: 对收件人有实际好处的信息，如专属优惠、权益变动、重要机会',
        '无需关注': 'neither: 普通营销群发、常规通知、社交动态，无需重点关注',
      },
    };
  }

  const res = (await env.AI.run(env.CLASSIFY_MODEL as keyof AiModels, {
    state,
    questions,
  } as never)) as JevResponse;

  const answers = res?.result?.answers ?? res?.answers ?? {};
  const minConfidence = parseFloat(env.CLASSIFY_MIN_CONFIDENCE || '0.5');

  let category = '';
  if (opts.categories && opts.categories.length > 0) {
    const answer = answers.category;
    const choice = (answer?.choice || '').trim();
    const confidence = typeof answer?.confidence === 'number' ? answer.confidence : 1;
    if (!choice || (!Number.isNaN(minConfidence) && confidence < minConfidence)) {
      console.log(`Jev category low confidence (${confidence}), fallback. choice=${choice || '(empty)'}`);
      category = normalizeCategory('', opts.categories);
    } else {
      category = normalizeCategory(choice, opts.categories);
    }
  }

  let importanceChoice = '';
  if (opts.askImportance) {
    const answer = answers.importance;
    const choice = (answer?.choice || '').trim();
    const confidence = typeof answer?.confidence === 'number' ? answer.confidence : 1;
    if (!choice || (!Number.isNaN(minConfidence) && confidence < minConfidence)) {
      console.log(`Jev importance low confidence (${confidence}), fallback to 无需关注. choice=${choice || '(empty)'}`);
      importanceChoice = '无需关注';
    } else {
      importanceChoice = normalizeImportance(choice);
    }
  }

  return { category, importanceChoice };
}

function buildClassifyJsonSchema(askImportance: boolean) {
  const properties: Record<string, unknown> = {
    category: { type: 'string' },
  };
  const required = ['category'];
  if (askImportance) {
    properties.importance = { type: 'string', enum: [...IMPORTANCE_CHOICES] };
    required.push('importance');
  }
  return {
    type: 'json_schema',
    json_schema: {
      name: 'response_object',
      schema: {
        type: 'object',
        properties,
        required,
      },
    },
  } as const;
}
/** OpenAI 兼容接口兜底路径（CLASSIFY_PROVIDER=openai 时） */
async function classifyWithOpenAI(
  content: string,
  env: CloudflareEnv,
  categories: string[],
  askImportance: boolean,
): Promise<{ category: string; importanceChoice: string }> {
  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
  });

  const list = categories.map((n) => `- "${n}"`).join('\n');
  const importancePrompt = askImportance
    ? `\n\n同时判断这封邮件是否值得收件人重点标记，从以下三项中选一项填入 "importance"：\n- "需尽快处理"：收件人需要尽快处理或知晓的事务（如待办事项、截止日期、异常告警、账单扣款、账户安全）\n- "有价值"：能给收件人带来实际好处的信息（如专属优惠、权益变动、重要机会）\n- "无需关注"：普通的营销群发、常规通知、社交动态`
    : '';
  const response = await client.chat.completions.create({
    model: env.CLASSIFY_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are an email classifier. Classify the email into EXACTLY ONE of these categories, return ONLY JSON.\n\n${list}${importancePrompt}`,
      },
      { role: 'user', content },
    ],
    response_format: buildClassifyJsonSchema(askImportance),
  });

  const jsonText = response.choices[0].message.content;
  if (!jsonText) {
    throw new Error('OpenAI returned empty response');
  }

  const parsed = JSON.parse(jsonText) as { category?: string; importance?: string };
  return {
    category: normalizeCategory(parsed.category || '', categories),
    importanceChoice: askImportance ? normalizeImportance(parsed.importance || '') : '',
  };
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
    const r = await classifyWithOpenAI(state, env, categories, false);
    return r.category;
  }
  const r = await jevDecide(state, env, { categories });
  return r.category;
}

/**
 * 分类队列消费：一批一批取出未分类/未做重要性判断的邮件，逐封处理并回写 D1。
 * 由定时任务轮询触发。重要性判断只对收件（inbound）做；分类和重要性在同一次
 * jev 调用里完成，不增加调用次数。历史存量邮件（important_reason 为 NULL）
 * 会被自动回填重要性。
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
  const provider = (env.CLASSIFY_PROVIDER || 'workers-ai').trim().toLowerCase();
  let done = 0;
  let failed = 0;

  for (const mail of pending) {
    try {
      const needCategory = mail.category == null || mail.category === '';
      const needImportance = mail.direction === 'inbound' && mail.importantReason == null;
      if (!needCategory && !needImportance) {
        continue;
      }

      // state 保持干净：主题 + 正文前 4000 字符
      const text = (mail.bodyText || '').slice(0, 4000);
      const state = `Subject: ${mail.title || '(no subject)'}\n\n${text}`;

      let category = '';
      let importanceChoice = '';
      if (provider === 'openai') {
        const r = await classifyWithOpenAI(state, env, categories, needImportance);
        category = needCategory ? r.category : '';
        importanceChoice = r.importanceChoice;
      } else {
        const r = await jevDecide(state, env, {
          categories: needCategory ? categories : undefined,
          askImportance: needImportance,
        });
        category = r.category;
        importanceChoice = r.importanceChoice;
      }

      if (needCategory) {
        await emailDB.updateCategory(env, mail.id, category);
      }
      if (needImportance) {
        await emailDB.updateImportance(env, mail.id, isValuableImportance(importanceChoice), importanceChoice);
      }
      done++;
    } catch (e) {
      failed++;
      console.error(`Classify failed for email ${mail.id}:`, e);
    }
  }

  console.log(`Classify batch finished: total=${pending.length} done=${done} failed=${failed}`);
  return { total: pending.length, done, failed };
}
