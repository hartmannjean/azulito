import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { env } from "cloudflare:workers";
import { AI_LIMIT_MESSAGE, LIMITS } from "../src/lib/limits.ts";
import { buildOfx, startHarness, type Harness, type TestUser } from "./support/harness.ts";

/**
 * Limites de uso. A cota gratuita (IA, D1, R2, e-mail) é da conta toda, então
 * cada limite precisa funcionar e, principalmente, um usuário estourando o dele
 * não pode afetar o outro.
 */

let h: Harness;
let alice: TestUser;
let bob: TestUser;

before(async () => {
  h = await startHarness();
  alice = await h.newUser("alice@example.test");
  bob = await h.newUser("bob@example.test");
});
after(() => h.close());

/** OFX com `n` transações; `tag` torna conta, FITIDs e descrições únicos. */
function file(tag: string, n = 1, account = `${tag}-acc`) {
  return buildOfx({
    kind: "checking",
    account,
    txs: Array.from({ length: n }, (_, i) => ({
      fitid: `${tag}-${i}`,
      date: "2026-01-10",
      amount: -(10 + i),
      memo: `Loja ${tag} ${i}`,
    })),
  });
}

function counter(key: string, kind: string): number | null {
  const row = h.db.prepare("select n from usage_counters where user_id = ? and kind = ?").get(key, kind) as { n: number } | undefined;
  return row ? row.n : null;
}

function resetDay(key: string) {
  h.db.prepare("update usage_counters set day = date('now', '-1 day') where user_id = ?").run(key);
}

test("os valores padrão dos limites não foram relaxados sem querer", () => {
  assert.equal(LIMITS.MAX_USERS, 5);
  assert.equal(LIMITS.IMPORTS_PER_DAY, 20);
  assert.equal(LIMITS.MAX_OFX_BYTES, 2 * 1024 * 1024);
  assert.equal(LIMITS.AI_CATEGORIZE_PER_DAY, 30);
  assert.equal(LIMITS.AI_INSIGHT_PER_DAY, 40);
  assert.equal(LIMITS.AI_GLOBAL_PER_DAY, 300);
  assert.equal(LIMITS.OTP_PER_EMAIL_10MIN, 3);
  assert.equal(LIMITS.OTP_GLOBAL_PER_DAY, 80);
});

describe("importações por dia", () => {
  test("estourar o limite bloqueia só quem estourou, e o contador reinicia no dia seguinte", async () => {
    h.setLimit("IMPORTS_PER_DAY", 3);
    try {
      for (let i = 1; i <= 3; i++) {
        assert.equal((await h.upload(alice, file(`imp${i}`))).status, 200, `importação ${i}`);
      }
      const blocked = await h.upload(alice, file("imp4"));
      assert.equal(blocked.status, 429);
      assert.match(blocked.body.error, /Limite diário de importações/);

      assert.equal((await h.upload(bob, file("bobimp"))).status, 200, "o Bob não pode ser afetado");

      resetDay(alice.id);
      assert.equal((await h.upload(alice, file("imp5"))).status, 200, "no dia seguinte volta a funcionar");
    } finally {
      h.setLimit("IMPORTS_PER_DAY", undefined);
    }
  });
});

describe("tamanho e quantidade", () => {
  test("arquivo acima de 2 MB → 413 e nada é guardado", async () => {
    const before = h.bucket.size;
    const huge = new Uint8Array(LIMITS.MAX_OFX_BYTES + 1).fill(120);
    const res = await h.upload(alice, huge);
    assert.equal(res.status, 413);
    assert.equal(res.body.error, "Arquivo grande demais.");
    assert.equal(h.bucket.size, before);
  });

  test("5.001 transações em um arquivo → 400; 5.000 → ok", async () => {
    const over = await h.upload(bob, file("big1", 5001));
    assert.equal(over.status, 400);
    assert.match(over.body.error, /grande demais/i);
    const exact = await h.upload(bob, file("big2", 5000));
    assert.equal(exact.status, 200, JSON.stringify(exact.body));
  });

  test("transações guardadas por usuário: acima do teto → 413, sem afetar o outro", async () => {
    h.setLimit("MAX_TRANSACTIONS_PER_USER", 10);
    try {
      assert.equal((await h.upload(alice, file("cap1", 12, "cap-acc"))).status, 200);
      const blocked = await h.upload(alice, file("cap2", 1, "cap-acc"));
      assert.equal(blocked.status, 413);
      assert.match(blocked.body.error, /Limite de transações/);

      // O Bob já tem muito mais que 10 (importou 5.000 acima) e este teto é por usuário:
      // ele também está acima do teto. Um terceiro usuário, limpo, não é afetado.
      const carol = await h.newUser("carol@example.test");
      assert.equal((await h.upload(carol, file("carol1", 3))).status, 200);
    } finally {
      h.setLimit("MAX_TRANSACTIONS_PER_USER", undefined);
    }
  });

  test("armazenamento de arquivos: acima do teto → 413; reenviar o mesmo arquivo não gasta espaço", async () => {
    const dave = await h.newUser("dave@example.test");
    const erin = await h.newUser("erin@example.test");
    const f1 = file("sto1", 5);
    const f2 = file("sto2", 5);
    const f3 = file("sto3", 5);
    const size = Buffer.byteLength(f1);
    h.setLimit("MAX_R2_BYTES_PER_USER", size * 2 + 10);
    try {
      assert.equal((await h.upload(dave, f1)).status, 200);
      assert.equal((await h.upload(dave, f2)).status, 200);
      const blocked = await h.upload(dave, f3);
      assert.equal(blocked.status, 413);
      assert.match(blocked.body.error, /armazenamento/);
      assert.equal((await h.upload(dave, f1)).status, 200, "o mesmo arquivo já está guardado");
      assert.equal((await h.upload(erin, f3)).status, 200, "outro usuário tem o próprio espaço");
    } finally {
      h.setLimit("MAX_R2_BYTES_PER_USER", undefined);
    }
  });

  test("regras por estabelecimento: novas param no teto, a existente ainda pode mudar", async () => {
    const frank = await h.newUser("frank@example.test");
    const ofx = buildOfx({
      kind: "checking",
      account: "rule-acc",
      txs: [
        { fitid: "r1", date: "2026-01-10", amount: -10, memo: "MERCADO ZETA" },
        { fitid: "r2", date: "2026-01-11", amount: -11, memo: "MERCADO ZETA" },
        { fitid: "r3", date: "2026-01-12", amount: -12, memo: "FARMACIA OMEGA" },
        { fitid: "r4", date: "2026-01-13", amount: -13, memo: "FARMACIA OMEGA" },
      ],
    });
    assert.equal((await h.upload(frank, ofx)).status, 200);
    const idOf = (fitid: string) => (h.db.prepare("select id from transactions where user_id = ? and fitid = ?").get(frank.id, fitid) as { id: string }).id;
    const categoryOf = (fitid: string) => (h.db.prepare("select category from transactions where user_id = ? and fitid = ?").get(frank.id, fitid) as { category: string | null }).category;
    const rules = () => (h.db.prepare("select count(*) as n from merchant_rules where user_id = ?").get(frank.id) as { n: number }).n;

    h.setLimit("MAX_MERCHANT_RULES", 1);
    try {
      assert.equal((await h.call(frank, "PATCH", `/transactions/${idOf("r1")}`, { category: "Groceries" })).status, 200);
      assert.equal(rules(), 1);
      assert.equal(categoryOf("r2"), "Groceries", "a regra foi aplicada ao outro lançamento do mesmo lugar");

      assert.equal((await h.call(frank, "PATCH", `/transactions/${idOf("r3")}`, { category: "Pharmacy" })).status, 200);
      assert.equal(categoryOf("r3"), "Pharmacy", "a categoria da própria transação vale");
      assert.equal(rules(), 1, "não cria regra acima do teto");
      assert.equal(categoryOf("r4"), null, "e não propaga para as outras do mesmo lugar");

      assert.equal((await h.call(frank, "PATCH", `/transactions/${idOf("r1")}`, { category: "Eating out" })).status, 200);
      assert.equal((h.db.prepare("select category from merchant_rules where user_id = ?").get(frank.id) as { category: string }).category, "Eating out");
    } finally {
      h.setLimit("MAX_MERCHANT_RULES", undefined);
    }
  });

  test("meses de saldo guardado: novos param no teto, o existente ainda pode mudar", async () => {
    const gina = await h.newUser("gina@example.test");
    h.setLimit("MAX_SAVINGS_SNAPSHOTS", 2);
    try {
      assert.equal((await h.call(gina, "PUT", "/savings", { month: "2026-01", balance: 100 })).status, 200);
      assert.equal((await h.call(gina, "PUT", "/savings", { month: "2026-02", balance: 200 })).status, 200);
      assert.equal((await h.call(gina, "PUT", "/savings", { month: "2026-03", balance: 300 })).status, 413);
      assert.equal((await h.call(gina, "PUT", "/savings", { month: "2026-01", balance: 150 })).status, 200);
    } finally {
      h.setLimit("MAX_SAVINGS_SNAPSHOTS", undefined);
    }
  });
});

describe("IA", () => {
  test("categorização: o limite do usuário para as chamadas, sem derrubar a importação nem afetar o outro", async () => {
    const hank = await h.newUser("hank@example.test");
    const iris = await h.newUser("iris@example.test");
    h.setLimit("AI_CATEGORIZE_PER_DAY", 3);
    try {
      const start = h.aiCalls();
      assert.equal((await h.upload(hank, file("ai1", 2))).status, 200); // 1ª chamada
      for (let i = 0; i < 4; i++) {
        const res = await h.call(hank, "POST", "/transactions/categorize");
        assert.equal(res.status, 200, "sem cota de IA a categorização segue sem ela, não falha");
      }
      assert.equal(h.aiCalls() - start, 3, "só 3 chamadas à IA, apesar de 5 tentativas");
      assert.equal(counter(hank.id, "ai_categorize"), 3);

      const mid = h.aiCalls();
      assert.equal((await h.upload(iris, file("ai2", 2))).status, 200);
      assert.equal(h.aiCalls() - mid, 1, "a Iris tem a própria cota");
    } finally {
      h.setLimit("AI_CATEGORIZE_PER_DAY", undefined);
    }
  });

  test("análises: acima do limite → 429 com mensagem clara; o peso de cada análise conta", async () => {
    const jack = await h.newUser("jack@example.test");
    const kate = await h.newUser("kate@example.test");
    h.setLimit("AI_INSIGHT_PER_DAY", 2);
    try {
      const audit = async (user: TestUser) => {
        h.db.prepare("delete from ai_insights where user_id = ? and kind = 'audit'").run(user.id); // sem o intervalo de 30 s
        return h.call(user, "POST", "/audit", { month: "2026-01" });
      };
      assert.ok([200, 422].includes((await audit(jack)).status));
      assert.ok([200, 422].includes((await audit(jack)).status));
      const blocked = await audit(jack);
      assert.equal(blocked.status, 429);
      assert.equal(blocked.body.error, AI_LIMIT_MESSAGE.user);
      assert.ok([200, 422].includes((await audit(kate)).status), "a Kate tem a própria cota");
    } finally {
      h.setLimit("AI_INSIGHT_PER_DAY", undefined);
    }

    // Análise de economia reserva 5 (1 resumo + até 4 seções): com limite 7, a segunda não cabe.
    const leo = await h.newUser("leo@example.test");
    h.setLimit("AI_INSIGHT_PER_DAY", 7);
    try {
      await h.call(leo, "POST", "/savings/insight");
      assert.equal(counter(leo.id, "ai_insight"), 5);
      h.db.prepare("delete from ai_insights where user_id = ? and kind = 'savings'").run(leo.id);
      const second = await h.call(leo, "POST", "/savings/insight");
      assert.equal(second.status, 429);
      assert.equal(counter(leo.id, "ai_insight"), 5, "o que não coube não é cobrado");
    } finally {
      h.setLimit("AI_INSIGHT_PER_DAY", undefined);
    }
  });

  test("sugestões de orçamento e análise de recorrências também respeitam o limite", async () => {
    const pam = await h.newUser("pam@example.test");
    const quin = await h.newUser("quin@example.test");
    h.setLimit("AI_INSIGHT_PER_DAY", 1);
    try {
      h.db.prepare("delete from ai_insights where user_id = ? and kind = 'budget'").run(pam.id);
      assert.ok((await h.call(pam, "POST", "/budgets/suggestions")).status < 500);
      h.db.prepare("delete from ai_insights where user_id = ? and kind = 'budget'").run(pam.id);
      const blocked = await h.call(pam, "POST", "/budgets/suggestions");
      assert.equal(blocked.status, 429);
      assert.equal(blocked.body.error, AI_LIMIT_MESSAGE.user);

      // Recorrências: precisa de uma assinatura detectada (mesmo gasto em vários meses recentes).
      const month = (back: number) => {
        const now = new Date();
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1)).toISOString().slice(0, 7);
      };
      const subscription = buildOfx({
        kind: "checking",
        account: "rec-acc",
        txs: [0, 1, 2, 3].map((back) => ({ fitid: `rec${back}`, date: `${month(back)}-01`, amount: -39.9, memo: "STREAMING XYZ" })),
      });
      assert.equal((await h.upload(quin, subscription)).status, 200);
      await h.call(quin, "POST", "/recurring/insight");
      assert.equal(counter(quin.id, "ai_insight"), 1, "a primeira análise reservou a cota");
      h.db.prepare("delete from ai_insights where user_id = ? and kind = 'recurring'").run(quin.id);
      const second = await h.call(quin, "POST", "/recurring/insight");
      assert.equal(second.status, 429);
      assert.equal(second.body.error, AI_LIMIT_MESSAGE.user);
    } finally {
      h.setLimit("AI_INSIGHT_PER_DAY", undefined);
    }
  });

  test("disjuntor global: esgotado, ninguém usa a IA, o app segue funcionando e a cota do usuário é devolvida", async () => {
    const mia = await h.newUser("mia@example.test");
    const ned = await h.newUser("ned@example.test");
    const oli = await h.newUser("oli@example.test");
    // Parte do zero: o contador global dos testes anteriores não conta.
    h.db.prepare("delete from usage_counters where user_id = '*'").run();
    h.setLimit("AI_GLOBAL_PER_DAY", 2);
    try {
      const start = h.aiCalls();
      assert.equal((await h.upload(mia, file("gl1", 2))).status, 200); // global: 1
      assert.equal((await h.upload(ned, file("gl2", 2))).status, 200); // global: 2
      assert.equal(h.aiCalls() - start, 2);

      const stopped = await h.call(mia, "POST", "/transactions/categorize");
      assert.equal(stopped.status, 200, "a categorização segue (só com as regras)");
      assert.equal(h.aiCalls() - start, 2, "e a IA NÃO foi chamada");
      assert.equal(counter(mia.id, "ai_categorize"), 1, "a cota da Mia foi devolvida, ela não gastou");

      h.db.prepare("delete from ai_insights where user_id = ? and kind = 'audit'").run(ned.id);
      const audit = await h.call(ned, "POST", "/audit", { month: "2026-01" });
      assert.equal(audit.status, 429);
      assert.equal(audit.body.error, AI_LIMIT_MESSAGE.global);
      assert.equal(counter(ned.id, "ai_insight"), 0, "nada foi cobrado do Ned");

      assert.equal((await h.upload(oli, file("gl3", 2))).status, 200, "importar continua funcionando para todos");
      assert.equal(h.aiCalls() - start, 2);

      resetDay("*"); // no dia seguinte a cota volta
      assert.equal((await h.call(mia, "POST", "/transactions/categorize")).status, 200);
      assert.equal(h.aiCalls() - start, 3);
    } finally {
      h.setLimit("AI_GLOBAL_PER_DAY", undefined);
    }
  });
});

describe("códigos de login", () => {
  let ipSeed = 0;
  const send = (email: string) => h.authCall("/email-otp/send-verification-otp", { email, type: "sign-in" }, `198.51.100.${++ipSeed}`);

  test("por destinatário: 3 a cada 10 minutos, em qualquer caixa de letras, sem guardar o e-mail em claro", async () => {
    for (let i = 0; i < 3; i++) assert.equal((await send("vitima@example.test")).status, 200);
    assert.equal((await send("vitima@example.test")).status, 429);
    assert.equal((await send("VITIMA@Example.TEST")).status, 429, "maiúsculas não furam o limite");
    assert.equal((await send("outra@example.test")).status, 200, "outro endereço não é afetado");

    const keys = (h.db.prepare("select user_id from usage_counters").all() as { user_id: string }[]).map((r) => r.user_id);
    assert.ok(keys.some((k) => k.startsWith("email:")));
    assert.ok(!keys.some((k) => k.toLowerCase().includes("vitima")), "o e-mail não pode aparecer em claro");
  });

  test("por destinatário: também há um teto por dia, além da janela de 10 minutos", async () => {
    h.setLimit("OTP_PER_EMAIL_10MIN", 1000);
    h.setLimit("OTP_PER_EMAIL_PER_DAY", 2);
    try {
      assert.equal((await send("diario@example.test")).status, 200);
      assert.equal((await send("diario@example.test")).status, 200);
      assert.equal((await send("diario@example.test")).status, 429);
      assert.equal((await send("outro-dia@example.test")).status, 200, "outro endereço não é afetado");
    } finally {
      h.setLimit("OTP_PER_EMAIL_10MIN", undefined);
      h.setLimit("OTP_PER_EMAIL_PER_DAY", undefined);
    }
  });

  test("a resposta é igual para e-mail com conta e sem conta (sem enumeração)", async () => {
    await h.newUser("existente@example.test");
    const known = await send("existente@example.test");
    const unknown = await send("inexistente@example.test");
    assert.equal(known.status, 200);
    assert.deepEqual(known, unknown);
  });

  test("disjuntor global de e-mails: esgotado, ninguém recebe código", async () => {
    h.db.prepare("delete from usage_counters where user_id = '*' and kind = 'otp_global'").run();
    h.setLimit("OTP_GLOBAL_PER_DAY", 3);
    try {
      for (const email of ["g1@example.test", "g2@example.test", "g3@example.test"]) {
        assert.equal((await send(email)).status, 200);
      }
      assert.equal((await send("g4@example.test")).status, 429);
      const sentBefore = h.sentOtps.length;
      assert.equal((await send("g5@example.test")).status, 429);
      assert.equal(h.sentOtps.length, sentBefore, "nenhum e-mail foi enviado");
    } finally {
      h.setLimit("OTP_GLOBAL_PER_DAY", undefined);
    }
  });
});

describe("cadastro: teto de usuários e interruptor", () => {
  let ipSeed = 100;
  async function login(email: string, name?: string) {
    const ip = `192.0.2.${++ipSeed}`;
    const sent = await h.authCall("/email-otp/send-verification-otp", { email, type: "sign-in" }, ip);
    assert.equal(sent.status, 200, `pedir código: ${JSON.stringify(sent.body)}`);
    const otp = [...h.sentOtps].reverse().find((o) => o.to === email)?.otp;
    assert.ok(otp, "o código chegou ao mailer");
    // Só a tela de cadastro envia o nome; o login comum nunca cria conta.
    return h.authCall("/sign-in/email-otp", { email, otp, ...(name ? { name } : {}) }, ip);
  }
  const users = () => (h.db.prepare('select count(*) as n from "user"').get() as { n: number }).n;

  test("no teto, quem já tem conta entra e quem é novo é barrado", async () => {
    h.setLimit("MAX_USERS", users() + 1);
    try {
      assert.equal((await login("novo1@example.test", "Novo Um")).status, 200, "cabe mais um");
      const blocked = await login("novo2@example.test", "Novo Dois");
      assert.equal(blocked.status, 403);
      assert.equal(h.db.prepare('select count(*) as n from "user" where email = ?').get("novo2@example.test").n, 0, "a conta não foi criada");
      assert.equal((await login("novo1@example.test")).status, 200, "quem já tem conta continua entrando no teto");
    } finally {
      h.setLimit("MAX_USERS", 1000);
    }
  });

  test("SIGNUPS_ENABLED=false fecha cadastros novos sem afetar quem já tem conta", async () => {
    (env as Record<string, unknown>).SIGNUPS_ENABLED = "false";
    try {
      const blocked = await login("novo3@example.test", "Novo Tres");
      assert.equal(blocked.status, 403);
      assert.equal((await login("novo1@example.test")).status, 200);
    } finally {
      delete (env as Record<string, unknown>).SIGNUPS_ENABLED;
    }
    assert.equal((await login("novo3@example.test", "Novo Tres")).status, 200, "reaberto, o cadastro volta");
  });
});
