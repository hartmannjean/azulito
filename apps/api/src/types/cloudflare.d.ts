declare module "cloudflare:node" {
  export function httpServerHandler(options: { port: number }): {
    fetch(request: Request): Promise<Response>;
  };
}

interface D1Result<T = Record<string, unknown>> {
  results: T[];
  meta: { changes: number };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface R2Bucket {
  delete(keys: string | string[]): Promise<void>;
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<{
    objects: { key: string }[];
    truncated: boolean;
    cursor?: string;
  }>;
  head(key: string): Promise<{ key: string } | null>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
}

declare module "cloudflare:workers" {
  export const env: {
    DB: D1Database;
    OFX_BUCKET: R2Bucket;
    RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
    /** Limite por USUÁRIO (chave `u:<user_id>`), aplicado depois da autenticação. */
    RATE_LIMITER_USER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
    /** "false" fecha novos cadastros sem mexer em quem já tem conta. */
    SIGNUPS_ENABLED?: string;
    AI: { run(model: string, input: unknown): Promise<unknown> };
    WEB_APP_URL: string;
    MAIL_FROM: string;
    // Secrets (wrangler secret put) — nunca em `vars` nem no repositório.
    BETTER_AUTH_SECRET?: string;
    TURNSTILE_SECRET_KEY?: string;
    RESEND_API_KEY?: string;
    /** Só no .dev.vars local: loga o OTP em vez de enviar e-mail. */
    DEV_LOG_OTP?: string;
  };
  export function waitUntil(promise: Promise<unknown>): void;
}
