export type OfxAccountKind = "checking" | "credit_card";

export type OfxTransaction = {
  fitid: string;
  /** AAAA-MM-DD, exatamente como o banco informou (sem conversão de fuso). */
  date: string;
  amount: number;
  description: string;
};

export type OfxStatement = {
  kind: OfxAccountKind;
  bankId: string;
  accountId: string;
  institution: string;
  currency: string;
  transactions: OfxTransaction[];
};

export class OfxParseError extends Error {}

const MAX_TRANSACTIONS = 20_000;
const MAX_DESCRIPTION = 200;

/**
 * OFX 1.x (SGML) declara o charset no cabeçalho de texto (`CHARSET:1252`) e
 * os bancos brasileiros costumam exportar em Windows-1252/Latin-1 —
 * decodificar como UTF-8 corromperia os acentos. OFX 2.x (XML) é UTF-8.
 */
export function decodeOfx(bytes: Uint8Array): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 600));
  const charset = /CHARSET:\s*(\S+)/i.exec(head)?.[1]?.toUpperCase();
  const isLatin = charset === "1252" || charset === "ISO-8859-1" || charset === "LATIN1";
  return new TextDecoder(isLatin ? "windows-1252" : "utf-8").decode(bytes);
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
};

function decodeEntities(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (match) => ENTITIES[match] ?? match);
}

/** TRNAMT pode vir com ponto ou vírgula decimal, com ou sem separador de milhar. */
function parseAmount(raw: string): number {
  let value = raw.trim().replace(/\s/g, "");
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    value = value.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma >= 0) {
    value = value.replace(",", ".");
  }
  if (!/^[+-]?\d+(\.\d+)?$/.test(value)) {
    throw new OfxParseError("Valor de transação inválido.");
  }
  return Math.round(Number(value) * 100) / 100;
}

function parseDate(raw: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim());
  if (!match) throw new OfxParseError("Data de transação inválida.");
  const year = match[1]!;
  const month = match[2]!;
  const day = match[3]!;
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) throw new OfxParseError("Data de transação inválida.");
  return `${year}-${month}-${day}`;
}

type Draft = {
  kind: OfxAccountKind;
  bankId: string;
  accountId: string;
  currency: string;
  transactions: OfxTransaction[];
};

type TrnDraft = { fitid?: string; date?: string; amount?: string; name?: string; memo?: string };

/**
 * Parser tolerante para OFX 1.x (SGML, tags folha sem fechamento) e 2.x
 * (XML): trata o arquivo como uma sequência plana de `<TAG>valor`, o que
 * funciona nos dois formatos sem precisar de um parser XML (OFX 1.x não é
 * XML válido). Entrada não confiável: o número de transações tem teto e todo
 * campo é validado antes de virar dado.
 */
export function parseOfx(text: string): OfxStatement[] {
  const start = text.search(/<OFX[\s>]/i);
  if (start < 0) throw new OfxParseError("Arquivo não parece ser OFX.");

  const tokens = text.slice(start).matchAll(/<(\/?)([A-Za-z0-9.]+)>([^<]*)/g);

  const statements: Draft[] = [];
  let institution = "";
  let current: Draft | null = null;
  let trn: TrnDraft | null = null;
  let total = 0;

  for (const token of tokens) {
    const closing = token[1] === "/";
    const tag = token[2]!.toUpperCase();
    const value = decodeEntities(token[3]!.trim());

    if (closing) {
      if (tag === "STMTTRN" && trn && current) {
        if (!trn.fitid || !trn.date || trn.amount === undefined) {
          throw new OfxParseError("Transação incompleta no arquivo.");
        }
        total += 1;
        if (total > MAX_TRANSACTIONS) throw new OfxParseError("Arquivo grande demais.");

        const name = trn.name ?? "";
        const memo = trn.memo ?? "";
        const description = (name && memo && !memo.includes(name) ? `${name} - ${memo}` : memo || name)
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, MAX_DESCRIPTION);

        current.transactions.push({
          fitid: trn.fitid,
          date: parseDate(trn.date),
          amount: parseAmount(trn.amount),
          description: description || "(sem descrição)",
        });
        trn = null;
      }
      continue;
    }

    switch (tag) {
      case "STMTRS":
        current = { kind: "checking", bankId: "", accountId: "", currency: "BRL", transactions: [] };
        statements.push(current);
        break;
      case "CCSTMTRS":
        current = { kind: "credit_card", bankId: "", accountId: "", currency: "BRL", transactions: [] };
        statements.push(current);
        break;
      case "ORG":
        if (value) institution = value.slice(0, 80);
        break;
      case "CURDEF":
        if (current && /^[A-Z]{3}$/.test(value)) current.currency = value;
        break;
      case "BANKID":
        if (current) current.bankId = value.slice(0, 40);
        break;
      case "ACCTID":
        if (current) current.accountId = value.slice(0, 80);
        break;
      case "STMTTRN":
        trn = {};
        break;
      case "FITID":
        if (trn) trn.fitid = value.slice(0, 120);
        break;
      case "DTPOSTED":
        if (trn) trn.date = value;
        break;
      case "TRNAMT":
        if (trn) trn.amount = value;
        break;
      case "NAME":
        if (trn) trn.name = value;
        break;
      case "MEMO":
        if (trn) trn.memo = value;
        break;
    }
  }

  if (statements.length === 0) throw new OfxParseError("Nenhum extrato encontrado no arquivo.");

  return statements.map((statement) => {
    if (!statement.accountId) throw new OfxParseError("Conta não identificada no arquivo.");

    // Alguns bancos repetem FITID dentro do mesmo arquivo; sem desambiguar, a
    // chave de idempotência descartaria transações legítimas como duplicadas.
    const seen = new Map<string, number>();
    const transactions = statement.transactions.map((tx) => {
      const count = (seen.get(tx.fitid) ?? 0) + 1;
      seen.set(tx.fitid, count);
      return count === 1 ? tx : { ...tx, fitid: `${tx.fitid}#${count}` };
    });

    return {
      ...statement,
      transactions,
      institution: institution || (statement.bankId ? `Banco ${statement.bankId}` : "Conta"),
    };
  });
}
