"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authIpRateLimiter, checkRateLimit } from "@azulito/shared";
import { createClient } from "@/lib/supabase/server";
import { signupSchema, type AuthActionState } from "@/lib/validations/auth";
import { getClientIpFromHeaders } from "@/lib/request";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export async function signup(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const dict = getDictionary(await getLocale());

  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: dict.auth.errors.invalidSignupInput };
  }

  const { email, password } = parsed.data;

  // Falha ABERTA se o Upstash estiver indisponível — ver comentário
  // equivalente em app/login/actions.ts.
  try {
    const ip = getClientIpFromHeaders(await headers());
    const ipLimit = await checkRateLimit(authIpRateLimiter, `signup:${ip}`);
    if (!ipLimit.success) {
      return { error: dict.auth.errors.tooManyAttempts };
    }
  } catch (error) {
    console.error("rate limit indisponível, deixando cadastro passar:", error);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    console.error("falha ao criar conta no Supabase Auth:", error);
    // Mensagem genérica: não confirma nem nega se o e-mail já está cadastrado.
    return { error: dict.auth.errors.signupFailed };
  }

  redirect("/login?signup=success");
}
