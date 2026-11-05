// Verificador estático de isolamento entre usuários.
//
// Sem RLS no D1, a única barreira entre usuários é o `user_id` em cada query.
// Este script percorre o AST de src/, acha toda chamada `.prepare(<sql>)` e
// exige que a SQL cite `user_id` sempre que tocar uma tabela com dados de
// usuário. Uma query que escape da regra precisa ser justificada no
// ALLOWLIST abaixo (e a justificativa é revisada no code review).
//
// Uso: node --experimental-strip-types --no-warnings scripts/check-sql-scope.mts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

// Tabelas cujas linhas pertencem a um usuário (todas têm coluna user_id).
const USER_TABLES = [
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
  "usage_counters",
];

// Excecões deliberadas: "arquivo:trecho da SQL" -> motivo.
const ALLOWLIST: Record<string, string> = {};

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(dir, entry.name))
      : entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")
        ? [join(dir, entry.name)]
        : [],
  );
}

/** Texto da SQL de um argumento; `${expr}` vira o próprio texto da expressão. */
function sqlText(node: ts.Expression, source: ts.SourceFile): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((s) => `\${${s.expression.getText(source)}}` + s.literal.text).join("");
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = sqlText(node.left, source);
    const right = sqlText(node.right, source);
    return left !== null && right !== null ? left + right : null;
  }
  return null;
}

const root = new URL("../src", import.meta.url);
const files = walk(root.pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const problems: string[] = [];
let checked = 0;

for (const file of files) {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "prepare" &&
      node.arguments[0]
    ) {
      checked++;
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const where = `${file.replace(/^.*[\\/]src[\\/]/, "src/")}:${line}`;
      const sql = sqlText(node.arguments[0], source);
      if (sql === null) {
        problems.push(`${where}  SQL montada dinamicamente: não dá para verificar`);
      } else {
        const lower = sql.toLowerCase();
        const touches = USER_TABLES.filter((t) => new RegExp(`\\b${t}\\b`).test(lower));
        const allowed = Object.keys(ALLOWLIST).some((k) => where.startsWith(k.split("|")[0]!) && sql.includes(k.split("|")[1]!));
        if (touches.length > 0 && !lower.includes("user_id") && !allowed) {
          problems.push(`${where}  toca ${touches.join(", ")} sem user_id\n      ${sql.replace(/\s+/g, " ").slice(0, 140)}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

console.log(`${checked} queries verificadas em ${files.length} arquivos.`);
if (problems.length > 0) {
  console.error(`\n${problems.length} problema(s):\n` + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log("OK: toda query que toca dados de usuário filtra por user_id.");
