import rulesDB from '@/lib/db/rules';

import type { ForwardRule } from '@/types';

/**
 * 按优先级查找第一条命中的启用规则。
 * match_type:
 *  - all: 匹配全部收件地址
 *  - exact: 精确匹配完整地址（不区分大小写）
 *  - domain: 匹配域名部分（不区分大小写）
 */
export async function findMatchingRule(
  env: CloudflareEnv,
  recipient: string,
): Promise<ForwardRule | null> {
  const rules = await rulesDB.listEnabled(env);
  if (rules.length === 0) return null;

  const rcpt = (recipient || '').toLowerCase().trim();
  const domain = rcpt.split('@')[1] || '';

  for (const rule of rules) {
    if (rule.matchType === 'all') return rule;
    if (rule.matchType === 'exact' && rcpt === rule.matchValue.toLowerCase().trim()) {
      return rule;
    }
    if (rule.matchType === 'domain' && domain && domain === rule.matchValue.toLowerCase().trim()) {
      return rule;
    }
  }
  return null;
}

/** 是否配置了任何规则（无规则时走兼容旧行为） */
export async function hasAnyRule(env: CloudflareEnv): Promise<boolean> {
  return rulesDB.hasAny(env);
}

/** 解析转发目标地址列表 */
export function parseForwardTargets(forwardTo: string | null): string[] {
  if (!forwardTo) return [];
  return forwardTo
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 解析 worker 变量 FORWARD_MAP：指定收件人 → 固定转发目标列表。
 *  格式：JSON 对象，如 {"billing@gear4ai.com": ["a@x.com", "b@y.com"]}；
 *  单个目标也可直接写字符串。key 不区分大小写；
 *  变量为空或解析失败时返回空对象（不影响既有 D1 规则）。
 */
export function parseForwardMap(env: CloudflareEnv): Record<string, string[]> {
  const raw = (env.FORWARD_MAP || '').trim();
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const map: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(obj || {})) {
      const key = String(k).toLowerCase().trim();
      const targets = (Array.isArray(v) ? v : [v])
        .map((s) => String(s).trim())
        .filter(Boolean);
      if (key && targets.length > 0) map[key] = targets;
    }
    return map;
  } catch (e) {
    console.error('FORWARD_MAP 解析失败，已忽略该变量:', e);
    return {};
  }
}
