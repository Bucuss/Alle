import { buildExtractPrompt } from '@/const/prompt';
import OpenAI from 'openai';

import { DEFAULT_EXTRACT_RESULT } from '@/types';

import type { ExtractResult } from '@/types';

// 提取输入的最大字符数，超出截断（见 extract 注释）
const EXTRACT_MAX_CHARS = 8000;

function buildJsonSchema() {
  return {
    type: 'json_schema',
    json_schema: {
      name: 'response_object',
      schema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['auth_code', 'auth_link', 'service_link', 'subscription_link', 'other_link', 'none']
          },
          result: { type: 'string' },
          result_text: { type: 'string' },
        },
        required: ['type', 'result', 'result_text'],
      },
    },
  } as const;
}

async function extractWithOpenAI(
  content: string,
  env: CloudflareEnv,
): Promise<ExtractResult> {
  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
  });

  const response = await client.chat.completions.create({
    model: env.EXTRACT_MODEL,
    messages: [
      { role: 'system', content: buildExtractPrompt() },
      { role: 'user', content },
    ],
    response_format: buildJsonSchema(),
  });

  const jsonText = response.choices[0].message.content;
  if (!jsonText) {
    throw new Error('OpenAI returned empty response');
  }

  return JSON.parse(jsonText) as ExtractResult;
}

async function extractWithCloudflareAI(
  content: string,
  env: CloudflareEnv,
): Promise<ExtractResult> {
  const result = await env.AI.run(env.EXTRACT_MODEL as keyof AiModels, {
    messages: [
      { role: 'system', content: buildExtractPrompt() },
      { role: 'user', content },
    ],
    response_format: buildJsonSchema(),
    stream: false,
  });

  // @ts-expect-error result.response
  const response = result.response;

  let parsed: ExtractResult;
  if (typeof response === 'string') {
    parsed = JSON.parse(response) as ExtractResult;
  } else if (response && typeof response === 'object') {
    parsed = response as ExtractResult;
  } else {
    throw new Error('Unexpected response format from Cloudflare AI');
  }
  return parsed;
}

export default async function extract(
  content: string,
  env: CloudflareEnv,
): Promise<ExtractResult> {
  try {
    // 输入截断：超长邮件（如携带原信附件的退信通知）会撑爆模型请求；
    // 验证码/链接通常位于邮件开头，截断不影响提取效果，还能省 token
    const input = content.length > EXTRACT_MAX_CHARS ? content.slice(0, EXTRACT_MAX_CHARS) : content;
    let result: ExtractResult = { ...DEFAULT_EXTRACT_RESULT };
    // EXTRACT_PROVIDER: 'openai' 走 OpenAI 兼容接口，'workers-ai' 走 Cloudflare Workers AI；
    // 为空时自动判断（配了 OPENAI_BASE_URL/OPENAI_API_KEY 则走 openai）
    const provider = (env.EXTRACT_PROVIDER || '').trim().toLowerCase();
    if (provider === 'workers-ai') {
      result = await extractWithCloudflareAI(input, env);
    } else if (provider === 'openai') {
      result = await extractWithOpenAI(input, env);
    } else if (env.OPENAI_BASE_URL && env.OPENAI_API_KEY) {
      result = await extractWithOpenAI(input, env);
    } else {
      result = await extractWithCloudflareAI(input, env);
    }
    return result;
  } catch (e) {
    // 打印真实的状态码与报错信息，方便排查 provider 侧问题
    const err = e as { status?: number; message?: unknown };
    console.error('Extraction error:', err?.status ?? 'no-status', err?.message ?? e);
    return { ...DEFAULT_EXTRACT_RESULT };
  }
}
