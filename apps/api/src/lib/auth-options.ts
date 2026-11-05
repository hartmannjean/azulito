import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins/email-otp";
import { captcha } from "better-auth/plugins/captcha";
import { passkey } from "@better-auth/passkey";

export interface AuthDeps {
  database: BetterAuthOptions["database"];
  secret: string;
  /** Origem pública do web (o cookie de sessão pertence a este domínio). */
  webUrl: string;
  turnstileSecret: string;
  sendOtpEmail: (to: string, otp: string, type: string) => Promise<void>;
  /** Para `waitUntil`: envio de e-mail não pode bloquear a resposta (timing). */
  runInBackground: (task: Promise<unknown>) => void;
  /** Libera (ou não) o envio de um código: por destinatário e no total do dia. */
  allowOtp: (email: string) => Promise<"ok" | "email" | "global">;
  /** Cadastro novo: teto de usuários e interruptor de cadastros. */
  signupsAllowed: () => Promise<boolean>;
  /** Apaga os dados do usuário (D1 + R2); se falhar, a exclusão da conta é abortada. */
  purgeUserData: (userId: string) => Promise<void>;
  /** Só em teste: sem Turnstile (o teste não tem rede). */
  disableCaptcha?: boolean;
}

/**
 * Configuração ÚNICA do Better Auth. Fica sem imports de `cloudflare:workers`
 * para poder ser usada também no script que gera a migration do schema.
 *
 * Decisões de segurança:
 * - Sem senha: login por código de e-mail (OTP) e passkey. Não há hash de
 *   senha para vazar nem fluxo de "esqueci a senha" para abusar.
 * - Sessão sem cookie cache: revogar uma sessão vale na hora.
 * - Rate limit em banco (D1): o contador em memória some a cada isolate.
 * - Origens confiáveis restritas ao domínio do web.
 */
export function buildAuthOptions(deps: AuthDeps) {
  const url = new URL(deps.webUrl);

  // Fica DEPOIS do captcha na lista de plugins: quem não passou no Turnstile não
  // gasta a cota de códigos de um endereço alheio.
  const limits = {
    id: "azulito-limits",
    hooks: {
      before: [
        {
          matcher: (context) => context.path === "/email-otp/send-verification-otp",
          handler: createAuthMiddleware(async (ctx) => {
            const email = typeof ctx.body?.email === "string" ? ctx.body.email : "";
            if (!email) return;
            if ((await deps.allowOtp(email)) !== "ok") {
              throw new APIError("TOO_MANY_REQUESTS", { message: "Muitas tentativas. Tente mais tarde." });
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;

  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";

  return {
    appName: "Azulito",
    baseURL: deps.webUrl,
    basePath: "/api/auth",
    secret: deps.secret,
    database: deps.database,
    trustedOrigins: [url.origin],
    telemetry: { enabled: false },

    emailAndPassword: { enabled: false },

    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // Ações sensíveis (excluir a conta) exigem login nos últimos 10 minutos.
      freshAge: 60 * 10,
      cookieCache: { enabled: false },
    },

    advanced: {
      useSecureCookies: !isLocal,
      cookiePrefix: "azulito",
      // O web (único chamador, por service binding) repassa aqui o IP real que
      // a Cloudflare viu, sobrescrevendo qualquer valor do cliente. Só é
      // confiável porque a api NÃO tem domínio público. Sem isso o rate limit
      // do Better Auth cairia num contador único para todos os usuários.
      ipAddress: { ipAddressHeaders: ["x-azulito-client-ip"] },
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
    },

    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/email-otp/send-verification-otp": { window: 600, max: 5 },
        "/sign-in/email-otp": { window: 600, max: 10 },
        "/passkey/*": { window: 60, max: 20 },
      },
    },

    // Exclusão de conta (LGPD): sem senha, o Better Auth exige sessão recente (freshAge).
    // Os dados são apagados ANTES do usuário; se falhar, a conta fica e dá para tentar de novo.
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user: { id: string }) => {
          await deps.purgeUserData(user.id);
        },
      },
    },

    // Criar conta é um passo EXPLÍCITO: só a tela de cadastro envia o nome. O login (sem nome)
    // nunca cria conta (a biblioteca grava name "" nesse caso). Cadastro aberto, mas com teto.
    databaseHooks: {
      user: {
        create: {
          before: async (user: { name?: string | null }) => {
            const name = (user.name ?? "").trim();
            if (name.length < 2 || name.length > 80) {
              throw new APIError("FORBIDDEN", {
                message: "Não existe conta com este e-mail. Crie uma conta.",
                code: "SIGNUP_REQUIRED",
              });
            }
            if (!(await deps.signupsAllowed())) {
              throw new APIError("FORBIDDEN", { message: "Cadastros fechados no momento.", code: "SIGNUPS_CLOSED" });
            }
          },
        },
      },
    },

    plugins: [
      ...(deps.disableCaptcha
        ? []
        : [
            captcha({
              provider: "cloudflare-turnstile",
              secretKey: deps.turnstileSecret,
              endpoints: ["/email-otp/send-verification-otp"],
            }),
          ]),
      limits,
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp, type }) {
          // Sem await: o tempo de resposta não pode revelar se o e-mail existe.
          deps.runInBackground(deps.sendOtpEmail(email, otp, type));
        },
      }),
      passkey({
        rpID: url.hostname,
        rpName: "Azulito",
        origin: url.origin,
      }),
    ],
  } satisfies BetterAuthOptions;
}
