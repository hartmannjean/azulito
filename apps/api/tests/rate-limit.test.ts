import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { env } from "cloudflare:workers";
import { startHarness, type Harness, type TestUser } from "./support/harness.ts";

/**
 * Limite de requisições. As chamadas de dados vêm do web por service binding,
 * sem IP do cliente: um contador por IP seria UM contador para todos. O limite
 * tem de ser por usuário, e um usuário pesado não pode derrubar os outros.
 */

let h: Harness;
let alice: TestUser;
let bob: TestUser;

before(async () => {
  h = await startHarness({ userRateLimit: 5 });
  alice = await h.newUser("alice@example.test");
  bob = await h.newUser("bob@example.test");
});
after(() => h.close());

async function status(user: TestUser | null, path = "/me", headers: Record<string, string> = {}) {
  const res = await fetch(`${h.baseUrl}${path}`, { headers: { ...(user ? { cookie: user.cookie } : {}), ...headers } });
  return { status: res.status, retryAfter: res.headers.get("retry-after") };
}

describe("por usuário", () => {
  test("estourar o limite bloqueia só quem estourou", async () => {
    for (let i = 0; i < 5; i++) assert.equal((await status(alice)).status, 200, `requisição ${i + 1}`);
    const blocked = await status(alice);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.retryAfter, "60");

    for (let i = 0; i < 5; i++) assert.equal((await status(bob)).status, 200, "o Bob tem o próprio contador");
  });

  test("sem sessão válida não consome o contador de ninguém", async () => {
    for (let i = 0; i < 20; i++) assert.equal((await status(null)).status, 401);
    assert.equal((await status({ ...bob, cookie: "azulito.session_token=falso.falso" })).status, 401);
    // O Bob já gastou os 5 dele no teste anterior: continua 429, e não 401 ou 200.
    assert.equal((await status(bob)).status, 429);
  });
});

describe("por IP, antes do login", () => {
  test("sem IP do cliente (chamada do web) não há contador compartilhado; com IP, há", async () => {
    const counts = new Map<string, number>();
    (env as Record<string, unknown>).RATE_LIMITER = {
      limit: async ({ key }: { key: string }) => {
        const n = (counts.get(key) ?? 0) + 1;
        counts.set(key, n);
        return { success: n <= 2 };
      },
    };
    try {
      for (let i = 0; i < 10; i++) {
        assert.equal((await status(null, "/health")).status, 200, "sem IP real não vira um contador único de todos");
      }
      const withIp = { "x-azulito-client-ip": "203.0.113.77" };
      assert.equal((await status(null, "/health", withIp)).status, 200);
      assert.equal((await status(null, "/health", withIp)).status, 200);
      assert.equal((await status(null, "/health", withIp)).status, 429);
      assert.equal((await status(null, "/health", { "x-azulito-client-ip": "203.0.113.78" })).status, 200, "outro IP não é afetado");
    } finally {
      delete (env as Record<string, unknown>).RATE_LIMITER;
    }
  });

  test("x-forwarded-for, que é falsificável, não escolhe o contador", async () => {
    let lastKey = "";
    (env as Record<string, unknown>).RATE_LIMITER = {
      limit: async ({ key }: { key: string }) => {
        lastKey = key;
        return { success: true };
      },
    };
    try {
      await status(null, "/health", { "x-forwarded-for": "6.6.6.6" });
      assert.equal(lastKey, "", "sem cf-connecting-ip nem x-azulito-client-ip o limitador por IP nem é consultado");
    } finally {
      delete (env as Record<string, unknown>).RATE_LIMITER;
    }
  });
});
