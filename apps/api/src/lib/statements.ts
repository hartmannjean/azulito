import { decodeOfx, parseOfx, type OfxStatement } from "./ofx.js";
import { isPicPayCsv, parsePicPayCsv } from "./picpay-csv.js";

export type StatementFormat = "ofx" | "csv";

/**
 * Lê o arquivo enviado: o formato vem do CONTEÚDO (o nome é do cliente e não
 * serve de prova). OFX é o padrão; o CSV de extrato do PicPay é reconhecido
 * pelo cabeçalho.
 */
export function parseStatementFile(bytes: Uint8Array): { format: StatementFormat; statements: OfxStatement[] } {
  if (isPicPayCsv(bytes)) {
    return { format: "csv", statements: parsePicPayCsv(new TextDecoder("utf-8").decode(bytes)) };
  }
  return { format: "ofx", statements: parseOfx(decodeOfx(bytes)) };
}
