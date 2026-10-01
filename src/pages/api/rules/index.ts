import withAuth from '@/lib/auth/auth';
import rulesDB from '@/lib/db/rules';

import { success, failure } from '@/types';

import type { NextApiRequest, NextApiResponse } from 'next';
import type { ForwardRule, NewForwardRule, RuleMatchType, RuleAction } from '@/types';

const MATCH_TYPES: RuleMatchType[] = ['exact', 'domain', 'all'];
const ACTIONS: RuleAction[] = ['accept', 'reject'];

function toInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toBoolInt(value: unknown, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  return value ? 1 : 0;
}

function validateRuleBody(body: Record<string, unknown>): { data?: NewForwardRule; error?: string } {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return { error: 'name is required' };

  const matchType = (body.matchType || 'all') as RuleMatchType;
  if (!MATCH_TYPES.includes(matchType)) return { error: 'matchType must be one of: exact, domain, all' };

  const action = (body.action || 'accept') as RuleAction;
  if (!ACTIONS.includes(action)) return { error: 'action must be one of: accept, reject' };

  let matchValue = typeof body.matchValue === 'string' ? body.matchValue.trim().toLowerCase() : '';
  if (matchType === 'exact') {
    if (!matchValue || !matchValue.includes('@')) return { error: 'matchValue must be a full email address for exact match' };
  } else if (matchType === 'domain') {
    if (!matchValue || matchValue.includes('@')) return { error: 'matchValue must be a domain (e.g. gear4ai.com) for domain match' };
  } else {
    matchValue = '';
  }

  const forwardTo = typeof body.forwardTo === 'string' ? body.forwardTo.trim() : '';
  if (forwardTo) {
    const addrs = forwardTo.split(',').map((s) => s.trim()).filter(Boolean);
    if (addrs.length === 0) return { error: 'forwardTo is empty' };
    for (const addr of addrs) {
      if (!addr.includes('@')) return { error: `forwardTo contains invalid email: ${addr}` };
    }
  }

  const data: NewForwardRule = {
    name,
    enabled: toBoolInt(body.enabled, 1),
    priority: toInt(body.priority, 0),
    matchType,
    matchValue,
    action,
    store: toBoolInt(body.store, 1),
    forwardTo: forwardTo || null,
    notifyTelegram: toBoolInt(body.notifyTelegram, 0),
    notifyWebhook: toBoolInt(body.notifyWebhook, 0),
  };
  return { data };
}

async function rulesHandler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const rules = await rulesDB.list();
      return success<ForwardRule[]>(res, rules);
    }

    if (req.method === 'POST') {
      const body = (req.body || {}) as Record<string, unknown>;
      const { data, error } = validateRuleBody(body);
      if (!data) return failure(res, error || 'Invalid rule', 400);
      const created = await rulesDB.create(data);
      return success<ForwardRule>(res, created, 201);
    }

    return failure(res, 'Method not allowed', 405);
  } catch (e) {
    console.error('Rules API failed:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return failure(res, errorMessage, 500);
  }
}

export default withAuth(rulesHandler);
