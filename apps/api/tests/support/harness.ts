import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { AddressInfo } from "node:net";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { env } from "cloudflare:workers";
import { buildAuthOptions } from "../../src/lib/auth-options.ts";
import { allowOtp, signupsAllowed } from "../../src/lib/limits.ts";
import { purgeUserData } from "../../src/lib/account.ts";
import { D1Shim } from "./d1.ts";

const MIGRATIONS = new URL("../../migrations/", import.meta.url);

export type TestUser = { id: string; email: string; cookie: string };

export type ApiResponse<T = any> = { status: number; body: T };

export type HarnessOptions = {
  /** Liga um limitador por usuário falso (requisições por janela) em RATE_LIMITER_USER. */
  userRateLimit?: number;
  /** Sobrescreve limites (`LIMIT_<NOME>`), ex.: { MAX_USERS: 5 }. */
  limits?: Record<string, number>;
};

export type Harness = {
  baseUrl: string;
  db: DatabaseSync;
  bucket: Map<string, Uint8Array>;
  /** Quantas vezes a IA foi chamada de fato (para provar que o limite a impede). */
  aiCalls: () => number;
  /** Códigos de login "enviados" ao mailer falso. */
  sentOtps: { to: string; otp: string }[];
  /** Muda um limite em tempo de execução (valor `undefined` volta ao padrão). */
  setLimit(name: string, value: number | undefined): void;
  /** Chama um endpoint do Better Auth (sem Turnstile) como um navegador em `origin`. */
  authCall(path: string, body: unknown, ip?: string, cookie?: string): Promise<ApiResponse>;
  newUser(email: string, opts?: { verified?: boolean }): Promise<TestUser>;
  call<T = any>(user: TestUser | null, method: string, path: string, body?: unknown): Promise<ApiResponse<T>>;
  upload(user: TestUser, ofx: string | Uint8Array, fileName?: string): Promise<ApiResponse>;
  close(): Promise<void>;
};

/**
 * Sobe a api REAL (Express + requireAuth + Better Auth) sobre um SQLite em
 * memória com as migrations reais. Só o que é do Workers é falso: D1 (shim),
 * R2 (Map) e IA (resposta vazia). Cada usuário tem sessão de verdade, criada
 * pelo plugin de teste do Better Auth, que compartilha banco e segredo com a
 * instância de produção.
 */
export async function startHarness(options: HarnessOptions = {}): Promise<Harness> {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("pragma foreign_keys = on");
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }

  const bucket = new Map<string, Uint8Array>();
  let aiCalls = 0;
  const secret = randomBytes(32).toString("hex");
  const webUrl = "http://localhost:8787";
  const db = new D1Shim(sqlite);

  Object.assign(env, {
    DB: db,
    OFX_BUCKET: {
      head: async (key: string) => (bucket.has(key) ? { key } : null),
      get: async (key: string) => {
        const value = bucket.get(key);
        return value ? { arrayBuffer: async () => value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) } : null;
      },
      delete: async (keys: string | string[]) => {
        for (const key of Array.isArray(keys) ? keys : [keys]) bucket.delete(key);
      },
      list: async ({ prefix = "" }: { prefix?: string } = {}) => ({
        objects: [...bucket.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })),
        truncated: false,
      }),
      put: async (key: string, value: ArrayBuffer | ArrayBufferView) => {
        bucket.set(key, new Uint8Array(value instanceof ArrayBuffer ? value : (value.buffer as ArrayBuffer)));
      },
    },
    AI: {
      run: async () => {
        aiCalls += 1;
        return { response: "{}" };
      },
    },
    WEB_APP_URL: webUrl,
    MAIL_FROM: "Teste <teste@example.test>",
    BETTER_AUTH_SECRET: secret,
    TURNSTILE_SECRET_KEY: "teste",
    // Os testes de isolamento criam vários usuários; o teto de cadastro tem teste próprio.
    LIMIT_MAX_USERS: 1000,
  });
  for (const [name, value] of Object.entries(options.limits ?? {})) (env as Record<string, unknown>)[`LIMIT_${name}`] = value;

  if (options.userRateLimit !== undefined) {
    const counts = new Map<string, number>();
    const max = options.userRateLimit;
    (env as Record<string, unknown>).RATE_LIMITER_USER = {
      limit: async ({ key }: { key: string }) => {
        const n = (counts.get(key) ?? 0) + 1;
        counts.set(key, n);
        return { success: n <= max };
      },
    };
  }

  const sentOtps: { to: string; otp: string }[] = [];
  const authOptions = buildAuthOptions({
    database: db as never,
    secret,
    webUrl,
    turnstileSecret: "teste",
    sendOtpEmail: async (to, otp) => {
      sentOtps.push({ to, otp });
    },
    runInBackground: () => {},
    allowOtp,
    signupsAllowed,
    purgeUserData,
    // O Turnstile precisa de rede; o resto do fluxo (limites, cadastro) roda de verdade.
    disableCaptcha: true,
  });
  const testAuth = betterAuth({ ...authOptions, plugins: [...authOptions.plugins, testUtils()] });
  const test = (await testAuth.$context).test;

  const { createApp } = await import("../../src/app.ts");
  const server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  async function newUser(email: string, opts: { verified?: boolean } = {}): Promise<TestUser> {
    const user = await test.saveUser(test.createUser({ email, name: email, emailVerified: opts.verified ?? true }));
    const { headers } = await test.login({ userId: user.id });
    return { id: user.id, email, cookie: headers.get("cookie") ?? "" };
  }

  async function call<T = any>(user: TestUser | null, method: string, path: string, body?: unknown) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(user ? { cookie: user.cookie } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: response.status, body: parsed as T };
  }

  async function upload(user: TestUser, ofx: string | Uint8Array, fileName = "extrato.ofx") {
    const response = await fetch(`${baseUrl}/imports`, {
      method: "POST",
      headers: { cookie: user.cookie, "content-type": "application/octet-stream", "x-file-name": encodeURIComponent(fileName) },
      body: ofx,
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }

  async function authCall(path: string, body: unknown, ip = "203.0.113.10", cookie?: string) {
    const response = await testAuth.handler(
      new Request(`${webUrl}/api/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: webUrl, "x-azulito-client-ip": ip, ...(cookie ? { cookie } : {}) },
        body: JSON.stringify(body),
      }),
    );
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: response.status, body: parsed };
  }

  function setLimit(name: string, value: number | undefined) {
    if (value === undefined) delete (env as Record<string, unknown>)[`LIMIT_${name}`];
    else (env as Record<string, unknown>)[`LIMIT_${name}`] = value;
  }

  return {
    baseUrl,
    db: sqlite,
    bucket,
    aiCalls: () => aiCalls,
    sentOtps,
    setLimit,
    authCall,
    newUser,
    call,
    upload,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      sqlite.close();
    },
  };
}

type Tx = { fitid: string; date: string; amount: number; memo: string };

/** OFX 1.x mínimo (SGML), conta corrente ou cartão. */
export function buildOfx(opts: { kind: "checking" | "credit_card"; account: string; txs: Tx[] }): string {
  const rows = opts.txs
    .map(
      (t) =>
        `<STMTTRN><TRNTYPE>${t.amount < 0 ? "DEBIT" : "CREDIT"}<DTPOSTED>${t.date.replaceAll("-", "")}<TRNAMT>${t.amount.toFixed(2)}<FITID>${t.fitid}<MEMO>${t.memo}</STMTTRN>`,
    )
    .join("\n");
  const head = "OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE\n\n";
  const body =
    opts.kind === "checking"
      ? `<BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL<BANKACCTFROM><BANKID>0260<ACCTID>${opts.account}<ACCTTYPE>CHECKING</BANKACCTFROM><BANKTRANLIST><DTSTART>20260101<DTEND>20260131\n${rows}\n</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1>`
      : `<CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><CURDEF>BRL<CCACCTFROM><ACCTID>${opts.account}</CCACCTFROM><BANKTRANLIST><DTSTART>20260101<DTEND>20260131\n${rows}\n</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1>`;
  return `${head}<OFX><SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>20260201<LANGUAGE>POR<FI><ORG>Banco Teste</FI></SONRS></SIGNONMSGSRSV1>${body}</OFX>`;
}
