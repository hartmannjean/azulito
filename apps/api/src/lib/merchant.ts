const PREFIX =
  /^(?:transferencia (?:enviada|recebida)(?: pelo pix)?|reembolso recebido pelo pix|pagamento de boleto efetuado|compra no (?:debito|credito)|pix (?:enviado|recebido))\s*-\s*/;

/**
 * Estabelecimento (ou pessoa) normalizado a partir da descrição do OFX, para
 * agrupar o mesmo lugar escrito de jeitos diferentes: "Compra no débito -
 * SUPERMERCADOS OSANA" (conta) e "Supermercados Osana" (cartão) viram
 * "supermercados osana". Em Pix/boleto fica só o nome da contraparte (sem
 * CPF/CNPJ, banco, agência). Sem acento, minúsculo, sem dígitos.
 */
export function merchantKey(description: string): string {
  let value = description
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

  const prefix = PREFIX.exec(value);
  if (prefix) {
    value = value.slice(prefix[0].length).split(" - ")[0] ?? "";
  }

  const key = value
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40)
    .trim();

  return key || "outros";
}
