import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Compartilhado entre apps/web (rate limit de login/cadastro, que fala
 * diretamente com o Supabase Auth) e apps/api (rate limit das rotas REST).
 * As duas apps apontam para o MESMO banco Upstash Redis (mesmas env vars
 * UPSTASH_REDIS_REST_URL/TOKEN) — os prefixos de chave abaixo evitam colisão
 * entre os contadores de cada uso.
 */
const redis = Redis.fromEnv();

/** Rate limit geral por IP para rotas de API sensíveis. */
export const apiRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  analytics: true,
  prefix: "ratelimit:api",
});

/**
 * Rate limit "coarse" por IP para login/cadastro. Complementar ao bloqueio
 * progressivo por e-mail abaixo: este pega um atacante testando muitos
 * e-mails a partir do mesmo IP; o de e-mail pega um atacante testando muitas
 * senhas contra uma conta específica, possivelmente de vários IPs.
 */
export const authIpRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
  prefix: "ratelimit:auth:ip",
});

const FAILURE_WINDOW_SECONDS = 15 * 60;

const LOCKOUT_STEPS_SECONDS = [0, 0, 0, 60, 5 * 60, 15 * 60, 60 * 60];
const MAX_LOCKOUT_SECONDS = LOCKOUT_STEPS_SECONDS[LOCKOUT_STEPS_SECONDS.length - 1]!;

function lockoutDurationForFailureCount(failureCount: number): number {
  if (failureCount < LOCKOUT_STEPS_SECONDS.length) {
    return LOCKOUT_STEPS_SECONDS[failureCount]!;
  }
  return MAX_LOCKOUT_SECONDS;
}

function normalizeEmailKey(email: string) {
  return email.trim().toLowerCase();
}

export async function getLoginLockout(
  email: string,
): Promise<{ lockedOut: boolean; retryAfterSeconds: number }> {
  const key = `login:lockout:${normalizeEmailKey(email)}`;
  const ttl = await redis.ttl(key);
  if (ttl > 0) {
    return { lockedOut: true, retryAfterSeconds: ttl };
  }
  return { lockedOut: false, retryAfterSeconds: 0 };
}

export async function registerFailedLoginAttempt(email: string): Promise<void> {
  const failuresKey = `login:fails:${normalizeEmailKey(email)}`;
  const lockoutKey = `login:lockout:${normalizeEmailKey(email)}`;

  const failureCount = await redis.incr(failuresKey);
  if (failureCount === 1) {
    await redis.expire(failuresKey, FAILURE_WINDOW_SECONDS);
  }

  const lockoutSeconds = lockoutDurationForFailureCount(failureCount);
  if (lockoutSeconds > 0) {
    await redis.set(lockoutKey, "1", { ex: lockoutSeconds });
  }
}

export async function clearFailedLoginAttempts(email: string): Promise<void> {
  const failuresKey = `login:fails:${normalizeEmailKey(email)}`;
  await redis.del(failuresKey);
}

export async function checkRateLimit(limiter: Ratelimit, identifier: string) {
  return limiter.limit(identifier);
}
