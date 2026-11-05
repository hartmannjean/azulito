import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { startHarness, type Harness, type TestUser } from "./support/harness.ts";
import { READS, USER_TABLES, buildWorld, type World } from "./support/world.ts";

/**
 * Teste DIFERENCIAL de isolamento: não depende do formato de nenhuma resposta.
 * Grava tudo o que um usuário lê com o outro presente, apaga TODOS os dados do
 * outro (numa transação que é desfeita no fim) e lê de novo. Se qualquer query
 * somar, contar ou listar linhas alheias, a resposta muda e o teste falha.
 */

let h: Harness;
let world: World;

before(async () => {
  h = await startHarness();
  world = await buildWorld(h);
});
after(() => h.close());

/** Campos que mudam a cada chamada e não dependem dos dados. */
const VOLATILE = new Set(["now", "today", "generated_at"]);

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !VOLATILE.has(key))
        .map(([key, v]) => [key, strip(v)]),
    );
  }
  return value;
}

async function readAll(user: TestUser): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const path of READS) {
    const res = await h.call(user, "GET", path);
    assert.ok(res.status < 500, `${path}: status ${res.status}`);
    out[path] = JSON.stringify({ status: res.status, body: strip(res.body) });
  }
  return out;
}

function wipe(userId: string) {
  for (const table of USER_TABLES) h.db.prepare(`delete from ${table} where user_id = ?`).run(userId);
}

describe("a resposta de um usuário não depende dos dados do outro", () => {
  for (const [name, viewerKey, goneKey] of [
    ["Bob lê, Alice apagada", "bob", "alice"],
    ["Alice lê, Bob apagado", "alice", "bob"],
  ] as const) {
    test(name, async () => {
      const viewer = world[viewerKey].user;
      const gone = world[goneKey].user;

      const withOther = await readAll(viewer);

      h.db.exec("begin");
      try {
        wipe(gone.id);
        const withoutOther = await readAll(viewer);
        for (const path of READS) {
          assert.equal(withOther[path], withoutOther[path], `${path} muda quando os dados do outro usuário somem`);
        }
      } finally {
        h.db.exec("rollback");
      }
    });
  }

  test("controle positivo: apagar os PRÓPRIOS dados muda a resposta (o teste enxerga diferença)", async () => {
    const viewer = world.bob.user;
    const before = await readAll(viewer);
    h.db.exec("begin");
    try {
      wipe(viewer.id);
      const after = await readAll(viewer);
      const changed = READS.filter((p) => before[p] !== after[p]);
      assert.ok(changed.length >= 8, `só ${changed.length} rotas mudaram; o teste estaria cego`);
    } finally {
      h.db.exec("rollback");
    }
  });
});
