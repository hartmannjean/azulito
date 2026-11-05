// Gera o SQL da VIRADA: troca o user_id antigo do dono (o `sub` do Cloudflare
// Access) pelo id do usuário novo do Better Auth, em todas as tabelas de dados.
// NUNCA executa nada: só imprime o SQL, para você revisar e rodar com o wrangler.
//
// Uso: node scripts/cutover-owner.mjs <id-antigo> <id-novo> > cutover.sql
//      npx wrangler d1 execute azulito --remote --file cutover.sql
// Passo a passo completo (backup, conferência, ordem): docs/cutover-open-signup.md
//
// Os arquivos do R2 NÃO precisam ser movidos: a importação guarda a chave
// completa em `imports.r2_key` e é por ela que o arquivo é lido e apagado.
import { pathToFileURL } from "node:url";

// Mesma lista do verificador estático de isolamento (scripts/check-sql-scope.mts).
const DATA_TABLES = [
  "accounts",
  "imports",
  "transactions",
  "merchant_rules",
  "budgets",
  "user_categories",
  "savings_snapshots",
  "ai_insights",
  "action_log",
  "scheduled_items",
  "user_settings",
];

const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function buildCutoverSql(oldId, newId) {
  // Os ids entram no SQL como texto: aceita só o formato de um id, nunca aspas ou espaços.
  for (const [name, value] of [["id antigo", oldId], ["id novo", newId]]) {
    if (typeof value !== "string" || !ID_PATTERN.test(value)) {
      throw new Error(`${name} inválido: use só letras, números, "-" e "_" (8 a 64 caracteres).`);
    }
  }
  if (oldId === newId) throw new Error("O id antigo e o novo são iguais.");

  const lines = [
    "-- Virada do dono: user_id antigo -> usuário do Better Auth. Gerado por scripts/cutover-owner.mjs.",
    `-- antigo: ${oldId}`,
    `-- novo:   ${newId}`,
    "",
    "-- Trava de segurança: se o usuário novo JÁ tem dados, isto estoura um erro de",
    "-- propósito (inteiro fora do limite) e o resto do arquivo não deve rodar.",
    `select abs(-9223372036854775808) where ${DATA_TABLES.map((t) => `exists (select 1 from ${t} where user_id = '${newId}')`).join("\n   or ")};`,
    "",
    ...DATA_TABLES.map((t) => `update ${t} set user_id = '${newId}' where user_id = '${oldId}';`),
    "",
    "-- Contadores de uso do id antigo não servem mais.",
    `delete from usage_counters where user_id = '${oldId}';`,
    "",
    "-- Conferência: tudo deve estar no id novo e nada no antigo.",
    ...DATA_TABLES.map(
      (t) =>
        `select '${t}' as tabela, (select count(*) from ${t} where user_id = '${newId}') as no_novo, (select count(*) from ${t} where user_id = '${oldId}') as no_antigo;`,
    ),
    "",
  ];
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [oldId, newId] = process.argv.slice(2);
  try {
    process.stdout.write(buildCutoverSql(oldId, newId));
  } catch (error) {
    console.error(error.message);
    console.error("Uso: node scripts/cutover-owner.mjs <id-antigo> <id-novo> > cutover.sql");
    process.exit(2);
  }
}
