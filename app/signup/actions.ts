"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signupSchema, type AuthActionState } from "@/lib/validations/auth";
import { authIpRateLimiter, checkRateLimit } from "@/lib/ratelimit";
import { getClientIpFromHeaders } from "@/lib/request";

export async function signup(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Use um e-mail válido e uma senha com pelo menos 8 caracteres." };
  }

  const { email, password } = parsed.data;

  // Cadastro também é alvo de abuso (criação em massa de contas, spam),
  // então recebe o mesmo rate limit por IP do login.
  const ip = getClientIpFromHeaders(await headers());
  const ipLimit = await checkRateLimit(authIpRateLimiter, `signup:${ip}`);
  if (!ipLimit.success) {
    return { error: "Muitas tentativas. Aguarde um momento e tente novamente." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    // Mensagem genérica: não confirma nem nega se o e-mail já está cadastrado.
    return { error: "Não foi possível criar a conta. Tente novamente." };
  }

  redirect("/login?signup=success");
}
