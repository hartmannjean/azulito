"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  authIpRateLimiter,
  checkRateLimit,
  clearFailedLoginAttempts,
  getLoginLockout,
  registerFailedLoginAttempt,
} from "@azulito/shared";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, type AuthActionState } from "@/lib/validations/auth";
import { getClientIpFromHeaders } from "@/lib/request";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export async function login(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const dict = getDictionary(await getLocale());

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: dict.auth.errors.invalidCredentials };
  }

  const { email, password } = parsed.data;

  // Rate limit por IP e bloqueio progressivo por e-mail. Falha ABERTA (deixa
  // o login seguir) se o Upstash estiver indisponível — uma indisponibilidade
  // do provedor de rate limit não pode travar o login de todo mundo; não é
  // uma falha que um atacante controla sob demanda para burlar o limite.
  try {
    const ip = getClientIpFromHeaders(await headers());
    const ipLimit = await checkRateLimit(authIpRateLimiter, `login:${ip}`);
    if (!ipLimit.success) {
      return { error: dict.auth.errors.tooManyAttempts };
    }

    const lockout = await getLoginLockout(email);
    if (lockout.lockedOut) {
      const minutes = Math.ceil(lockout.retryAfterSeconds / 60);
      return { error: dict.auth.errors.lockedOut(minutes) };
    }
  } catch (error) {
    console.error("rate limit indisponível, deixando login passar:", error);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("falha ao autenticar no Supabase Auth:", error);
    try {
      await registerFailedLoginAttempt(email);
    } catch (rateLimitError) {
      console.error("falha ao registrar tentativa de login:", rateLimitError);
    }
    // Mensagem genérica de propósito: não revela se o e-mail existe ou se
    // foi a senha que errou (evita enumeração de contas).
    return { error: dict.auth.errors.invalidCredentials };
  }

  try {
    await clearFailedLoginAttempts(email);
  } catch (rateLimitError) {
    console.error("falha ao limpar tentativas de login:", rateLimitError);
  }
  redirect("/dashboard");
}
