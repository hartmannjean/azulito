import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildOfx, startHarness, type Harness, type TestUser } from "./support/harness.ts";

/**
 * Preferências financeiras (salário e ciclo do cartão): validação, isolamento,
 * efeito no importador (cartão) e na previsão (salário como receita esperada).
 */

let h: Harness;
before(async () => {
  h = await startHarness();
});
after(() => h.close());

const EMPTY = { salary_amount: null, salary_day: null, card_closing_day: null, card_due_day: null };
const NONE = { ...EMPTY };

let counter = 0;
const newUser = () => h.newUser(`pessoa${++counter}@example.test`);
const put = (user: TestUser | null, body: unknown, path = "/settings") => h.call(user, "PUT", path, body);
const month = (offset: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1)).toISOString().slice(0, 7);
};
const cardOf = (user: TestUser) => {
  const row = h.db.prepare("select closing_day, due_day from accounts where user_id = ? and kind = 'credit_card'").get(user.id);
  // O node:sqlite devolve objetos sem protótipo; copiar para um objeto comum permite o deepEqual.
  return row ? ({ ...row } as { closing_day: number | null; due_day: number | null }) : undefined;
};

describe("preferências", () => {
  test("usuário novo: tudo vazio e ainda sem responder", async () => {
    const u = await newUser();
    const res = await h.call(u, "GET", "/settings");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.settings, { ...EMPTY, onboarded: false });
  });

  test("salva e devolve o que foi salvo, com o salário em duas casas e já respondido", async () => {
    const u = await newUser();
    const res = await put(u, { salary_amount: 5432.109, salary_day: 5, card_closing_day: 11, card_due_day: 25 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.settings, { salary_amount: 5432.11, salary_day: 5, card_closing_day: 11, card_due_day: 25, onboarded: true });
    assert.deepEqual((await h.call(u, "GET", "/settings")).body.settings, res.body.settings);
  });

  test("tudo opcional: salvar só o cartão, só o salário ou nada", async () => {
    const a = await newUser();
    const onlyCard = await put(a, { ...NONE, card_closing_day: 2, card_due_day: 9 });
    assert.equal(onlyCard.status, 200);
    assert.equal(onlyCard.body.settings.salary_amount, null, "sem salário informado continua null (não vira 0)");
    assert.equal(onlyCard.body.settings.salary_day, null);
    const b = await newUser();
    const onlySalary = await put(b, { ...NONE, salary_amount: 3000, salary_day: 1 });
    assert.equal(onlySalary.status, 200);
    assert.equal(onlySalary.body.settings.card_closing_day, null);
    assert.equal(onlySalary.body.settings.card_due_day, null);
    const c = await newUser();
    const empty = await put(c, NONE);
    assert.equal(empty.status, 200);
    assert.equal(empty.body.settings.onboarded, true);
  });

  test("salário zero vale como não informado (e esquece o dia)", async () => {
    const u = await newUser();
    const res = await put(u, { ...NONE, salary_amount: 0, salary_day: 5 });
    assert.equal(res.status, 200);
    assert.equal(res.body.settings.salary_amount, null);
    assert.equal(res.body.settings.salary_day, null);
  });

  test("dados inválidos são recusados (400) e nada muda", async () => {
    const u = await newUser();
    assert.equal((await put(u, { ...NONE, salary_amount: 4000, salary_day: 10 })).status, 200);
    const before = (await h.call(u, "GET", "/settings")).body;

    const invalid: unknown[] = [
      { ...NONE, salary_amount: 5000 }, // salário sem o dia
      { ...NONE, salary_amount: -1, salary_day: 5 },
      { ...NONE, salary_amount: 10_000_001, salary_day: 5 },
      { ...NONE, salary_amount: "5000", salary_day: 5 },
      { ...NONE, salary_amount: 5000, salary_day: 0 },
      { ...NONE, salary_amount: 5000, salary_day: 32 },
      { ...NONE, salary_amount: 5000, salary_day: 1.5 },
      { ...NONE, card_closing_day: 11 }, // fechamento sem vencimento
      { ...NONE, card_due_day: 25 },
      { ...NONE, card_closing_day: 0, card_due_day: 5 },
      { ...NONE, card_closing_day: 5, card_due_day: 40 },
      { ...NONE, user_id: "outra-pessoa" }, // campo desconhecido
      { salary_amount: 5000 }, // faltam campos
      {},
      null,
      "texto",
    ];
    for (const body of invalid) {
      assert.equal((await put(u, body)).status, 400, JSON.stringify(body));
    }
    assert.deepEqual((await h.call(u, "GET", "/settings")).body, before, "as preferências não podem ter mudado");
  });

  test("pular não apaga o que já foi salvo, e marca como respondido", async () => {
    const saved = await newUser();
    await put(saved, { ...NONE, salary_amount: 6000, salary_day: 7 });
    const skip = await h.call(saved, "POST", "/settings/skip");
    assert.equal(skip.status, 200);
    assert.equal(skip.body.settings.salary_amount, 6000);

    const fresh = await newUser();
    const res = await h.call(fresh, "POST", "/settings/skip");
    assert.deepEqual(res.body.settings, { ...EMPTY, onboarded: true });
  });

  test("exige sessão", async () => {
    assert.equal((await h.call(null, "GET", "/settings")).status, 401);
    assert.equal((await put(null, NONE)).status, 401);
    assert.equal((await h.call(null, "POST", "/settings/skip")).status, 401);
  });

  test("um usuário nunca altera as preferências de outro, nem mandando o id dele", async () => {
    const alice = await newUser();
    const bob = await newUser();
    await put(alice, { ...NONE, salary_amount: 1111, salary_day: 1 });
    await put(bob, { ...NONE, salary_amount: 2222, salary_day: 2 });

    const res = await fetch(`${h.baseUrl}/settings?user_id=${alice.id}`, {
      method: "PUT",
      headers: { cookie: bob.cookie, "content-type": "application/json", "x-user-id": alice.id },
      body: JSON.stringify({ ...NONE, salary_amount: 9999, salary_day: 9 }),
    });
    assert.equal(res.status, 200);
    assert.equal((await h.call(alice, "GET", "/settings")).body.settings.salary_amount, 1111, "a Alice não pode mudar");
    assert.equal((await h.call(bob, "GET", "/settings")).body.settings.salary_amount, 9999);
  });
});

describe("cartão", () => {
  const cardOfx = (account: string) =>
    buildOfx({ kind: "credit_card", account, txs: [{ fitid: `${account}1`, date: `${month(-1)}-10`, amount: -50, memo: "Compra" }] });

  test("sem preferência, o fechamento vem do OFX e o vencimento é estimado", async () => {
    const u = await newUser();
    assert.equal((await h.upload(u, cardOfx("c-ofx"))).status, 200);
    assert.deepEqual(cardOf(u), { closing_day: 31, due_day: 10 });
  });

  test("o fechamento e o vencimento informados valem para o cartão importado depois", async () => {
    const u = await newUser();
    await put(u, { ...NONE, card_closing_day: 11, card_due_day: 25 });
    assert.equal((await h.upload(u, cardOfx("c-pref"))).status, 200);
    assert.deepEqual(cardOf(u), { closing_day: 11, due_day: 25 });
  });

  test("mudar a preferência não sobrescreve o ciclo de um cartão que já existe", async () => {
    const u = await newUser();
    await h.upload(u, cardOfx("c-keep"));
    assert.deepEqual(cardOf(u), { closing_day: 31, due_day: 10 });
    await put(u, { ...NONE, card_closing_day: 11, card_due_day: 25 });
    assert.deepEqual(cardOf(u), { closing_day: 31, due_day: 10 }, "o ciclo existente não muda");
  });

  test("mas preenche um cartão que está sem ciclo", async () => {
    const u = await newUser();
    await h.upload(u, cardOfx("c-null"));
    h.db.prepare("update accounts set closing_day = null, due_day = null where user_id = ?").run(u.id);
    await put(u, { ...NONE, card_closing_day: 11, card_due_day: 25 });
    assert.deepEqual(cardOf(u), { closing_day: 11, due_day: 25 });
  });

  test("a preferência de um usuário não vai para o cartão de outro", async () => {
    const a = await newUser();
    const b = await newUser();
    await h.upload(b, cardOfx("c-iso"));
    assert.deepEqual(cardOf(b), { closing_day: 31, due_day: 10 }, "b importa sem preferência: vem do OFX");
    // Um cartão do B SEM ciclo seria preenchido por uma preferência que não é dele.
    h.db.prepare("update accounts set closing_day = null, due_day = null where user_id = ?").run(b.id);
    await put(a, { ...NONE, card_closing_day: 3, card_due_day: 12 });
    assert.deepEqual(cardOf(b), { closing_day: null, due_day: null }, "a preferência da A não pode chegar ao cartão do B");

    // E o cartão que o B importar depois usa as preferências DELE (nenhuma), não as da A.
    await h.upload(b, buildOfx({ kind: "credit_card", account: "c-iso2", txs: [{ fitid: "x1", date: `${month(-1)}-10`, amount: -20, memo: "Outra compra" }] }));
    const second = h.db.prepare("select closing_day, due_day from accounts where user_id = ? and account_id = 'c-iso2'").get(b.id);
    assert.deepEqual({ ...second }, { closing_day: 31, due_day: 10 });
  });
});

describe("previsão com salário", () => {
  const forecast = async (u: TestUser) => (await h.call(u, "GET", "/forecast")).body;

  test("sem salário informado, não há receita esperada nem salário na resposta", async () => {
    const u = await newUser();
    const f = await forecast(u);
    assert.equal(f.salary, null);
    for (const m of f.months) assert.equal(m.income.recurring, 0);
  });

  test("com salário, ele entra como receita esperada em cada mês até cair", async () => {
    const u = await newUser();
    await put(u, { ...NONE, salary_amount: 5000, salary_day: 5 });
    const f = await forecast(u);
    assert.deepEqual(f.salary, { amount: 5000, day: 5 });
    assert.equal(f.months.length, 3);
    for (const m of f.months) {
      assert.equal(m.income.recurring, 5000, m.month);
      assert.equal(m.income.projected, 5000, m.month);
    }
    assert.equal(f.months[0].month, month(0));
  });

  test("quando o salário cai no mês, deixa de ser pendente nele e continua previsto nos próximos", async () => {
    const u = await newUser();
    await put(u, { ...NONE, salary_amount: 5000, salary_day: 1 });
    const credit = buildOfx({
      kind: "checking",
      account: "sal-acc",
      txs: [{ fitid: "s1", date: `${month(0)}-01`, amount: 5000, memo: "SALARIO EMPRESA" }],
    });
    assert.equal((await h.upload(u, credit)).status, 200);
    const f = await forecast(u);
    assert.equal(f.months[0].income.received, 5000);
    assert.equal(f.months[0].income.recurring, 0, "já caiu: não conta de novo");
    assert.equal(f.months[0].income.projected, 5000, "sem duplicar");
    assert.equal(f.months[1].income.recurring, 5000, "o mês que vem volta a ser previsto");
  });

  test("uma entrada cadastrada à mão com o mesmo valor não duplica o salário", async () => {
    const u = await newUser();
    await put(u, { ...NONE, salary_amount: 5000, salary_day: 5 });
    const created = await h.call(u, "POST", "/scheduled", {
      kind: "income",
      description: "Salário",
      amount: 5000,
      due_date: `${month(1)}-05`,
      category: null,
    });
    assert.ok(created.status < 300, JSON.stringify(created.body));
    const f = await forecast(u);
    assert.equal(f.months[1].income.scheduled, 5000);
    assert.equal(f.months[1].income.recurring, 0, "o item cadastrado já cobre o salário");
    assert.equal(f.months[1].income.projected, 5000);
    assert.equal(f.months[2].income.recurring, 5000, "nos outros meses o salário segue previsto");
  });

  test("uma recorrente detectada com valor parecido é o próprio salário, não uma segunda entrada", async () => {
    const history = buildOfx({
      kind: "checking",
      account: "rec-acc",
      txs: [0, 1, 2, 3].map((back) => ({ fitid: `r${back}`, date: `${month(-back)}-01`, amount: 5000, memo: "SALARIO EMPRESA" })),
    });

    const detectedOnly = await newUser();
    await h.upload(detectedOnly, history);
    const base = await forecast(detectedOnly);
    assert.equal(base.months[1].income.recurring, 5000, "só detectada: aparece uma vez");

    const withSalary = await newUser();
    await h.upload(withSalary, history);
    await put(withSalary, { ...NONE, salary_amount: 5000, salary_day: 1 });
    const f = await forecast(withSalary);
    assert.equal(f.months[1].income.recurring, 5000, "detectada + salário informado = uma entrada só");
  });

  test("uma recorrente de valor bem diferente do salário continua contando à parte", async () => {
    const u = await newUser();
    const history = buildOfx({
      kind: "checking",
      account: "alug-acc",
      txs: [0, 1, 2, 3].map((back) => ({ fitid: `a${back}`, date: `${month(-back)}-01`, amount: 1200, memo: "ALUGUEL RECEBIDO" })),
    });
    await h.upload(u, history);
    await put(u, { ...NONE, salary_amount: 5000, salary_day: 5 });
    const f = await forecast(u);
    assert.equal(f.months[1].income.recurring, 6200, "salário 5000 + aluguel 1200");
  });

  test("a previsão de um usuário nunca usa o salário de outro", async () => {
    const a = await newUser();
    const b = await newUser();
    await put(a, { ...NONE, salary_amount: 7000, salary_day: 5 });
    const f = await forecast(b);
    assert.equal(f.salary, null);
    for (const m of f.months) assert.equal(m.income.recurring, 0);
  });
});
