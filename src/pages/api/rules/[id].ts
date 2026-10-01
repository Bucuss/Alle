import withAuth from '@/lib/auth/auth';
import rulesDB from '@/lib/db/rules';

import { success, failure } from '@/types';

import type { NextApiRequest, NextApiResponse } from 'next';
import type { NewForwardRule, RuleMatchType, RuleAction } from '@/types';

const MATCH_TYPES: RuleMatchType[] = ['exact', 'domain', 'all'];
const ACTIONS: RuleAction[] = ['accept', 'reject'];

async function ruleByIdHandler(req: NextApiRequest, res: NextApiResponse) {
  const id = Number(req.query.id);
  if (!Number.isInteger(id) || id <= 0) {
    return failure(res, 'Invalid rule id', 400);
  }

  try {
    if (req.method === 'PUT') {
      const body = (req.body || {}) as Record<string, unknown>;
      const patch: Partial<NewForwardRule> = {};

      if (body.name !== undefined) {
        const name = String(body.name).trim();
        if (!name) return failure(res, 'name cannot be empty', 400);
        patch.name = name;
      }
      if (body.enabled !== undefined) patch.enabled = body.enabled ? 1 : 0;
      if (body.priority !== undefined) {
        const p = Number(body.priority);
        if (!Number.isFinite(p)) return failure(res, 'priority must be a number', 400);
        patch.priority = Math.trunc(p);
      }
      if (body.matchType !== undefined) {
        if (!MATCH_TYPES.includes(body.matchType as RuleMatchType)) {
          return failure(res, 'matchType must be one of: exact, domain, all', 400);
        }
        patch.matchType = body.matchType as RuleMatchType;
      }
      if (body.matchValue !== undefined) {
        patch.matchValue = String(body.matchValue).trim().toLowerCase();
      }
      if (body.action !== undefined) {
        if (!ACTIONS.includes(body.action as RuleAction)) {
          return failure(res, 'action must be one of: accept, reject', 400);
        }
        patch.action = body.action as RuleAction;
      }
      if (body.store !== undefined) patch.store = body.store ? 1 : 0;
      if (body.forwardTo !== undefined) {
        const forwardTo = String(body.forwardTo).trim();
        if (forwardTo) {
          for (const addr of forwardTo.split(',').map((s) => s.trim()).filter(Boolean)) {
            if (!addr.includes('@')) return failure(res, `forwardTo contains invalid email: ${addr}`, 400);
          }
          patch.forwardTo = forwardTo;
        } else {
          patch.forwardTo = null;
        }
      }
      if (body.notifyTelegram !== undefined) patch.notifyTelegram = body.notifyTelegram ? 1 : 0;
      if (body.notifyWebhook !== undefined) patch.notifyWebhook = body.notifyWebhook ? 1 : 0;

      // 校验 matchType/matchValue 组合（仅当两者都被更新或可推断时做宽松校验）
      if (patch.matchType === 'exact' && patch.matchValue !== undefined && !patch.matchValue.includes('@')) {
        return failure(res, 'matchValue must be a full email address for exact match', 400);
      }
      if (patch.matchType === 'domain' && patch.matchValue !== undefined && (!patch.matchValue || patch.matchValue.includes('@'))) {
        return failure(res, 'matchValue must be a domain for domain match', 400);
      }

      await rulesDB.update(id, patch);
      return success<null>(res, null);
    }

    if (req.method === 'DELETE') {
      await rulesDB.remove([id]);
      return success<null>(res, null);
    }

    return failure(res, 'Method not allowed', 405);
  } catch (e) {
    console.error('Rule API failed:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return failure(res, errorMessage, 500);
  }
}

export default withAuth(ruleByIdHandler);
