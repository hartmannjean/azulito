import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { env } from "cloudflare:workers";
import { buildOfx, startHarness, type Harness } from "./support/harness.ts";
import { USER_TABLES, buildWorld, markersOf, rowsOf, snapshot, type World } from "./support/world.ts";

/**
 * Exportação e exclusão de conta (LGPD). A exclusão apaga TUDO do usuário (D1 e
 * R2) e não toca em nada de ninguém mais; a exportação só traz dados dele.
 */

let h: Harness;
let w: World;

before(async () => {
  h = await startHarness();
  w = await buildWorld(h);
});
after(() => h.close());

const userRows = (id: string) => h.db.prepare('select count(*) as n from "user" where id = ?').get(id) as { n: number };
const tableCount = (table: string, id: string) => (h.db.prepare(`select count(*) as n from ${table} where user_id = ?`).get(id) as { n: number }).n;

describe("exportação", () => {
  test("traz os dados do próprio usuário, completos, e nada do outro", async () => {
    const res = await h.call(w.alice.user, "GET", "/account/export");
    assert.equal(res.status, 200);
    const text = JSON.stringify(res.body);
    assert.equal(res.body.user.id, w.alice.user.id);
    assert.equal(res.body.user.email, w.alice.user.email);
    assert.equal(res.body.transactions.length, tableCount("transactions", w.alice.user.id), "todas as transações");
    assert.equal(res.body.accounts.length, tableCount("accounts", w.alice.user.id));
    assert.equal(res.body.budgets.length, tableCount("budgets", w.alice.user.id));
    assert.ok(text.includes("SEGREDO-A"));
    for (const marker of markersOf(w.bob)) assert.ok(!text.includes(marker), `vazou "${marker}" na exportação`);
  });

  test("não expõe o conteúdo interno do desfazer nem credenciais", async () => {
    const res = await h.call(w.alice.user, "GET", "/account/export");
    const text = JSON.stringify(res.body);
    assert.ok(res.body.action_log.length > 0);
    for (const row of res.body.action_log) assert.ok(!("undo" in row), "o payload de desfazer é interno");
    assert.ok(!/session|passkey|token|password/i.test(Object.keys(res.body).join(" ")));
    assert.ok(!text.includes(w.alice.user.cookie.split("=")[1] ?? "§"), "o cookie da sessão não pode aparecer");
  });

  test("a exportação do Bob não contém nada da Alice (e vice-versa)", async () => {
    const res = await h.call(w.bob.user, "GET", "/account/export");
    const text = JSON.stringify(res.body);
    assert.ok(text.includes("SEGREDO-B"));
    for (const marker of markersOf(w.alice)) assert.ok(!text.includes(marker), `vazou "${marker}" na exportação`);
  });

  test("com mais de uma página de transações (5.000), exporta todas", async () => {
    const erin = await h.newUser("erin@example.test");
    const ofx = buildOfx({ kind: "checking", account: "erin-acc", txs: [{ fitid: "e0", date: "2026-01-10", amount: -1, memo: "Loja Erin" }] });
    assert.equal((await h.upload(erin, ofx)).status, 200);
    const accountId = (h.db.prepare("select id from accounts where user_id = ?").get(erin.id) as { id: string }).id;
    const insert = h.db.prepare(
      "insert into transactions (user_id, account_id, fitid, description, amount, currency_code, transaction_date, merchant_key, excluded) values (?, ?, ?, ?, ?, 'BRL', '2026-01-11', 'loja', 0)",
    );
    h.db.exec("begin");
    for (let i = 0; i < 5500; i++) insert.run(erin.id, accountId, `bulk-${i}`, `Compra ${i}`, -(i + 1));
    h.db.exec("commit");

    const expected = tableCount("transactions", erin.id);
    assert.ok(expected > 5000);
    const res = await h.call(erin, "GET", "/account/export");
    assert.equal(res.status, 200);
    assert.equal(res.body.transactions.length, expected, "todas as transações, de todas as páginas");
    assert.equal(new Set(res.body.transactions.map((t: { id: string }) => t.id)).size, expected, "sem repetir");
  });

  test("exige sessão e tem limite diário por usuário", async () => {
    assert.equal((await h.call(null, "GET", "/account/export")).status, 401);
    h.setLimit("EXPORTS_PER_DAY", 2);
    try {
      h.db.prepare("delete from usage_counters where user_id = ? and kind = 'export'").run(w.alice.user.id);
      h.db.prepare("delete from usage_counters where user_id = ? and kind = 'export'").run(w.bob.user.id);
      assert.equal((await h.call(w.alice.user, "GET", "/account/export")).status, 200);
      assert.equal((await h.call(w.alice.user, "GET", "/account/export")).status, 200);
      assert.equal((await h.call(w.alice.user, "GET", "/account/export")).status, 429);
      assert.equal((await h.call(w.bob.user, "GET", "/account/export")).status, 200, "o Bob tem o próprio limite");
    } finally {
      h.setLimit("EXPORTS_PER_DAY", undefined);
    }
  });
});

describe("exclusão de conta", () => {
  const del = (cookie: string) => h.authCall("/delete-user", {}, "198.51.100.200", cookie);

  test("sessão antiga não basta: exige login recente e nada é apagado", async () => {
    const carol = await h.newUser("carol@example.test");
    h.db.prepare("update session set createdAt = ? where userId = ?").run(new Date(Date.now() - 60 * 60 * 1000).toISOString(), carol.id);
    const res = await del(carol.cookie);
    assert.ok(res.status >= 400 && res.status < 500, `status ${res.status}`);
    assert.equal(userRows(carol.id).n, 1, "a conta continua existindo");
  });

  test("sem sessão não exclui nada", async () => {
    const res = await h.authCall("/delete-user", {}, "198.51.100.201");
    assert.ok(res.status >= 400 && res.status < 500);
    assert.equal(userRows(w.alice.user.id).n, 1);
  });

  test("se o R2 falhar, a exclusão é abortada (nada some pela metade) e dá para repetir", async () => {
    const dave = await h.newUser("dave@example.test");
    const ofx = buildOfx({
      kind: "checking",
      account: "dave-acc",
      txs: [{ fitid: "d1", date: "2026-01-10", amount: -10, memo: "Loja Dave" }],
    });
    assert.equal((await h.upload(dave, ofx)).status, 200);

    // A exclusão de UM usuário não pode alterar nada dos outros: confere já aqui, e não só no teste da Alice.
    const othersBefore = [snapshot(h, w.alice.user.id), snapshot(h, w.bob.user.id)];
    const keysBefore = [...h.bucket.keys()].filter((k) => !k.startsWith(`${dave.id}/`)).sort();

    const bucket = (env as Record<string, any>).OFX_BUCKET;
    const original = bucket.delete;
    bucket.delete = async () => {
      throw new Error("r2 fora do ar");
    };
    try {
      const failed = await del(dave.cookie);
      assert.ok(failed.status >= 400, `status ${failed.status}`);
      assert.equal(userRows(dave.id).n, 1, "a conta continua");
      assert.ok(tableCount("transactions", dave.id) > 0, "os dados continuam");
    } finally {
      bucket.delete = original;
    }
    const retry = await del(dave.cookie);
    assert.equal(retry.status, 200, JSON.stringify(retry.body));
    assert.equal(userRows(dave.id).n, 0);
    assert.deepEqual([snapshot(h, w.alice.user.id), snapshot(h, w.bob.user.id)], othersBefore, "excluir o Dave mexeu nos dados de outros");
    assert.deepEqual([...h.bucket.keys()].sort(), keysBefore, "excluir o Dave mexeu nos arquivos de outros");
  });

  test("apaga tudo da Alice (D1, R2, sessão) e deixa a conta do Bob intacta", async () => {
    const aliceKeysBefore = [...h.bucket.keys()].filter((k) => k.startsWith(`${w.alice.user.id}/`));
    const bobKeysBefore = [...h.bucket.keys()].filter((k) => k.startsWith(`${w.bob.user.id}/`));
    assert.ok(aliceKeysBefore.length > 0 && bobKeysBefore.length > 0);

    // Arquivo guardado sob um prefixo antigo (como o do dono depois da troca de user_id na virada).
    h.bucket.set("prefixo-antigo/abc.ofx", new Uint8Array([1]));
    h.db.prepare("update imports set r2_key = ? where id = ?").run("prefixo-antigo/abc.ofx", w.alice.ids.imports![0]);
    // E um arquivo de OUTRO usuário com nome parecido, que não pode ser apagado.
    h.bucket.set(`${w.bob.user.id}/abc.ofx`, new Uint8Array([2]));

    const bobBefore = snapshot(h, w.bob.user.id);
    const res = await del(w.alice.user.cookie);
    assert.equal(res.status, 200, JSON.stringify(res.body));

    for (const table of USER_TABLES) assert.equal(tableCount(table, w.alice.user.id), 0, `${table} ainda tem dados da Alice`);
    assert.equal(userRows(w.alice.user.id).n, 0, "o usuário foi removido");
    assert.equal((h.db.prepare('select count(*) as n from session where "userId" = ?').get(w.alice.user.id) as { n: number }).n, 0);
    assert.equal((await h.call(w.alice.user, "GET", "/me")).status, 401, "a sessão não vale mais");

    const remaining = [...h.bucket.keys()];
    assert.ok(!remaining.some((k) => k.startsWith(`${w.alice.user.id}/`)), "arquivos da Alice sob o prefixo dela");
    assert.ok(!remaining.includes("prefixo-antigo/abc.ofx"), "arquivo sob prefixo antigo, achado pelo import");
    assert.ok(bobKeysBefore.every((k) => remaining.includes(k)), "arquivos do Bob intactos");
    assert.ok(remaining.includes(`${w.bob.user.id}/abc.ofx`));

    assert.equal(snapshot(h, w.bob.user.id), bobBefore, "a conta do Bob não mudou");
    assert.equal(userRows(w.bob.user.id).n, 1);
    assert.equal((await h.call(w.bob.user, "GET", "/me")).status, 200);
    assert.ok(rowsOf(h, "transactions", w.bob.user.id).length > 0);
  });

  test("depois de excluída, a exportação da conta não existe mais e o e-mail pode se cadastrar de novo", async () => {
    assert.equal((await h.call(w.alice.user, "GET", "/account/export")).status, 401);
    assert.equal(h.db.prepare('select count(*) as n from "user" where email = ?').get(w.alice.user.email).n, 0);
  });
});
