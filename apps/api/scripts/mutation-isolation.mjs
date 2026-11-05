// Teste de mutação: mostra se os testes de segurança realmente enxergam uma
// proteção sumir. Para cada item da lista, desfaz UMA proteção e roda a suíte;
// se ela NÃO falhar, o teste está cego para aquela proteção.
//
// Duas suítes:
//   isolation (padrão): remove o filtro de `user_id` de uma query por vez
//     (troca por `? is not null`, que mantém o número de parâmetros).
//     Lista: scripts/mutations.json. Testes: isolation*.test.ts.
//   limits: desfaz um limite de uso por vez.
//     Lista: scripts/mutations-limits.json. Testes: limits.test.ts e rate-limit.test.ts.
//
// Sobreviventes marcados "redundante" são barreiras duplicadas por trás de uma
// leitura já escopada: não há como observá-las por HTTP, e tudo bem.
//
// Trabalha numa CÓPIA em .mutation-tmp/: os arquivos reais nunca são alterados.
//   account: desfaz uma proteção da exclusão/exportação de conta por vez.
//     Lista: scripts/mutations-account.json. Testes: account.test.ts.
//   cutover: desfaz uma proteção do gerador de SQL da virada por vez.
//     Lista: scripts/mutations-cutover.json. Testes: cutover.test.ts.
//   settings: desfaz uma proteção do cadastro explícito e das preferências por vez.
//     Lista: scripts/mutations-settings.json. Testes: signup.test.ts e settings.test.ts.
// Uso: node scripts/mutation-isolation.mjs [isolation|limits|account|cutover|settings]
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SUITES = {
  isolation: { list: "mutations.json", tests: ["tests/isolation.test.ts", "tests/isolation-differential.test.ts"] },
  limits: { list: "mutations-limits.json", tests: ["tests/limits.test.ts", "tests/rate-limit.test.ts"] },
  account: { list: "mutations-account.json", tests: ["tests/account.test.ts"] },
  cutover: { list: "mutations-cutover.json", tests: ["tests/cutover.test.ts"] },
  settings: { list: "mutations-settings.json", tests: ["tests/signup.test.ts", "tests/settings.test.ts"] },
};
const suiteName = process.argv[2] ?? "isolation";
const suite = SUITES[suiteName];
if (!suite) {
  console.error(`Suíte desconhecida: ${suiteName} (use ${Object.keys(SUITES).join(" ou ")})`);
  process.exit(2);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = join(root, ".mutation-tmp");
const mutations = JSON.parse(readFileSync(join(root, "scripts", suite.list), "utf8"));

rmSync(tmp, { recursive: true, force: true });
for (const dir of ["src", "tests", "migrations", "scripts"]) cpSync(join(root, dir), join(tmp, dir), { recursive: true });

const survivors = [];
const missing = [];

try {
  for (const [file, from, to, what] of mutations) {
    const target = join(tmp, file);
    const original = readFileSync(join(root, file), "utf8");
    if (!existsSync(target) || !original.includes(from)) {
      missing.push(what);
      console.log(`PULADA     ${what}: trecho não encontrado (o código mudou?)`);
      continue;
    }
    writeFileSync(target, original.replace(from, () => to));
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--no-warnings", "--import", "./tests/support/register.mjs", "--test", ...suite.tests],
      { cwd: tmp, encoding: "utf8", timeout: 300_000 },
    );
    writeFileSync(target, original);

    const output = (result.stdout ?? "").replace(/\x1b\[[0-9;]*m/g, "");
    const failed = Number(/# fail (\d+)/.exec(output)?.[1] ?? "-1");
    if (failed === 0) survivors.push(what);
    console.log(`${(failed > 0 ? "DETECTADA" : "SOBREVIVEU").padEnd(10)} ${what}  (${failed} testes falharam)`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`\nSobreviventes (${survivors.length}): ${survivors.join("; ") || "nenhum"}`);
if (missing.length > 0) console.log(`Puladas (${missing.length}): ${missing.join("; ")}`);
const unexpected = survivors.filter((s) => !/redundante/.test(s));
process.exit(unexpected.length > 0 || missing.length > 0 ? 1 : 0);
