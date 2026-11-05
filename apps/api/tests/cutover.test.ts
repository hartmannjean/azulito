import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildCutoverSql } from "../scripts/cutover-owner.mjs";
import { startHarness, type Harness } from "./support/harness.ts";
import { USER_TABLES, buildWorld, snapshot, type World } from "./support/world.ts";

/**
 * A virada troca o user_id antigo do dono pelo do usuário novo. O SQL é gerado
 * por scripts/cutover-owner.mjs e roda uma única vez em produção, então ele é
 * testado aqui contra os dados reais de um cenário completo.
 */

let h: Harness;
let w: World;

before(async () => {
  h = await startHarness();
  w = await buildWorld(h);
});
after(() => h.close());

const DATA_TABLES = USER_TABLES.filter((t) => t !== "usage_counters");
const count = (table: string, id: string) => (h.db.prepare(`select count(*) as n from ${table} where user_id = ?`).get(id) as { n: number }).n;

describe("geração do SQL", () => {
  test("recusa ids que não parecem ids (nada de aspas ou SQL no meio)", () => {
    assert.throws(() => buildCutoverSql("abc", "def"), /inválido/);
    assert.throws(() => buildCutoverSql("a'; drop table transactions; --", "novoid1234"), /inválido/);
    assert.throws(() => buildCutoverSql("antigo12345", "novo 12345"), /inválido/);
    assert.throws(() => buildCutoverSql("mesmoid1234", "mesmoid1234"), /iguais/);
    assert.throws(() => buildCutoverSql(undefined as never, "novoid1234"), /inválido/);
  });

  test("cobre todas as tabelas de dados do usuário", () => {
    const sql = buildCutoverSql("antigo123456", "novo123456789");
    for (const table of DATA_TABLES) assert.ok(sql.includes(`update ${table} set user_id`), `faltou ${table}`);
  });
});

describe("virada do dono (Alice vira o 'usuário antigo' e o Carlos é o usuário novo)", () => {
  test("move TUDO para o id novo, sem sobrar nada no antigo, e não toca no Bob", async () => {
    const carlos = await h.newUser("carlos@example.test");
    const bobBefore = snapshot(h, w.bob.user.id);
    const before = Object.fromEntries(DATA_TABLES.map((t) => [t, count(t, w.alice.user.id)]));
    assert.ok(Object.values(before).reduce((a, b) => a + b, 0) > 30, "o cenário tem dados de verdade");

    h.db.exec(buildCutoverSql(w.alice.user.id, carlos.id));

    for (const table of DATA_TABLES) {
      assert.equal(count(table, w.alice.user.id), 0, `${table}: sobrou no id antigo`);
      assert.equal(count(table, carlos.id), before[table], `${table}: nem tudo foi para o id novo`);
    }
    assert.equal(count("usage_counters", w.alice.user.id), 0);
    assert.equal(snapshot(h, w.bob.user.id), bobBefore, "o Bob não pode mudar");

    // Os dados continuam coerentes: cada linha aponta para uma conta do mesmo dono.
    for (const [table, column] of [["transactions", "account_id"], ["imports", "account_id"]] as const) {
      const crossed = h.db.prepare(`select count(*) as n from ${table} t join accounts a on a.id = t.${column} where t.user_id != a.user_id`).get() as { n: number };
      assert.equal(crossed.n, 0, `${table}.${column} ficou apontando para conta de outro dono`);
    }

    // E o usuário novo enxerga tudo pela api, inclusive o arquivo original guardado sob o prefixo ANTIGO no R2.
    const list = await h.call(carlos, "GET", "/transactions?limit=200");
    assert.ok(JSON.stringify(list.body).includes("SEGREDO-A"));
    const imports = (await h.call(carlos, "GET", "/imports")).body.imports as { id: string; has_file: boolean }[];
    assert.ok(imports.length > 0);
    const detail = await h.call(carlos, "GET", `/imports/${imports[0]!.id}`);
    assert.equal(detail.status, 200, "o arquivo antigo no R2 ainda abre depois da virada");
  });

  test("a trava aborta, sem mover nada, se o usuário novo já tem dados", async () => {
    const before = snapshot(h, w.bob.user.id);
    // O Bob já tem dados: tentar mover algo para ele tem que falhar na trava.
    assert.throws(() => h.db.exec(buildCutoverSql("antigo-qualquer-12", w.bob.user.id)), /integer overflow/i);
    assert.equal(snapshot(h, w.bob.user.id), before);
  });
});
