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

export async function login(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "E-mail ou senha inválidos." };
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
      return { error: "Muitas tentativas. Aguarde um momento e tente novamente." };
    }

    const lockout = await getLoginLockout(email);
    if (lockout.lockedOut) {
      const minutes = Math.ceil(lockout.retryAfterSeconds / 60);
      return { error: `Muitas tentativas para este e-mail. Tente novamente em ${minutes} min.` };
    }
  } catch (error) {
    console.error("rate limit indisponível, deixando login passar:", error);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    try {
      await registerFailedLoginAttempt(email);
    } catch (rateLimitError) {
      console.error("falha ao registrar tentativa de login:", rateLimitError);
    }
    // Mensagem genérica de propósito: não revela se o e-mail existe ou se
    // foi a senha que errou (evita enumeração de contas).
    return { error: "E-mail ou senha inválidos." };
  }

  try {
    await clearFailedLoginAttempts(email);
  } catch (rateLimitError) {
    console.error("falha ao limpar tentativas de login:", rateLimitError);
  }
  redirect("/dashboard");
}
