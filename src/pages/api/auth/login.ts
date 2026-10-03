import { success, failure } from '@/types';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createHash } from 'crypto';
import { SignJWT } from 'jose';

import type { LoginRequestBody, LoginResponseData } from '@/types';
import type { NextApiRequest, NextApiResponse } from 'next';

// 登录限流：滑动窗口
// - 每 IP 每 60 秒最多 5 次（防单点爆破）
// - 全局每 60 秒最多 20 次（防轮换 IP 的分布式爆破；单用户正常使用远达不到）
const RATE_LIMIT_WINDOW_S = 60;
const RATE_LIMIT_MAX_PER_IP = 5;
const RATE_LIMIT_MAX_GLOBAL = 20;

function getClientIp(req: NextApiRequest): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf) return cf;
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff.length) return xff[0].split(',')[0].trim();
  return 'unknown';
}

async function checkLoginRateLimit(
  db: D1Database,
  ip: string
): Promise<{ allowed: boolean; retryAfter: number }> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - RATE_LIMIT_WINDOW_S;
  // 顺手清理 1 小时前的旧记录，避免表无限增长
  await db.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').bind(now - 3600).run();
  // 全局限流：所有 IP 在窗口内的尝试总数
  const globalRow = await db
    .prepare('SELECT COUNT(*) AS n, MIN(attempted_at) AS t FROM login_attempts WHERE attempted_at >= ?')
    .bind(windowStart)
    .first<{ n: number; t: number | null }>();
  if ((globalRow?.n ?? 0) >= RATE_LIMIT_MAX_GLOBAL) {
    const retryAfter = Math.max(1, (globalRow?.t ?? now) + RATE_LIMIT_WINDOW_S - now);
    return { allowed: false, retryAfter };
  }
  const countRow = await db
    .prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND attempted_at >= ?')
    .bind(ip, windowStart)
    .first<{ n: number }>();
  if ((countRow?.n ?? 0) >= RATE_LIMIT_MAX_PER_IP) {
    const oldestRow = await db
      .prepare('SELECT MIN(attempted_at) AS t FROM login_attempts WHERE ip = ? AND attempted_at >= ?')
      .bind(ip, windowStart)
      .first<{ t: number | null }>();
    const retryAfter = Math.max(1, (oldestRow?.t ?? now) + RATE_LIMIT_WINDOW_S - now);
    return { allowed: false, retryAfter };
  }
  await db
    .prepare('INSERT INTO login_attempts (ip, attempted_at) VALUES (?, ?)')
    .bind(ip, now)
    .run();
  return { allowed: true, retryAfter: 0 };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return failure(res, 'Method not allowed', 405);
  }

  try {
    const { env } = await getCloudflareContext();

    const USERNAME = env.USERNAME;
    const PASSWORD = env.PASSWORD;
    const JWT_MIN_TTL = Number(env.JWT_MIN_TTL || 300);
    const JWT_MAX_TTL = Number(env.JWT_MAX_TTL || 6000);

    if (!USERNAME || !PASSWORD) {
      return failure(res, 'Server not configured', 500);
    }

    // 登录限流：D1 表缺失或异常时 fail-open，保证登录可用
    try {
      const { allowed, retryAfter } = await checkLoginRateLimit(
        (env as CloudflareEnv).DB,
        getClientIp(req)
      );
      if (!allowed) {
        res.setHeader('Retry-After', String(retryAfter));
        return failure(res, 'Too many login attempts, please try again later', 429);
      }
    } catch (e) {
      console.error('Login rate limit check failed (fail-open):', e);
    }

    const body = req.body as LoginRequestBody;
    if (!body || typeof body !== 'object' || !body.username || typeof body.username !== 'string' || !body.password || typeof body.password !== 'string' || body.username !== USERNAME || body.password !== PASSWORD) {
      return failure(res, 'Invalid Password or Username', 401);
    }

    const now = Math.floor(Date.now() / 1000);
    let payload: {
      sub: string;
      iat: number;
      exp?: number;
    };

    if (body.expired === 'none') {
      payload = {
        sub: body.username,
        iat: now,
      };
    } else if (typeof body.expired === 'number') {
      const ttl = Math.max(JWT_MIN_TTL, Math.min(body.expired, JWT_MAX_TTL));
      payload = {
        sub: body.username,
        iat: now,
        exp: now + ttl,
      };
    } else {
      payload = {
        sub: body.username,
        iat: now,
        exp: now + JWT_MIN_TTL,
      };
    }

    const secret = createHash('sha256').update(`${USERNAME}:${PASSWORD}`).digest('hex');
    const secretKey = new TextEncoder().encode(secret);

    const jwt = new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt();

    if (payload.exp) {
      jwt.setExpirationTime(payload.exp);
    }

    const token = await jwt.sign(secretKey);

    return success<LoginResponseData>(res, { token, exp: payload.exp ?? null }, 200);
  } catch (e) {
    console.error('Failed to generate JWT:', e);
    return failure(res, 'Failed to generate token', 500);
  }
}
