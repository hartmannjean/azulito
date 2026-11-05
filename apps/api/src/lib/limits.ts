import { env } from "cloudflare:workers";
import { getDb } from "./db.js";

/**
 * Limites de uso. A cota gratuita da Cloudflare (IA, D1, R2) e da Resend é da
 * conta toda, não de cada usuário: sem teto por usuário e um disjuntor global,
 * uma pessoa (ou um laço) esgota o dia de todo mundo.
 *
 * Qualquer limite pode ser sobrescrito por uma variável `LIMIT_<NOME>` (usado
 * nos testes); em produção valem estes valores.
 */
export const LIMITS = {
  /** Contas no total. O cadastro é aberto, mas a cota gratuita não aguenta crescimento sem controle. */
  MAX_USERS: 5,

  /** Chamadas à IA por usuário por dia, separadas para uma não esgotar a outra. */
  AI_CATEGORIZE_PER_DAY: 30,
  AI_INSIGHT_PER_DAY: 40,
  /** Disjuntor: ~80% da cota (10 mil neurons/dia ≈ 300 chamadas, pelo consumo observado). */
  AI_GLOBAL_PER_DAY: 300,

  IMPORTS_PER_DAY: 20,
  MAX_OFX_BYTES: 2 * 1024 * 1024,
  MAX_TRANSACTIONS_PER_USER: 50_000,
  MAX_R2_BYTES_PER_USER: 50 * 1024 * 1024,
  MAX_MERCHANT_RULES: 5_000,
  MAX_SAVINGS_SNAPSHOTS: 240,
  /** Exportações de dados por usuário por dia (lê todas as transações). */
  EXPORTS_PER_DAY: 3,

  /** Códigos de login por e-mail de destino (janela de 10 min e por dia). */
  OTP_PER_EMAIL_10MIN: 3,
  OTP_PER_EMAIL_PER_DAY: 10,
  /** Disjuntor de e-mails por dia (o plano gratuito da Resend tem teto diário). */
  OTP_GLOBAL_PER_DAY: 80,
} as const;

export type LimitName = keyof typeof LIMITS;

export function limitOf(name: LimitName): number {
  const raw = (env as unknown as Record<string, unknown>)[`LIMIT_${name}`];
  const override = Number(raw);
  return raw !== undefined && Number.isFinite(override) && override >= 0 ? override : LIMITS[name];
}

/** Dia em UTC (a cota do Workers AI zera às 00:00 UTC, 21h em Brasília). */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Reserva `weight` unidades no contador `(key, kind)` do dia, de forma
 * ATÔMICA: o UPDATE só acontece se não passar de `max`, então duas requisições
 * simultâneas nunca estouram o limite. Devolve false se não coube.
 */
export async function consume(key: string, kind: string, weight: number, max: number): Promise<boolean> {
  if (weight > max) return false;
  const row = await getDb()
    .prepare(
      `insert into usage_counters (user_id, day, kind, n) values (?, ?, ?, ?)
       on conflict (user_id, day, kind) do update set n = n + excluded.n
         where n + excluded.n <= ?
       returning n`,
    )
    .bind(key, today(), kind, weight, max)
    .first<{ n: number }>();
  return row !== null;
}

/** Devolve unidades reservadas que não chegaram a ser usadas. */
export async function refund(key: string, kind: string, weight: number): Promise<void> {
  await getDb()
    .prepare("update usage_counters set n = max(0, n - ?) where user_id = ? and day = ? and kind = ?")
    .bind(weight, key, today(), kind)
    .run();
}

/** Contadores de dias passados não servem mais; limpa de forma oportunista. */
export async function pruneCounters(): Promise<void> {
  await getDb()
    .prepare("delete from usage_counters where user_id is not null and day < date('now', '-3 days')")
    .run();
}

export type AiKind = "categorize" | "insight";
export type AiDenied = "user" | "global";

export const AI_LIMIT_MESSAGE: Record<AiDenied, string> = {
  user: "Você atingiu o limite diário de usos da IA. Ele reinicia às 21h (horário de Brasília).",
  global: "A IA está indisponível hoje por limite de uso. Ela volta às 21h (horário de Brasília).",
};

/**
 * Reserva chamadas à IA: primeiro a cota do usuário, depois o disjuntor global
 * (se o global negar, devolve a do usuário). Quem chama decide o que fazer ao
 * ser negado: a categorização segue sem IA; análises respondem 429.
 */
export async function reserveAi(userId: string, kind: AiKind, weight = 1): Promise<{ ok: true } | { ok: false; reason: AiDenied }> {
  const perUser = limitOf(kind === "categorize" ? "AI_CATEGORIZE_PER_DAY" : "AI_INSIGHT_PER_DAY");
  const userKind = `ai_${kind}`;
  if (!(await consume(userId, userKind, weight, perUser))) return { ok: false, reason: "user" };
  if (!(await consume("*", "ai_global", weight, limitOf("AI_GLOBAL_PER_DAY")))) {
    await refund(userId, userKind, weight);
    return { ok: false, reason: "global" };
  }
  return { ok: true };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Libera (ou não) o envio de um código de login. Conta por destinatário e no
 * total do dia. O endereço vai como hash, nunca em claro. Vale igual para
 * e-mail com conta ou sem: a resposta não revela se o endereço existe.
 */
export async function allowOtp(email: string): Promise<"ok" | "email" | "global"> {
  await pruneCounters();
  const key = `email:${await sha256Hex(email.trim().toLowerCase())}`;
  const window = Math.floor(Date.now() / (10 * 60 * 1000));
  if (!(await consume(key, `otp10_${window}`, 1, limitOf("OTP_PER_EMAIL_10MIN")))) return "email";
  if (!(await consume(key, "otp_day", 1, limitOf("OTP_PER_EMAIL_PER_DAY")))) return "email";
  if (!(await consume("*", "otp_global", 1, limitOf("OTP_GLOBAL_PER_DAY")))) return "global";
  return "ok";
}

/** Cadastro novo só abaixo do teto de usuários e com o interruptor ligado. */
export async function signupsAllowed(): Promise<boolean> {
  if (String((env as unknown as Record<string, unknown>).SIGNUPS_ENABLED ?? "true") === "false") return false;
  const row = await getDb().prepare('select count(*) as n from "user"').first<{ n: number }>();
  return (row?.n ?? 0) < limitOf("MAX_USERS");
}

/** Regras de estabelecimento: uma que já existe sempre pode ser atualizada; novas só até o teto. */
export async function ruleAllowed(userId: string, merchantKey: string): Promise<boolean> {
  const row = await getDb()
    .prepare(
      `select (select count(*) from merchant_rules where user_id = ?) as n,
              exists(select 1 from merchant_rules where user_id = ? and merchant_key = ?) as has`,
    )
    .bind(userId, userId, merchantKey)
    .first<{ n: number; has: number }>();
  return Number(row?.has ?? 0) === 1 || Number(row?.n ?? 0) < limitOf("MAX_MERCHANT_RULES");
}

/** Meses de saldo guardado: um mês que já existe sempre pode ser atualizado; novos só até o teto. */
export async function snapshotAllowed(userId: string, month: string): Promise<boolean> {
  const row = await getDb()
    .prepare(
      `select (select count(*) from savings_snapshots where user_id = ?) as n,
              exists(select 1 from savings_snapshots where user_id = ? and month = ?) as has`,
    )
    .bind(userId, userId, month)
    .first<{ n: number; has: number }>();
  return Number(row?.has ?? 0) === 1 || Number(row?.n ?? 0) < limitOf("MAX_SAVINGS_SNAPSHOTS");
}
