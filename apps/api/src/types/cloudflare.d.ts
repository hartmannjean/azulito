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
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

interface R2Bucket {
  head(key: string): Promise<{ key: string } | null>;
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
    AI: { run(model: string, input: unknown): Promise<unknown> };
  };
}
