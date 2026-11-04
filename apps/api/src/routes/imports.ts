import express, { Router } from "express";
import { getDb, getOfxBucket } from "../lib/db.js";
import { decodeOfx, parseOfx, OfxParseError } from "../lib/ofx.js";
import { isExcludedFromTotals } from "../lib/classify.js";
import { merchantKey } from "../lib/merchant.js";
import { categorizePending } from "../lib/categorizer.js";
import { defaultDueDay } from "../lib/refmonth.js";
import { logAction, type UndoOp } from "../lib/history.js";

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
  express.raw({ type: () => true, limit: "5mb" }),
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

    try {
      let imported = 0;
      let duplicates = 0;
      const newIds: string[] = [];
      const importRowIds: string[] = [];

      for (const statement of statements) {
        // Fechamento da fatura = dia do DTEND. Só preenche quando ainda não há
        // valor, para não desfazer o que o usuário editou.
        const closingDay =
          statement.kind === "credit_card" && statement.periodEnd
            ? Number(statement.periodEnd.slice(8, 10))
            : null;
        const dueDay = closingDay ? defaultDueDay(closingDay) : null;

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
            "insert into imports (user_id, account_id, file_name, r2_key, imported, duplicates) values (?, ?, ?, ?, ?, ?) returning id",
          )
          .bind(userId, account.id, fileName, r2Key, inserted, skipped)
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
