// Teste de fumaça do auth em Node (SQLite em memória), sem Workers.
// Uso: node --experimental-strip-types --no-warnings scripts/auth-smoke.mts
import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { buildAuthOptions } from "../src/lib/auth-options.ts";

const WEB = "https://azulito.hartmanns.com.br";
const sent: { to: string; otp: string }[] = [];

const options = buildAuthOptions({
  database: new DatabaseSync(":memory:") as never,
  secret: "s".repeat(40),
  webUrl: WEB,
  // Segredo de teste publicado pela Cloudflare: o Turnstile aceita qualquer token.
  turnstileSecret: "1x0000000000000000000000000000000AA",
  sendOtpEmail: async (to, otp) => {
    sent.push({ to, otp });
  },
  runInBackground: (task) => void task,
});

await (await getMigrations(options)).runMigrations();
const auth = betterAuth(options);

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  auth.handler(
    new Request(`${WEB}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );

const ok = { origin: WEB, "x-captcha-response": "t" };
const email = "teste@example.com";

let r = await post("/email-otp/send-verification-otp", { email, type: "sign-in" }, ok);
console.log("pedir código, origem certa:", r.status);

r = await post(
  "/email-otp/send-verification-otp",
  { email, type: "sign-in" },
  { origin: "https://evil.example", "x-captcha-response": "t" },
);
console.log("pedir código, origem errada:", r.status, "(esperado 403)");

r = await post("/email-otp/send-verification-otp", { email, type: "sign-in" }, { origin: WEB });
console.log("pedir código, sem captcha:", r.status, "(esperado 4xx)");

await new Promise((res) => setTimeout(res, 100));
const otp = sent.at(-1)?.otp ?? "";
console.log("e-mail enviado ao mailer:", sent.length, "| código de 6 dígitos:", /^\d{6}$/.test(otp));

r = await post("/sign-in/email-otp", { email, otp: "000000" }, { origin: WEB });
console.log("login com código errado:", r.status, "(esperado 4xx)");

r = await post("/sign-in/email-otp", { email, otp }, { origin: WEB });
console.log("login com código certo:", r.status);
const cookies = r.headers.getSetCookie();
console.log(
  "cookies:",
  cookies.map((c) => c.replace(/=[^;]{10,}/, "=<valor>")),
);

const session = await auth.api.getSession({
  headers: new Headers({ cookie: cookies.map((c) => c.split(";")[0]).join("; ") }),
});
console.log("sessão:", session ? `user ${session.user.id.slice(0, 6)}…, emailVerified=${session.user.emailVerified}` : null);

r = await post("/sign-in/email-otp", { email, otp }, { origin: WEB });
console.log("reusar o mesmo código:", r.status, "(esperado 4xx)");
