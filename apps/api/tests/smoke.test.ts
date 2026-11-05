import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { buildOfx, startHarness, type Harness, type TestUser } from "./support/harness.ts";

let h: Harness;
let alice: TestUser;

before(async () => {
  h = await startHarness();
  alice = await h.newUser("alice@example.test");
});
after(() => h.close());

test("sem sessão a api responde 401", async () => {
  assert.equal((await h.call(null, "GET", "/transactions")).status, 401);
});

test("com sessão vale e a lista começa vazia", async () => {
  const me = await h.call(alice, "GET", "/me");
  assert.equal(me.status, 200);
  assert.equal(me.body.id, alice.id);
  const list = await h.call(alice, "GET", "/transactions");
  assert.equal(list.status, 200);
});

test("importa um OFX", async () => {
  const ofx = buildOfx({
    kind: "checking",
    account: "111-1",
    txs: [{ fitid: "a1", date: "2026-01-10", amount: -50, memo: "Mercado Teste" }],
  });
  const res = await h.upload(alice, ofx);
  assert.equal(res.status, 200, JSON.stringify(res.body));
});
