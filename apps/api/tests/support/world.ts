import assert from "node:assert/strict";
import { buildOfx, type Harness, type TestUser } from "./harness.ts";

// Tabelas com dados de usuário (mesma lista do verificador estático), em ordem
// que respeita as chaves estrangeiras para apagar.
export const USER_TABLES = [
  "usage_counters",
  "user_settings",
  "action_log",
  "ai_insights",
  "scheduled_items",
  "savings_snapshots",
  "budgets",
  "merchant_rules",
  "user_categories",
  "transactions",
  "imports",
  "accounts",
];

export type Seed = {
  user: TestUser;
  tag: string;
  ids: Record<string, string[]>;
  /** Valores únicos deste usuário: se aparecerem na resposta do outro, houve vazamento. */
  values: string[];
};

export type World = { alice: Seed; bob: Seed };

export function must(res: { status: number; body: unknown }, what: string): void {
  assert.ok(res.status >= 200 && res.status < 300, `${what}: status ${res.status} ${JSON.stringify(res.body)}`);
}

export function rowsOf(h: Harness, table: string, userId: string): Record<string, unknown>[] {
  return h.db.prepare(`select * from ${table} where user_id = ? order by 1, 2`).all(userId) as Record<string, unknown>[];
}

export function snapshot(h: Harness, userId: string): string {
  return JSON.stringify(Object.fromEntries(USER_TABLES.map((t) => [t, rowsOf(h, t, userId)])));
}

type SeedOptions = {
  budgetCategory: string;
  month: string;
  limit: number;
  balance: number;
  salary: number;
  /** Salário informado nas preferências (aparece em /settings e na previsão). */
  declaredSalary: number;
};

async function seed(h: Harness, user: TestUser, tag: string, opts: SeedOptions): Promise<Seed> {
  const secretAmount = tag === "A" ? 777.77 : 333.33;

  const checking = await h.upload(
    user,
    buildOfx({
      kind: "checking",
      account: `${tag}-111`,
      txs: [
        { fitid: `${tag}1`, date: "2026-01-10", amount: -secretAmount, memo: `SEGREDO-${tag} mercado` },
        { fitid: `${tag}2`, date: "2026-01-12", amount: opts.salary, memo: `SEGREDO-${tag} salario` },
      ],
    }),
    `SEGREDO-${tag}.ofx`,
  );
  must(checking, "importar conta corrente");

  const card = await h.upload(
    user,
    buildOfx({
      kind: "credit_card",
      account: `${tag}-CARD`,
      txs: [{ fitid: `${tag}c1`, date: "2026-01-15", amount: -45.9, memo: `SEGREDO-${tag} cartao` }],
    }),
  );
  must(card, "importar cartão");

  // Dados RECENTES (relativos a hoje): previsão, comparação de cartão e
  // recorrência só mostram transações dentro de janelas de tempo recentes.
  const now = new Date();
  const month = (offset: number) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1)).toISOString().slice(0, 7);
  const recurringAmount = tag === "A" ? 29.91 : 49.92;
  const cardPrevious = tag === "A" ? 88.81 : 66.62;
  const cardCurrent = tag === "A" ? 14.41 : 22.22;

  must(
    await h.upload(
      user,
      buildOfx({
        kind: "checking",
        account: `${tag}-111`,
        txs: [0, 1, 2, 3].map((back) => ({
          fitid: `${tag}rec${back}`,
          date: `${month(-back)}-01`,
          amount: -recurringAmount,
          memo: `SEGREDO-${tag} assinatura`,
        })),
      }),
    ),
    "importar assinatura recorrente",
  );
  must(
    await h.upload(
      user,
      buildOfx({
        kind: "credit_card",
        account: `${tag}-CARD`,
        txs: [
          { fitid: `${tag}cp`, date: `${month(-1)}-10`, amount: -cardPrevious, memo: `SEGREDO-${tag} fatura anterior` },
          { fitid: `${tag}cn`, date: `${month(0)}-01`, amount: -cardCurrent, memo: `SEGREDO-${tag} fatura atual` },
        ],
      }),
    ),
    "importar compras recentes do cartão",
  );

  must(await h.call(user, "POST", "/categories", { name: `Cat${tag}` }), "criar categoria");
  must(await h.call(user, "PUT", "/budgets", { category: opts.budgetCategory, monthly_limit: opts.limit }), "criar orçamento");
  must(await h.call(user, "PUT", "/savings", { month: opts.month, balance: opts.balance }), "guardar saldo");
  must(
    await h.call(user, "POST", "/scheduled", {
      kind: "expense",
      description: `SEGREDO-${tag} boleto`,
      amount: 99,
      due_date: "2026-12-01",
      category: null,
    }),
    "criar boleto",
  );

  // Uma correção de categoria cria regra, linha no histórico e desfazer.
  const firstTx = (h.db.prepare("select id from transactions where user_id = ? and description like ?").get(user.id, `SEGREDO-${tag} mercado%`) as { id: string }).id;
  must(await h.call(user, "PATCH", `/transactions/${firstTx}`, { category: "Groceries" }), "corrigir categoria");

  must(
    await h.call(user, "PUT", "/settings", {
      salary_amount: opts.declaredSalary,
      salary_day: tag === "A" ? 5 : 6,
      card_closing_day: tag === "A" ? 11 : 12,
      card_due_day: tag === "A" ? 18 : 19,
    }),
    "salvar preferências",
  );

  for (const kind of ["savings", "budget", "recurring"]) {
    h.db
      .prepare("insert into ai_insights (user_id, kind, content, created_at) values (?, ?, ?, ?)")
      .run(user.id, kind, `SEGREDO-${tag}-insight`, new Date().toISOString());
  }

  const ids: Record<string, string[]> = {};
  for (const table of ["transactions", "accounts", "imports", "user_categories", "action_log", "scheduled_items"]) {
    ids[table] = rowsOf(h, table, user.id).map((r) => String(r.id));
  }
  return {
    user,
    tag,
    ids,
    values: [secretAmount, opts.limit, opts.balance, opts.salary, opts.declaredSalary, recurringAmount, cardPrevious, cardCurrent].map(String),
  };
}

/** Duas contas reais com dados distintos em todas as tabelas. */
export async function buildWorld(h: Harness): Promise<World> {
  const a = await h.newUser("alice@example.test");
  const b = await h.newUser("bob@example.test");
  return {
    alice: await seed(h, a, "A", { budgetCategory: "Groceries", month: "2026-01", limit: 501.11, balance: 1111.11, salary: 1000.55, declaredSalary: 7777.77 }),
    bob: await seed(h, b, "B", { budgetCategory: "Housing", month: "2026-02", limit: 602.22, balance: 2222.22, salary: 2000.66, declaredSalary: 8888.88 }),
  };
}

/** Tudo que identifica os dados de um usuário: ids, valores, textos secretos e a identidade dele. */
export function markersOf(seed: Seed): string[] {
  return [
    ...Object.values(seed.ids).flat(),
    ...seed.values,
    seed.user.id,
    seed.user.email,
    `SEGREDO-${seed.tag}`,
    `Cat${seed.tag}`,
    `${seed.tag}-111`,
    `${seed.tag}-CARD`,
  ];
}

/** Todas as leituras (GET) da api que devolvem dados do usuário. */
export const READS = [
  "/me",
  "/settings",
  "/transactions?limit=200",
  "/transactions?limit=200&q=SEGREDO",
  "/transactions/summary?month=2026-01",
  "/transactions/categories?month=2026-01",
  "/transactions/trend?months=12",
  "/accounts",
  "/imports",
  "/budgets",
  "/budgets/progress?month=2026-01",
  "/budgets/suggestions",
  "/recurring",
  "/categories",
  "/savings",
  "/history?limit=30",
  "/audit",
  "/forecast",
  "/card/comparison",
];
