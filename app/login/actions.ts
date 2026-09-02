"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, type AuthActionState } from "@/lib/validations/auth";
import {
  authIpRateLimiter,
  checkRateLimit,
  clearFailedLoginAttempts,
  getLoginLockout,
  registerFailedLoginAttempt,
} from "@/lib/ratelimit";
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

  // Rate limit por IP: barra bots batendo no endpoint muito rápido, antes
  // mesmo de olhar para qual e-mail está sendo tentado.
  const ip = getClientIpFromHeaders(await headers());
  const ipLimit = await checkRateLimit(authIpRateLimiter, `login:${ip}`);
  if (!ipLimit.success) {
    return { error: "Muitas tentativas. Aguarde um momento e tente novamente." };
  }

  // Bloqueio progressivo por e-mail: barra brute-force de senha contra uma
  // conta específica, mesmo que distribuído entre vários IPs.
  const lockout = await getLoginLockout(email);
  if (lockout.lockedOut) {
    const minutes = Math.ceil(lockout.retryAfterSeconds / 60);
    return {
      error: `Muitas tentativas para este e-mail. Tente novamente em ${minutes} min.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await registerFailedLoginAttempt(email);
    // Mensagem genérica de propósito: não revela se o e-mail existe ou se
    // foi a senha que errou (evita enumeração de contas).
    return { error: "E-mail ou senha inválidos." };
  }

  await clearFailedLoginAttempts(email);
  redirect("/dashboard");
}
