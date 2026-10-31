/**
 * Tipos compartilhados entre apps/web e apps/api — o contrato dos dados que
 * trafegam pela API. Mudar a forma de `Transaction`/`Account` aqui
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

export type Account = {
  id: string;
  institution_name: string;
  kind: "checking" | "credit_card";
  last_import_at: string | null;
};

/** Resultado de POST /imports. */
export type ImportResult = {
  accounts: number;
  imported: number;
  duplicates: number;
};

/** Resumo de receitas/despesas de um mês (`AAAA-MM`) — GET /transactions/summary. */
export type TransactionsSummary = {
  month: string;
  income: number;
  expenses: number;
  balance: number;
};

/** Fatia de gasto por categoria dentro de um mês — GET /transactions/categories. */
export type CategoryBreakdown = {
  category: string;
  total: number;
  percentage: number;
};

export type CategoriesSummary = {
  month: string;
  categories: CategoryBreakdown[];
};

/** Um ponto da série histórica de receitas/despesas — GET /transactions/trend. */
export type MonthlyTrendPoint = {
  month: string;
  income: number;
  expenses: number;
  balance: number;
};

export type TransactionsTrend = {
  trend: MonthlyTrendPoint[];
};
