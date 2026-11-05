import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { EFFECTIVE_MONTH } from "../src/lib/refmonth.ts";
import { buildOfx, startHarness, type Harness } from "./support/harness.ts";
import { READS, USER_TABLES, buildWorld, markersOf, rowsOf, snapshot, type Seed } from "./support/world.ts";

/**
 * Isolamento entre usuários. Sem RLS no D1, o `user_id` em cada query é a
 * única barreira; estes testes rodam a api REAL (requireAuth + Better Auth +
 * SQL das rotas) com duas contas e provam que uma não enxerga nem altera
 * nada da outra, por qualquer rota. A checagem de agregações fica em
 * isolation-differential.test.ts.
 */

let h: Harness;
let alice: Seed;
let bob: Seed;

const SHARED_OFX = buildOfx({
  kind: "checking",
  account: "999-9",
  txs: [
    { fitid: "shared1", date: "2026-01-05", amount: -12.34, memo: "Padaria Comum" },
    { fitid: "shared2", date: "2026-01-06", amount: -56.78, memo: "Farmacia Comum" },
  ],
});

before(async () => {
  h = await startHarness();
  ({ alice, bob } = await buildWorld(h));
});
after(() => h.close());

describe("importação do mesmo arquivo por dois usuários", () => {
  test("cada um importa tudo, sem 'duplicata' contra o outro", async () => {
    const a = await h.upload(alice.user, SHARED_OFX, "comum.ofx");
    const b = await h.upload(bob.user, SHARED_OFX, "comum.ofx");
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(b.status, 200, JSON.stringify(b.body));
    assert.equal(a.body.imported, 2);
    assert.equal(b.body.imported, 2, "o arquivo do Bob não pode ser tratado como duplicata do da Alice");
    assert.equal(b.body.duplicates, 0);
  });

  test("cada um tem sua própria cópia no R2, sempre sob o prefixo do dono", () => {
    const keys = [...h.bucket.keys()];
    assert.ok(keys.length > 0);
    for (const key of keys) {
      assert.ok(key.startsWith(`${alice.user.id}/`) || key.startsWith(`${bob.user.id}/`), `chave sem prefixo de usuário: ${key}`);
    }
    assert.ok(keys.some((k) => k.startsWith(`${alice.user.id}/`)) && keys.some((k) => k.startsWith(`${bob.user.id}/`)));
  });
});

describe("leitura: um usuário nunca vê dados do outro", () => {
  for (const [viewerTag, otherTag] of [["A", "B"], ["B", "A"]] as const) {
    const viewer = () => (viewerTag === "A" ? alice : bob);
    const other = () => (otherTag === "A" ? alice : bob);
    for (const path of READS) {
      test(`${viewerTag} lendo ${path} não contém nada de ${otherTag}`, async () => {
        const res = await h.call(viewer().user, "GET", path);
        assert.ok(res.status < 500, `status ${res.status}`);
        const text = JSON.stringify(res.body);
        for (const marker of markersOf(other())) {
          assert.ok(!text.includes(marker), `vazou "${marker}" em ${path}`);
        }
      });
    }
  }

  test("controle positivo: cada um enxerga os PRÓPRIOS dados (o teste não é vazio)", async () => {
    const a = JSON.stringify((await h.call(alice.user, "GET", "/transactions?limit=200")).body);
    const b = JSON.stringify((await h.call(bob.user, "GET", "/transactions?limit=200")).body);
    assert.ok(a.includes("SEGREDO-A") && !a.includes("SEGREDO-B"));
    assert.ok(b.includes("SEGREDO-B") && !b.includes("SEGREDO-A"));
    assert.ok(JSON.stringify((await h.call(alice.user, "GET", "/savings")).body).includes("1111.11"));
    assert.ok(JSON.stringify((await h.call(alice.user, "GET", "/budgets")).body).includes("501.11"));
    // Dados recentes: se estas respostas viessem vazias, os testes de vazamento delas seriam cegos.
    assert.ok(JSON.stringify((await h.call(alice.user, "GET", "/recurring")).body).includes("29.91"), "recorrência vazia");
    assert.ok(JSON.stringify((await h.call(bob.user, "GET", "/recurring")).body).includes("49.92"), "recorrência vazia");
    const card = JSON.stringify((await h.call(alice.user, "GET", "/card/comparison")).body);
    assert.ok(card.includes("88.81") || card.includes("14.41"), `comparação do cartão vazia: ${card.slice(0, 200)}`);
  });

  test("totais e somas de cada usuário batem com os dados dele no banco", async () => {
    for (const s of [alice, bob]) {
      const expected = h.db
        .prepare(
          "select count(*) as n, coalesce(sum(case when amount > 0 then amount end), 0) as income, coalesce(sum(case when amount < 0 then -amount end), 0) as expenses from transactions where user_id = ? and excluded = 0",
        )
        .get(s.user.id) as { n: number; income: number; expenses: number };
      const res = await h.call(s.user, "GET", "/transactions?limit=200");
      assert.equal(res.body.total, expected.n, `total de ${s.tag}`);
      assert.ok(Math.abs(res.body.totals.income - expected.income) < 0.01, `receitas de ${s.tag}`);
      assert.ok(Math.abs(res.body.totals.expenses - expected.expenses) < 0.01, `despesas de ${s.tag}`);

      const month = (await h.call(s.user, "GET", "/transactions/summary?month=2026-01")).body;
      const inMonth = h.db
        .prepare(
          `select coalesce(sum(case when t.amount > 0 then t.amount end), 0) as income, coalesce(sum(case when t.amount < 0 then -t.amount end), 0) as expenses from transactions t join accounts a on a.id = t.account_id where t.user_id = ? and t.excluded = 0 and ${EFFECTIVE_MONTH} = '2026-01'`,
        )
        .get(s.user.id) as { income: number; expenses: number };
      assert.ok(Math.abs(month.income - inMonth.income) < 0.01, `receita do mês de ${s.tag}`);
      assert.ok(Math.abs(month.expenses - inMonth.expenses) < 0.01, `despesa do mês de ${s.tag}`);
    }
  });

  test("user_id enviado pelo cliente (query, header, corpo) é ignorado", async () => {
    const viaQuery = await h.call(bob.user, "GET", `/transactions?limit=200&user_id=${alice.user.id}`);
    assert.ok(!JSON.stringify(viaQuery.body).includes("SEGREDO-A"));

    const before = snapshot(h, alice.user.id);
    const res = await fetch(`${h.baseUrl}/budgets?user_id=${alice.user.id}`, {
      method: "PUT",
      headers: { cookie: bob.user.cookie, "content-type": "application/json", "x-user-id": alice.user.id },
      body: JSON.stringify({ category: "Healthcare", monthly_limit: 1, user_id: alice.user.id, userId: alice.user.id }),
    });
    assert.ok(res.status === 200 || res.status === 201);
    assert.equal(snapshot(h, alice.user.id), before, "a escrita do Bob não pode cair na conta da Alice");
    const mine = h.db.prepare("select user_id from budgets where category = 'Healthcare'").all() as { user_id: string }[];
    assert.deepEqual(mine.map((r) => r.user_id), [bob.user.id]);
  });
});

describe("escrita: o Bob ataca os recursos da Alice usando os ids dela", () => {
  const A = () => alice.ids;
  const attacks: { name: string; method: string; path: () => string; body?: () => unknown; expect?: number[] }[] = [
    { name: "alterar categoria de transação", method: "PATCH", path: () => `/transactions/${A().transactions![0]}`, body: () => ({ category: "Healthcare" }), expect: [404] },
    { name: "mês de referência em transações", method: "POST", path: () => "/transactions/reference-month", body: () => ({ ids: A().transactions, month: "2026-05" }), expect: [200] },
    { name: "ciclo de cartão (última conta dela)", method: "PATCH", path: () => `/accounts/${A().accounts![A().accounts!.length - 1]}`, body: () => ({ closing_day: 9, due_day: 19 }), expect: [404] },
    { name: "ciclo de cartão (primeira conta dela)", method: "PATCH", path: () => `/accounts/${A().accounts![0]}`, body: () => ({ closing_day: 9, due_day: 19 }), expect: [404] },
    { name: "detalhes de importação", method: "GET", path: () => `/imports/${A().imports![0]}`, expect: [404] },
    { name: "renomear categoria própria dela", method: "PATCH", path: () => `/categories/${A().user_categories![0]}`, body: () => ({ name: "Invadida" }), expect: [404] },
    { name: "apagar categoria própria dela", method: "DELETE", path: () => `/categories/${A().user_categories![0]}`, expect: [404] },
    { name: "marcar boleto dela como pago", method: "PATCH", path: () => `/scheduled/${A().scheduled_items![0]}`, body: () => ({ paid: true }), expect: [404] },
    { name: "apagar boleto dela", method: "DELETE", path: () => `/scheduled/${A().scheduled_items![0]}`, expect: [404] },
    { name: "desfazer ação dela", method: "POST", path: () => `/history/${A().action_log![0]}/undo`, expect: [404] },
    { name: "apagar orçamento da categoria dela", method: "DELETE", path: () => "/budgets/Groceries", expect: [200] },
    { name: "apagar sugestão de orçamento dela", method: "DELETE", path: () => "/budgets/suggestions/Groceries", expect: [200, 404] },
    { name: "apagar saldo guardado dela", method: "DELETE", path: () => "/savings/2026-01", expect: [200, 404] },
  ];

  let before = "";

  test("estado da Alice antes dos ataques", () => {
    before = snapshot(h, alice.user.id);
    assert.ok(before.length > 100);
  });

  for (const attack of attacks) {
    test(`Bob: ${attack.name}`, async () => {
      const res = await h.call(bob.user, attack.method, attack.path(), attack.body?.());
      assert.ok(res.status < 500, `erro interno ${res.status}: ${JSON.stringify(res.body)}`);
      if (attack.expect) assert.ok(attack.expect.includes(res.status), `status ${res.status}, esperado ${attack.expect}`);
      assert.equal(snapshot(h, alice.user.id), before, "a conta da Alice mudou");
    });
  }

  test("depois de todos os ataques, a conta da Alice está byte a byte igual", () => {
    assert.equal(snapshot(h, alice.user.id), before);
  });

  test("nada da Alice foi parar dentro das linhas do Bob (nem em log de desfazer)", () => {
    const bobRows = JSON.stringify(Object.fromEntries(USER_TABLES.map((t) => [t, rowsOf(h, t, bob.user.id)])));
    for (const marker of markersOf(alice)) {
      assert.ok(!bobRows.includes(marker), `dado da Alice ("${marker}") gravado em linha do Bob`);
    }
  });

  test("todo dado pertence a um dos dois usuários, e cada linha aponta para recursos do próprio dono", () => {
    // usage_counters também guarda chaves de sistema ("*" e "email:..."), que não são de nenhum usuário.
    for (const table of USER_TABLES.filter((name) => name !== "usage_counters")) {
      const strangers = h.db
        .prepare(`select count(*) as n from ${table} where user_id not in (?, ?)`)
        .get(alice.user.id, bob.user.id) as { n: number };
      assert.equal(strangers.n, 0, `${table} tem linhas de outro dono`);
    }
    for (const [table, column] of [["transactions", "account_id"], ["imports", "account_id"]] as const) {
      const crossed = h.db
        .prepare(`select count(*) as n from ${table} t join accounts a on a.id = t.${column} where t.user_id != a.user_id`)
        .get() as { n: number };
      assert.equal(crossed.n, 0, `${table}.${column} aponta para conta de outro usuário`);
    }
  });
});

describe("autenticação: só entra quem tem sessão válida", () => {
  test("sem cookie, cookie falso ou assinatura adulterada → 401", async () => {
    assert.equal((await h.call(null, "GET", "/transactions")).status, 401);
    assert.equal((await h.call({ id: "x", email: "x", cookie: "azulito.session_token=abc.def" }, "GET", "/transactions")).status, 401);

    const cookie = alice.user.cookie;
    const tampered = cookie.slice(0, -4) + (cookie.endsWith("AAAA") ? "BBBB" : "AAAA");
    assert.equal((await h.call({ ...alice.user, cookie: tampered }, "GET", "/transactions")).status, 401);
  });

  test("a sessão de um usuário nunca resolve para o outro", async () => {
    const res = await h.call(bob.user, "GET", "/me");
    assert.equal(res.body.id, bob.user.id);
    assert.notEqual(res.body.id, alice.user.id);
  });

  test("sessão revogada ou expirada → 401 na hora", async () => {
    const carol = await h.newUser("carol@example.test");
    assert.equal((await h.call(carol, "GET", "/me")).status, 200);
    h.db.prepare("update session set expiresAt = ? where userId = ?").run(new Date(Date.now() - 1000).toISOString(), carol.id);
    assert.equal((await h.call(carol, "GET", "/me")).status, 401, "sessão expirada");

    const dave = await h.newUser("dave@example.test");
    assert.equal((await h.call(dave, "GET", "/me")).status, 200);
    h.db.prepare("delete from session where userId = ?").run(dave.id);
    assert.equal((await h.call(dave, "GET", "/me")).status, 401, "sessão revogada");
  });

  test("e-mail não verificado → 401, mesmo com sessão", async () => {
    const erin = await h.newUser("erin@example.test", { verified: false });
    assert.equal((await h.call(erin, "GET", "/me")).status, 401);
    assert.equal((await h.call(erin, "GET", "/transactions")).status, 401);
  });

  test("toda rota de dados exige sessão", async () => {
    for (const path of READS) {
      assert.equal((await h.call(null, "GET", path)).status, 401, path);
    }
    for (const [method, path] of [["POST", "/imports"], ["POST", "/categories"], ["PUT", "/budgets"], ["PUT", "/savings"], ["POST", "/scheduled"], ["POST", "/transactions/categorize"], ["POST", "/audit"], ["POST", "/budgets/suggestions"], ["POST", "/savings/insight"], ["POST", "/recurring/insight"]] as const) {
      assert.equal((await h.call(null, method, path, {})).status, 401, `${method} ${path}`);
    }
  });
});
