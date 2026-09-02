/**
 * Tipos compartilhados entre apps/web e apps/api — o contrato dos dados que
 * trafegam pela API. Mudar a forma de `Transaction`/`BankConnection` aqui
 * obriga os dois lados a serem atualizados juntos, o que é o objetivo: evita
 * o front e o back divergirem silenciosamente sobre o formato dos dados.
 */
export type Transaction = {
  id: string;
  description: string;
  amount: number;
  currency_code: string;
  transaction_date: string;
  category: string | null;
};

export type BankConnection = {
  id: string;
  institution_name: string;
  status: "connected" | "updating" | "error" | "disconnected";
};
