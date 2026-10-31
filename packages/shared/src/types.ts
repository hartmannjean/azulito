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
  /** Quem definiu a categoria: IA, regra por estabelecimento ou o usuário. */
  category_source: "ai" | "rule" | "user" | null;
  /** Fora das somas (pagamento de fatura, aplicação/resgate). */
  excluded: boolean;
  account_id: string;
  institution_name: string;
  account_kind: "checking" | "credit_card";
};

/** GET /transactions — `total` é o total de linhas do filtro (para paginar). */
export type TransactionsPage = {
  transactions: Transaction[];
  total: number;
};

/** GET /budgets/progress. */
export type BudgetProgress = {
  category: string;
  limit: number;
  spent: number;
  /** Percentual gasto sobre o limite (pode passar de 100). */
  percentage: number;
};

export type BudgetsProgress = {
  month: string;
  budgets: BudgetProgress[];
  totalLimit: number;
  totalSpent: number;
};

/** GET /recurring — gastos que se repetem todo mês. */
export type RecurringItem = {
  merchant: string;
  category: string | null;
  amount: number;
  months_seen: number;
  last_date: string;
  /** Já cobrado no mês corrente? */
  charged_this_month: boolean;
};

export type RecurringSummary = {
  items: RecurringItem[];
  /** Soma do que se espera cobrar ainda neste mês. */
  pending_total: number;
  monthly_total: number;
};

/** POST /transactions/categorize. */
export type CategorizeResult = {
  categorized: number;
  remaining: number;
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
  /** Quantas transações ainda estão sem categoria após a categorização. */
  uncategorized: number;
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
