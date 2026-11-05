import { betterAuth } from "better-auth";
import { env, waitUntil } from "cloudflare:workers";
import { buildAuthOptions } from "./auth-options.js";
import { sendOtpEmail } from "./mailer.js";
import { allowOtp, signupsAllowed } from "./limits.js";
import { purgeUserData } from "./account.js";

function create() {
  const secret = env.BETTER_AUTH_SECRET;
  const turnstileSecret = env.TURNSTILE_SECRET_KEY;
  // Falha FECHADA: sem segredo não existe auth, em vez de cair num default.
  if (!secret || secret.length < 32 || !turnstileSecret) {
    throw new Error("BETTER_AUTH_SECRET (>= 32 chars) e TURNSTILE_SECRET_KEY são obrigatórios.");
  }

  return betterAuth(
    buildAuthOptions({
      database: env.DB as never,
      secret,
      webUrl: env.WEB_APP_URL,
      turnstileSecret,
      sendOtpEmail,
      runInBackground: (task) => waitUntil(task),
      allowOtp,
      signupsAllowed,
      purgeUserData,
    }),
  );
}

let instance: ReturnType<typeof create> | undefined;

/** Instância única por isolate (os segredos não mudam durante a vida dele). */
export function getAuth() {
  return (instance ??= create());
}
