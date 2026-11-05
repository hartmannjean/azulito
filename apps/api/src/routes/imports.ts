import express, { Router } from "express";
import { getDb, getOfxBucket } from "../lib/db.js";
import { decodeOfx, parseOfx, OfxParseError } from "../lib/ofx.js";
import { isExcludedFromTotals } from "../lib/classify.js";
import { merchantKey } from "../lib/merchant.js";
import { categorizePending } from "../lib/categorizer.js";
import { defaultDueDay } from "../lib/refmonth.js";
import { LIMITS, consume, limitOf, pruneCounters } from "../lib/limits.js";
import { logAction, type UndoOp } from "../lib/history.js";
import type { ImportDetails, ImportLogEntry } from "@azulito/shared";

export const importsRouter = Router();

// D1 aceita lotes de statements; fatiamos para ficar longe dos limites.
const BATCH_SIZE = 50;

/**
 * POST /imports — recebe os BYTES de um arquivo OFX (Content-Type
 * application/octet-stream; nome em `x-file-name`) e grava as transações do
 * usuário autenticado. Montada com `requireAuth` em src/app.ts.
 *
 * Idempotente: (conta, FITID) é único, então reimportar um extrato que se
 * sobrepõe a outro só insere o que é novo. Responde quantas entraram e
 * quantas já existiam.
 */
importsRouter.post(
  "/",
  express.raw({ type: () => true, limit: LIMITS.MAX_OFX_BYTES }),
  async (req, res) => {
    const body: unknown = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return res.status(400).json({ error: "Arquivo vazio." });
    }

    const fileNameHeader = req.headers["x-file-name"];
    const fileName =
      typeof fileNameHeader === "string" ? decodeURIComponent(fileNameHeader).slice(0, 200) : null;

    let statements;
    try {
      statements = parseOfx(decodeOfx(body));
    } catch (error) {
      if (error instanceof OfxParseError) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Falha ao ler OFX:", error);
      return res.status(400).json({ error: "Arquivo OFX inválido." });
    }

    const userId = req.userId!;

    // Limites de uso (cota gratuita compartilhada): importações por dia e
    // transações guardadas por usuário. O arquivo já foi lido e é válido, então
    // só uma importação real gasta o contador do dia.
    if (!(await consume(userId, "imports", 1, limitOf("IMPORTS_PER_DAY")))) {
      return res.status(429).json({ error: "Limite diário de importações atingido. Ele reinicia às 21h (horário de Brasília)." });
    }
    void pruneCounters().catch(() => {});
    const stored = await getDb()
      .prepare("select count(*) as n from transactions where user_id = ?")
      .bind(userId)
      .first<{ n: number }>();
    if (Number(stored?.n ?? 0) >= limitOf("MAX_TRANSACTIONS_PER_USER")) {
      return res.status(413).json({ error: "Limite de transações guardadas atingido." });
    }

    // Arquiva o arquivo ORIGINAL antes de gravar qualquer linha: se o R2
    // falhar, a importação falha inteira em vez de existir sem cópia. A chave
    // é <user_id>/<sha256 do conteúdo>.ofx — reimportar o MESMO arquivo cai na
    // mesma chave e não gera outra cópia. O user_id vem do JWT e o nome do
    // arquivo do cliente só vai como metadado, nunca compõe o caminho.
    let r2Key: string;
    try {
      const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(body));
      const hash = Buffer.from(digest).toString("hex");
      r2Key = `${userId}/${hash}.ofx`;

      const bucket = getOfxBucket();
      if (!(await bucket.head(r2Key))) {
        // Armazenamento por usuário: soma dos arquivos distintos já guardados.
        const used = await getDb()
          .prepare(
            "select coalesce(sum(b), 0) as total from (select max(bytes) as b from imports where user_id = ? and r2_key is not null group by r2_key)",
          )
          .bind(userId)
          .first<{ total: number }>();
        if (Number(used?.total ?? 0) + body.length > limitOf("MAX_R2_BYTES_PER_USER")) {
          return res.status(413).json({ error: "Limite de armazenamento de arquivos atingido." });
        }
        await bucket.put(r2Key, body, {
          httpMetadata: { contentType: "application/x-ofx" },
          customMetadata: { fileName: fileName ?? "" },
        });
      }
    } catch (error) {
      console.error("Falha ao arquivar OFX no R2:", error);
      return res.status(500).json({ error: "Falha ao gravar a importação." });
    }

    const db = getDb();

    // Fechamento e vencimento que o usuário informou ao se cadastrar: valem para cartões novos.
    const prefs = await db
      .prepare("select card_closing_day, card_due_day from user_settings where user_id = ?")
      .bind(userId)
      .first<{ card_closing_day: number | null; card_due_day: number | null }>();

    try {
      let imported = 0;
      let duplicates = 0;
      const newIds: string[] = [];
      const importRowIds: string[] = [];

      for (const statement of statements) {
        // Fechamento da fatura = dia do DTEND. Só preenche quando ainda não há
        // valor, para não desfazer o que o usuário editou.
        const isCard = statement.kind === "credit_card";
        const fromOfx = isCard && statement.periodEnd ? Number(statement.periodEnd.slice(8, 10)) : null;
        // O que o usuário informou vale primeiro; sem isso, o fechamento vem do OFX e o vencimento é estimado.
        const closingDay = isCard ? (prefs?.card_closing_day ?? fromOfx) : null;
        const dueDay = isCard ? (prefs?.card_due_day ?? (closingDay ? defaultDueDay(closingDay) : null)) : null;

        const account = await db
          .prepare(
            `insert into accounts (user_id, kind, bank_id, account_id, institution_name, currency_code, closing_day, due_day)
             values (?, ?, ?, ?, ?, ?, ?, ?)
             on conflict (user_id, kind, bank_id, account_id) do update set
               institution_name = excluded.institution_name,
               closing_day = coalesce(accounts.closing_day, excluded.closing_day),
               due_day = coalesce(accounts.due_day, excluded.due_day)
             returning id`,
          )
          .bind(
            userId,
            statement.kind,
            statement.bankId,
            statement.accountId,
            statement.institution,
            statement.currency,
            closingDay,
            dueDay,
          )
          .first<{ id: string }>();
        if (!account) throw new Error("Falha ao gravar a conta.");

        const inserts = statement.transactions.map((tx) =>
          db
            .prepare(
              `insert into transactions
                 (user_id, account_id, fitid, description, amount, currency_code, transaction_date, merchant_key, excluded)
               values (?, ?, ?, ?, ?, ?, ?, ?, ?)
               on conflict (account_id, fitid) do nothing
               returning id`,
            )
            .bind(
              userId,
              account.id,
              tx.fitid,
              tx.description,
              tx.amount,
              statement.currency,
              tx.date,
              merchantKey(tx.description),
              isExcludedFromTotals(statement.kind, tx.description, tx.amount) ? 1 : 0,
            ),
        );

        let inserted = 0;
        for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
          const results = await db.batch<{ id: string }>(inserts.slice(i, i + BATCH_SIZE));
          inserted += results.reduce((sum, result) => sum + result.meta.changes, 0);
          for (const result of results) for (const row of result.results) newIds.push(row.id);
        }

        const skipped = inserts.length - inserted;
        imported += inserted;
        duplicates += skipped;

        const importRow = await db
          .prepare(
            "insert into imports (user_id, account_id, file_name, r2_key, imported, duplicates, bytes) values (?, ?, ?, ?, ?, ?, ?) returning id",
          )
          .bind(userId, account.id, fileName, r2Key, inserted, skipped, body.length)
          .first<{ id: string }>();
        if (importRow) importRowIds.push(importRow.id);
      }

      // Categoriza (regras + IA) o que acabou de entrar. Melhor esforço: a
      // importação já foi gravada, então uma falha aqui não a desfaz.
      let remaining = 0;
      let changedIds: string[] = [];
      try {
        const categorized = await categorizePending(userId);
        remaining = categorized.remaining;
        changedIds = categorized.changedIds;
      } catch (error) {
        console.error("Falha ao categorizar após importar:", error);
      }

      if (imported > 0) {
        const created = new Set(newIds);
        const undo: UndoOp[] = [
          { op: "delete_transactions", ids: newIds },
          ...importRowIds.map((id) => ({ op: "delete_import" as const, id })),
          {
            op: "tx_fields",
            rows: changedIds.filter((id) => !created.has(id)).map((id) => ({ id, category: null, category_source: null })),
          },
        ];
        await logAction(userId, "import", { file: fileName ? fileName.slice(0, 80) : null, imported }, undo);
      }

      res.json({ accounts: statements.length, imported, duplicates, uncategorized: remaining });
    } catch (error) {
      console.error("Falha ao gravar importação:", error);
      res.status(500).json({ error: "Falha ao gravar a importação." });
    }
  },
);

/** GET /imports — histórico de importações (mais recentes primeiro). */
importsRouter.get("/", async (req, res) => {
  try {
    const { results } = await getDb()
      .prepare(
        `select i.id, i.file_name, i.imported, i.duplicates, i.created_at, i.r2_key,
                a.institution_name, a.kind as account_kind
         from imports i join accounts a on a.id = i.account_id
         where i.user_id = ? order by i.created_at desc limit 100`,
      )
      .bind(req.userId!)
      .all<{
        id: string;
        file_name: string | null;
        imported: number;
        duplicates: number;
        created_at: string;
        r2_key: string | null;
        institution_name: string;
        account_kind: "checking" | "credit_card";
      }>();

    res.json({
      imports: results.map(({ r2_key, ...row }) => ({ ...row, has_file: r2_key !== null }) satisfies ImportLogEntry),
    });
  } catch (error) {
    console.error("Falha ao buscar importações:", error);
    res.status(500).json({ error: "Falha ao buscar importações." });
  }
});

const MAX_DETAIL_ROWS = 500;

/**
 * GET /imports/:id — o que aquele arquivo trouxe: relê o OFX original
 * guardado no R2 (a chave é <user_id>/<hash>.ofx e só chega aqui via linha de
 * `imports` do próprio usuário) e cruza com o que está no app agora.
 */
importsRouter.get("/:id", async (req, res) => {
  const userId = req.userId!;
  if (!/^[0-9a-f]{32}$/.test(String(req.params.id))) return res.status(400).json({ error: "Importação inválida." });

  try {
    const db = getDb();
    const row = await db
      .prepare(
        `select i.r2_key, i.account_id, a.kind, a.bank_id, a.account_id as ofx_account
         from imports i join accounts a on a.id = i.account_id
         where i.id = ? and i.user_id = ?`,
      )
      .bind(req.params.id, userId)
      .first<{ r2_key: string | null; account_id: string; kind: string; bank_id: string; ofx_account: string }>();
    if (!row) return res.status(404).json({ error: "Importação não encontrada." });
    if (!row.r2_key) return res.status(404).json({ error: "O arquivo original não foi guardado." });

    const object = await getOfxBucket().get(row.r2_key);
    if (!object) return res.status(404).json({ error: "Arquivo original não encontrado." });

    const statements = parseOfx(decodeOfx(new Uint8Array(await object.arrayBuffer())));
    const statement =
      statements.find((s) => s.kind === row.kind && s.accountId === row.ofx_account && s.bankId === row.bank_id) ??
      statements.find((s) => s.kind === row.kind) ??
      statements[0];
    if (!statement) return res.status(404).json({ error: "Arquivo sem extrato." });

    const { results: known } = await db
      .prepare("select fitid, category, excluded from transactions where user_id = ? and account_id = ? limit 20000")
      .bind(userId, row.account_id)
      .all<{ fitid: string; category: string | null; excluded: number }>();
    const byFitid = new Map(known.map((k) => [k.fitid, k]));

    let income = 0;
    let expenses = 0;
    const transactions = statement.transactions.map((tx) => {
      const match = byFitid.get(tx.fitid);
      const excluded = match ? match.excluded === 1 : false;
      if (match && !excluded) {
        if (tx.amount > 0) income += tx.amount;
        else expenses -= tx.amount;
      }
      return {
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        category: match?.category ?? null,
        excluded,
        in_app: match !== undefined,
      };
    });

    const round2 = (value: number) => Math.round(value * 100) / 100;
    res.json({
      period_start: statement.periodStart ?? null,
      period_end: statement.periodEnd ?? null,
      total: transactions.length,
      income: round2(income),
      expenses: round2(expenses),
      transactions: transactions.slice(0, MAX_DETAIL_ROWS),
      truncated: transactions.length > MAX_DETAIL_ROWS,
    } satisfies ImportDetails);
  } catch (error) {
    console.error("Falha ao abrir a importação:", error);
    res.status(500).json({ error: "Falha ao abrir a importação." });
  }
});
