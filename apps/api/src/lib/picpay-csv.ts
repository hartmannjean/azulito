import { OfxParseError, type OfxStatement, type OfxTransaction } from "./ofx.js";

/**
 * Extrato CSV da conta PicPay (o app não exporta OFX). Colunas:
 *   data,hora,tipo,"origem / destino",valor,"forma de pagamento"
 * com valor em texto brasileiro ("−R$ 1.616,92", "+R$ 491,22").
 *
 * O CSV não traz identificador por linha nem saldo, então o `fitid` é derivado
 * do conteúdo (reimportar um período que se sobrepõe continua idempotente).
 */

const MAX_TRANSACTIONS = 5_000;
const MAX_DESCRIPTION = 200;
const HEADER = ["data", "hora", "tipo", "origem / destino", "valor", "forma de pagamento"];

/** Movimentos entre a conta e os cofrinhos/investimentos: o dinheiro só muda de lugar. */
const SAVINGS_FLOW = new Set(["dinheiro guardado", "guardado no cofrinho", "dinheiro resgatado", "compra de criptomoedas"]);

export function isPicPayCsv(bytes: Uint8Array): boolean {
  const head = new TextDecoder("utf-8").decode(bytes.subarray(0, 300)).replace(/^\uFEFF/, "");
  const firstLine = head.split(/\r?\n/, 1)[0] ?? "";
  return firstLine.replace(/"/g, "").trim().toLowerCase() === HEADER.join(",");
}

/** CSV (RFC 4180): campos entre aspas, aspas duplas escapadas, CRLF ou LF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const endRow = () => {
    row.push(cell);
    cell = "";
    if (row.some((value) => value !== "")) rows.push(row);
    row = [];
    if (rows.length > MAX_TRANSACTIONS + 1) throw new OfxParseError("Arquivo grande demais.");
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else cell += char;
  }
  if (cell !== "" || row.length > 0) endRow();
  return rows;
}

function parseMoney(raw: string, line: number): number {
  const match = /^([+\-−])?\s*R\$\s*(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})$/.exec(raw.trim());
  if (!match) throw new OfxParseError(`Linha ${line}: valor inválido.`);
  const cents = Number(match[2]!.replace(/\./g, "")) * 100 + Number(match[3]);
  const negative = match[1] === "-" || match[1] === "−";
  return (negative ? -cents : cents) / 100;
}

function parseDate(raw: string, line: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) throw new OfxParseError(`Linha ${line}: data inválida.`);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) throw new OfxParseError(`Linha ${line}: data inválida.`);
  return raw.trim();
}

/** Hash não criptográfico de 53 bits (cyrb53): basta para identificar linhas, sem depender de `crypto.subtle` assíncrono. */
function hash53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

const clean = (value: string) => value.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim();
const norm = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

function describe(tipo: string, origem: string): string {
  const type = norm(tipo);
  let text: string;
  if (type === "compra realizada") text = origem;
  else if (type === "compra estornada") text = `Estorno - ${origem}`;
  else if (type === "pagamento realizado") text = `Pagamento - ${origem}`;
  else text = origem ? `${tipo} - ${origem}` : tipo;
  return text.slice(0, MAX_DESCRIPTION) || tipo;
}

type Row = {
  datetime: string;
  tipo: string;
  origem: string;
  amount: number;
  tx: OfxTransaction;
};

export function parsePicPayCsv(text: string): OfxStatement[] {
  const table = parseCsv(text.replace(/^\uFEFF/, ""));
  const header = table[0]?.map((cell) => clean(cell).toLowerCase());
  if (!header || header.join(",") !== HEADER.join(",")) {
    throw new OfxParseError("Arquivo não parece ser o extrato CSV do PicPay.");
  }
  const body = table.slice(1);
  if (body.length === 0) throw new OfxParseError("O arquivo não tem transações.");
  if (body.length > MAX_TRANSACTIONS) throw new OfxParseError("Arquivo grande demais.");

  // Linhas idênticas (mesmo minuto, valor e destino) são lançamentos distintos: o índice as separa
  // de forma estável, na ordem em que aparecem no arquivo.
  const seen = new Map<string, number>();
  const rows: Row[] = [];

  body.forEach((cells, index) => {
    const line = index + 2;
    if (cells.length < 5) throw new OfxParseError(`Linha ${line}: faltam colunas.`);
    const [dateRaw, timeRaw = "", tipoRaw = "", origemRaw = "", valueRaw = "", formaRaw = ""] = cells;
    const date = parseDate(dateRaw!, line);
    const amount = parseMoney(valueRaw, line);
    const tipo = clean(tipoRaw);
    const origem = clean(origemRaw);
    if (!tipo) throw new OfxParseError(`Linha ${line}: tipo ausente.`);

    const key = [date, clean(timeRaw), tipo, origem, amount.toFixed(2), clean(formaRaw)].join("|");
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);

    const type = norm(tipo);
    const isCardBill = type === "pagamento realizado" && /^fatura\b/i.test(norm(origem));
    rows.push({
      datetime: `${date}T${clean(timeRaw) || "00:00"}`,
      tipo: type,
      origem: norm(origem),
      amount,
      tx: {
        fitid: `picpay-${hash53(key)}-${occurrence}`,
        date,
        amount,
        description: describe(tipo, origem),
        excluded: SAVINGS_FLOW.has(type) || isCardBill,
      },
    });
  });

  // Estorno e devolução anulam o lançamento original; se os dois ficassem nas somas
  // inflariam receita e despesa na mesma quantia. Só se pareia o que casa por valor e
  // contraparte; um estorno parcial (sem par) continua valendo como entrada.
  const chronological = [...rows].sort((a, b) => (a.datetime < b.datetime ? -1 : a.datetime > b.datetime ? 1 : 0));
  const paired = new Set<Row>();
  const pairWith = (undo: Row, originalType: string) => {
    let match: Row | undefined;
    for (const candidate of chronological) {
      if (candidate === undo || paired.has(candidate)) continue;
      if (candidate.datetime > undo.datetime) break;
      if (candidate.tipo === originalType && candidate.origem === undo.origem && Math.round(candidate.amount * 100) === -Math.round(undo.amount * 100)) {
        match = candidate; // o mais recente que ainda não foi pareado
      }
    }
    if (match) {
      paired.add(match);
      paired.add(undo);
      match.tx.excluded = true;
      undo.tx.excluded = true;
    }
  };
  for (const row of chronological) {
    if (row.tipo === "compra estornada" && row.amount > 0) pairWith(row, "compra realizada");
    else if (row.tipo === "pix devolvido" && row.amount < 0) pairWith(row, "pix recebido");
  }

  const dates = rows.map((row) => row.tx.date).sort();
  return [
    {
      kind: "checking",
      bankId: "picpay",
      accountId: "conta",
      institution: "PicPay",
      currency: "BRL",
      periodStart: dates[0],
      periodEnd: dates[dates.length - 1],
      transactions: rows.map((row) => row.tx),
    },
  ];
}
