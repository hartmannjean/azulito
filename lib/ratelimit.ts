import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Cliente único do Upstash Redis, reaproveitado entre invocações "quentes"
// da função serverless. Necessário porque Vercel serverless é stateless —
// um contador em memória do processo não sobreviveria entre requests
// diferentes (ou entre instâncias diferentes da mesma função).
const redis = Redis.fromEnv();

/**
 * Rate limit geral para rotas de API sensíveis (ex: /api/transactions).
 * 30 requisições por minuto por IP é generoso para uso normal do app, mas
 * corta scraping/abuso automatizado.
 */
export const apiRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  analytics: true,
  prefix: "ratelimit:api",
});

/**
 * Rate limit "coarse" por IP especificamente para login/cadastro — mais
 * restritivo que o das demais rotas porque este é o alvo típico de
 * brute-force. Isto é além do bloqueio progressivo por e-mail
 * (`registerFailedLoginAttempt` / `getLoginLockout` abaixo); as duas
 * defesas cobrem cenários diferentes: um atacante testando muitos e-mails a
 * partir de um IP, e um atacante testando muitas senhas para um e-mail
 * específico (possivelmente de vários IPs).
 */
export const authIpRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
  prefix: "ratelimit:auth:ip",
});

const FAILURE_WINDOW_SECONDS = 15 * 60;

// Duração do bloqueio progressivo por e-mail, indexado por "nível" de
// tentativas falhas consecutivas. Cresce conforme o atacante insiste,
// dificultando brute-force sem travar permanentemente uma conta legítima
// que só errou a senha algumas vezes.
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

/**
 * Verifica se um e-mail está atualmente bloqueado por excesso de tentativas
 * de login falhas. Deve ser chamado ANTES de tentar validar a senha.
 */
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

/**
 * Registra uma tentativa de login falha para o e-mail e, se o número de
 * falhas consecutivas cruzar um novo patamar, ativa (ou estende) o bloqueio
 * progressivo. Deve ser chamado sempre que a senha informada estiver
 * incorreta ou o e-mail não existir (para não vazar quais e-mails existem
 * via timing/comportamento diferente).
 */
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

/**
 * Limpa o contador de falhas de um e-mail após um login bem-sucedido.
 */
export async function clearFailedLoginAttempts(email: string): Promise<void> {
  const failuresKey = `login:fails:${normalizeEmailKey(email)}`;
  await redis.del(failuresKey);
}

/**
 * Helper padrão para checar o limiter de IP em uma rota e devolver os
 * headers recomendados (`Retry-After`) quando o limite é excedido.
 */
export async function checkRateLimit(limiter: Ratelimit, identifier: string) {
  const result = await limiter.limit(identifier);
  return result;
}
