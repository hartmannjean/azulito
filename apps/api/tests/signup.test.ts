import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { startHarness, type Harness } from "./support/harness.ts";

/**
 * Criar conta é um passo explícito: só a tela de cadastro envia o nome. O login
 * comum nunca cria conta, mesmo com o código certo.
 */

let h: Harness;
let ipSeed = 0;

before(async () => {
  h = await startHarness();
  // Estes testes pedem vários códigos para o mesmo e-mail; os limites de código têm testes próprios (limits.test.ts).
  h.setLimit("OTP_PER_EMAIL_10MIN", 1000);
  h.setLimit("OTP_PER_EMAIL_PER_DAY", 1000);
});
after(() => h.close());

/** Pede um código e entra com ele, como o navegador faria. `name` só vai na tela de cadastro. */
async function enter(email: string, name?: string) {
  const ip = `203.0.113.${++ipSeed}`; // o rate limit do Better Auth é por IP
  const sent = await h.authCall("/email-otp/send-verification-otp", { email, type: "sign-in" }, ip);
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  const otp = [...h.sentOtps].reverse().find((o) => o.to === email)?.otp;
  assert.ok(otp, "o código chegou ao mailer");
  return h.authCall("/sign-in/email-otp", { email, otp, ...(name !== undefined ? { name } : {}) }, ip);
}

const userRow = (email: string) =>
  h.db.prepare('select id, name, emailVerified from "user" where email = ?').get(email) as
    | { id: string; name: string; emailVerified: number }
    | undefined;
const userCount = () => (h.db.prepare('select count(*) as n from "user"').get() as { n: number }).n;

describe("login não cria conta", () => {
  test("e-mail sem conta, mesmo com o código certo → 403 SIGNUP_REQUIRED e nada é criado", async () => {
    const before = userCount();
    const res = await enter("ninguem@example.test");
    assert.equal(res.status, 403);
    assert.equal(res.body.code, "SIGNUP_REQUIRED");
    assert.equal(userRow("ninguem@example.test"), undefined, "a conta não pode ter sido criada");
    assert.equal(userCount(), before);
    assert.equal((h.db.prepare("select count(*) as n from session").get() as { n: number }).n, 0, "nem sessão");
  });

  test("nome vazio, só espaços ou curto demais também não cria", async () => {
    for (const name of ["", "   ", "A", "\n\t "]) {
      const res = await enter("curto@example.test", name);
      assert.equal(res.status, 403, JSON.stringify(name));
      assert.equal(res.body.code, "SIGNUP_REQUIRED");
    }
    assert.equal(userRow("curto@example.test"), undefined);
  });

  test("nome com mais de 80 caracteres não cria", async () => {
    const res = await enter("longo@example.test", "x".repeat(81));
    assert.equal(res.status, 403);
    assert.equal(userRow("longo@example.test"), undefined);
  });
});

describe("cadastro explícito", () => {
  test("com nome válido, cria a conta com o nome e o e-mail verificado", async () => {
    const res = await enter("maria@example.test", "  Maria Silva ");
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const row = userRow("maria@example.test");
    assert.ok(row, "a conta foi criada");
    assert.equal(row.name.trim(), "Maria Silva");
    assert.equal(row.emailVerified, 1);
  });

  test("nome de exatamente 2 e 80 caracteres é aceito", async () => {
    assert.equal((await enter("dois@example.test", "Jo")).status, 200);
    assert.equal((await enter("oitenta@example.test", "y".repeat(80))).status, 200);
  });

  test("a tela de cadastro com um e-mail que já tem conta apenas entra, sem trocar o nome", async () => {
    const res = await enter("maria@example.test", "Outro Nome Qualquer");
    assert.equal(res.status, 200);
    assert.equal(userRow("maria@example.test")!.name.trim(), "Maria Silva", "o nome original continua");
    assert.equal((h.db.prepare('select count(*) as n from "user" where email = ?').get("maria@example.test") as { n: number }).n, 1);
  });

  test("quem já tem conta continua entrando pelo login comum, sem nome", async () => {
    const res = await enter("maria@example.test");
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  test("depois de um login recusado, o cadastro com um código novo funciona", async () => {
    assert.equal((await enter("virou@example.test")).status, 403);
    assert.equal((await enter("virou@example.test", "Virou Cliente")).status, 200);
    assert.ok(userRow("virou@example.test"));
  });
});

describe("teto de usuários continua valendo no cadastro", () => {
  test("no teto, o cadastro novo é barrado com SIGNUPS_CLOSED e quem já tem conta entra", async () => {
    h.setLimit("MAX_USERS", userCount());
    try {
      const blocked = await enter("lotado@example.test", "Lotado");
      assert.equal(blocked.status, 403);
      assert.equal(blocked.body.code, "SIGNUPS_CLOSED");
      assert.equal(userRow("lotado@example.test"), undefined);
      assert.equal((await enter("maria@example.test")).status, 200);
    } finally {
      h.setLimit("MAX_USERS", undefined);
    }
  });
});
