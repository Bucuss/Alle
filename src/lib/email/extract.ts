import { buildExtractPrompt } from '@/const/prompt';
import OpenAI from 'openai';

import { DEFAULT_EXTRACT_RESULT } from '@/types';

import type { ExtractResult } from '@/types';

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
          category: { type: 'string' },
        },
        required: ['type', 'result', 'result_text', 'category'],
      },
    },
  } as const;
}

/** 校验并归一化 AI 返回的分类：不在列表中则回退 */
function normalizeCategory(raw: string, categories: string[]): string {
  const name = (raw || '').trim();
  if (name && categories.includes(name)) return name;
  if (categories.includes('其他')) return '其他';
  return categories[0] || '';
}

async function extractWithOpenAI(
  content: string,
  env: CloudflareEnv,
  categories: string[],
): Promise<ExtractResult> {
  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
  });

  const response = await client.chat.completions.create({
    model: env.EXTRACT_MODEL,
    messages: [
      { role: 'system', content: buildExtractPrompt(categories) },
      { role: 'user', content },
    ],
    response_format: buildJsonSchema(),
  });

  const jsonText = response.choices[0].message.content;
  if (!jsonText) {
    throw new Error('OpenAI returned empty response');
  }

  const parsed = JSON.parse(jsonText) as ExtractResult;
  parsed.category = normalizeCategory(parsed.category, categories);
  return parsed;
}

async function extractWithCloudflareAI(
  content: string,
  env: CloudflareEnv,
  categories: string[],
): Promise<ExtractResult> {
  const result = await env.AI.run(env.EXTRACT_MODEL as keyof AiModels, {
    messages: [
      { role: 'system', content: buildExtractPrompt(categories) },
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
  parsed.category = normalizeCategory(parsed.category, categories);
  return parsed;
}

export default async function extract(
  content: string,
  env: CloudflareEnv,
  categories: string[] = [],
): Promise<ExtractResult> {
  try {
    let result: ExtractResult = { ...DEFAULT_EXTRACT_RESULT, category: normalizeCategory('', categories) };
    if (env.OPENAI_BASE_URL && env.OPENAI_API_KEY) {
      result = await extractWithOpenAI(content, env, categories);
    } else {
      result = await extractWithCloudflareAI(content, env, categories);
    }
    return result;
  } catch (e) {
    console.error('Extraction error:', e);
    return { ...DEFAULT_EXTRACT_RESULT, category: normalizeCategory('', categories) };
  }
}
