import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { parsePicPayCsv, isPicPayCsv } from "../src/lib/picpay-csv.ts";
import { OfxParseError } from "../src/lib/ofx.ts";
import { startHarness, type Harness, type TestUser } from "./support/harness.ts";

const HEADER = 'data,hora,tipo,"origem / destino",valor,"forma de pagamento"';

const SAMPLE = [
  HEADER,
  // compra + estorno do mesmo valor e comércio: se anulam
  '2026-10-02,10:00,"Compra realizada",Uber,"−R$ 23,79","Com saldo"',
  '2026-10-02,10:30,"Compra estornada",Uber,"+R$ 23,79",',
  // estorno parcial (não existe compra de R$ 2,41): continua como entrada
  '2026-10-03,09:00,"Compra estornada",Uber,"+R$ 2,41",',
  // Pix recebido + devolvido: se anulam
  '2026-10-04,15:50,"Pix recebido","Fulano de Tal","+R$ 115,00",',
  '2026-10-04,15:53,"Pix devolvido","Fulano de Tal","−R$ 115,00","Com saldo"',
  // Pix comum com milhar e vírgula no nome (campo entre aspas)
  '2026-10-05,12:00,"Pix enviado","Silva, Souza & Cia LTDA","−R$ 1.616,92","Com saldo"',
  '2026-10-05,12:05,"Pix recebido","Beltrano","+R$ 1.929,52",',
  // fatura do cartão e movimentos de cofrinho: fora das somas
  '2026-10-06,09:50,"Pagamento realizado","Fatura PicPay Card","−R$ 1.616,92","Com saldo"',
  '2026-10-06,15:34,"Dinheiro guardado","No cofrinho Cofrinho do Cartão","−R$ 50,00","Com saldo"',
  '2026-10-07,12:42,"Dinheiro resgatado","Do cofrinho Cashback","+R$ 7,87",',
  '2026-10-08,10:00,"Compra de criptomoedas",,"−R$ 3,80","Com saldo"',
  // boleto comum conta como despesa
  '2026-10-09,11:00,"Pagamento realizado","IMOB VILA RICA NEG IMOB LTDA","−R$ 353,46","Com saldo"',
  // duas linhas idênticas no mesmo minuto são lançamentos distintos
  '2026-10-10,10:21,"Compra realizada",Uber,"−R$ 8,94","Com saldo"',
  '2026-10-10,10:21,"Compra realizada",Uber,"−R$ 8,94","Com saldo"',
].join("\r\n");

const bytes = (text: string) => new TextEncoder().encode(`\uFEFF${text}`);

describe("leitor do CSV do PicPay", () => {
  const [statement] = parsePicPayCsv(SAMPLE);
  const tx = statement!.transactions;
  const byDesc = (text: string) => tx.filter((t) => t.description.includes(text));

  test("reconhece o formato pelo cabeçalho, com BOM e CRLF", () => {
    assert.equal(isPicPayCsv(bytes(SAMPLE)), true);
    assert.equal(isPicPayCsv(new TextEncoder().encode("<OFX>...")), false);
  });

  test("uma conta corrente PicPay com o período do arquivo", () => {
    assert.equal(statement!.kind, "checking");
    assert.equal(statement!.institution, "PicPay");
    assert.equal(statement!.periodStart, "2026-10-02");
    assert.equal(statement!.periodEnd, "2026-10-10");
    assert.equal(tx.length, 14);
  });

  test("valores: sinal Unicode, milhar e vírgula decimal", () => {
    assert.equal(byDesc("Silva, Souza")[0]!.amount, -1616.92);
    assert.equal(byDesc("Beltrano")[0]!.amount, 1929.52);
  });

  test("fatura do cartão, cofrinho e cripto ficam fora das somas", () => {
    for (const text of ["Fatura PicPay Card", "Dinheiro guardado", "Dinheiro resgatado", "criptomoedas"]) {
      assert.equal(byDesc(text)[0]!.excluded, true, text);
    }
  });

  test("estorno e devolução anulam o original; estorno parcial continua", () => {
    const uber = byDesc("Uber");
    const cancelled = uber.filter((t) => Math.abs(t.amount) === 23.79);
    assert.equal(cancelled.length, 2);
    assert.ok(cancelled.every((t) => t.excluded), "compra e estorno de R$ 23,79 saem das somas juntos");
    assert.equal(uber.find((t) => t.amount === 2.41)!.excluded, false, "sem compra correspondente, não some");
    const fulano = byDesc("Fulano");
    assert.equal(fulano.length, 2);
    assert.ok(fulano.every((t) => t.excluded));
  });

  test("despesas e receitas reais continuam nas somas", () => {
    for (const text of ["Silva, Souza", "Beltrano", "IMOB VILA RICA"]) {
      assert.equal(byDesc(text)[0]!.excluded, false, text);
    }
  });

  test("linhas idênticas viram lançamentos distintos e o fitid é estável", () => {
    const twins = tx.filter((t) => t.amount === -8.94);
    assert.equal(twins.length, 2);
    assert.notEqual(twins[0]!.fitid, twins[1]!.fitid);
    assert.equal(new Set(tx.map((t) => t.fitid)).size, tx.length);
    const again = parsePicPayCsv(SAMPLE)[0]!.transactions;
    assert.deepEqual(again.map((t) => t.fitid), tx.map((t) => t.fitid));
  });

  test("recusa valor inválido, data inválida e cabeçalho errado", () => {
    assert.throws(() => parsePicPayCsv(`${HEADER}\n2026-10-02,10:00,"Compra realizada",Uber,"abc","Com saldo"`), OfxParseError);
    assert.throws(() => parsePicPayCsv(`${HEADER}\n02/10/2026,10:00,"Compra realizada",Uber,"−R$ 1,00","Com saldo"`), OfxParseError);
    assert.throws(() => parsePicPayCsv('a,b,c\n1,2,3'), OfxParseError);
    assert.throws(() => parsePicPayCsv(HEADER), OfxParseError);
  });
});

describe("importação do CSV pela api", () => {
  let h: Harness;
  let user: TestUser;
  let other: TestUser;

  before(async () => {
    h = await startHarness();
    user = await h.newUser("picpay-a@example.com");
    other = await h.newUser("picpay-b@example.com");
  });
  after(() => h.close());

  const totals = (u: TestUser) =>
    h.db
      .prepare(
        `select count(*) as n, coalesce(sum(case when excluded = 0 and amount > 0 then amount end), 0) as income,
                coalesce(-sum(case when excluded = 0 and amount < 0 then amount end), 0) as expenses
         from transactions where user_id = ?`,
      )
      .get(u.id) as { n: number; income: number; expenses: number };

  test("grava as linhas, aplica as exclusões e guarda o CSV original", async () => {
    const response = await h.upload(user, bytes(SAMPLE), "extrato.csv");
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.imported, 14);
    assert.equal(response.body.duplicates, 0);

    const t = totals(user);
    assert.equal(t.n, 14);
    // receitas reais: estorno parcial 2,41 + Beltrano 1.929,52
    assert.equal(Math.round(t.income * 100) / 100, 1931.93);
    // despesas reais: Silva 1.616,92 + IMOB 353,46 + 2 × 8,94
    assert.equal(Math.round(t.expenses * 100) / 100, 1988.26);

    const keys = [...h.bucket.keys()].filter((key) => key.startsWith(`${user.id}/`));
    assert.equal(keys.length, 1);
    assert.ok(keys[0]!.endsWith(".csv"));
  });

  test("reenviar o mesmo arquivo, ou um que se sobrepõe, não duplica", async () => {
    const again = await h.upload(user, bytes(SAMPLE), "extrato.csv");
    assert.equal(again.body.imported, 0);
    assert.equal(again.body.duplicates, 14);

    const overlapping = `${SAMPLE}\r\n2026-10-11,08:00,"Compra realizada",Padaria,"−R$ 12,00","Com saldo"`;
    const next = await h.upload(user, bytes(overlapping), "extrato2.csv");
    assert.equal(next.body.imported, 1);
    assert.equal(next.body.duplicates, 14);
    assert.equal(totals(user).n, 15);
  });

  test("outro usuário importa o mesmo arquivo sem ser tratado como duplicata", async () => {
    const response = await h.upload(other, bytes(SAMPLE), "extrato.csv");
    assert.equal(response.body.imported, 14);
    assert.equal(totals(other).n, 14);
  });

  test("detalhes da importação relêem o CSV guardado", async () => {
    const list = await h.call(user, "GET", "/imports");
    const first = list.body.imports.find((i: { file_name: string }) => i.file_name === "extrato.csv");
    assert.ok(first);
    const detail = await h.call(user, "GET", `/imports/${first.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.total, 14);
    assert.equal(detail.body.period_start, "2026-10-02");
    assert.equal(detail.body.transactions.every((row: { in_app: boolean }) => row.in_app), true);
  });

  test("arquivo que não é OFX nem o CSV do PicPay é recusado", async () => {
    const response = await h.upload(user, "a,b,c\n1,2,3", "qualquer.csv");
    assert.equal(response.status, 400);
  });
});
