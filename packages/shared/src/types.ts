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
  /** Mês (AAAA-MM) em que a transação conta nas somas. */
  effective_month: string;
  /** Preenchido só quando o usuário trocou o mês; `null` = padrão. */
  reference_month: string | null;
};

/** GET /transactions — `total` é o total de linhas do filtro (para paginar). */
/** Categoria criada pelo usuário (GET /categories). */
export type UserCategory = { id: string; name: string };

export type TransactionsPage = {
  transactions: Transaction[];
  total: number;
  /** Somas de TODO o resultado filtrado (não só da página), sem as `excluded`. */
  totals: { income: number; expenses: number; balance: number };
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
  /** Gasto do mês em categorias SEM limite definido (`null` = sem categoria), do maior pro menor. */
  unbudgeted: Array<{ category: string | null; spent: number }>;
  unbudgetedTotal: number;
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
  /** Só cartão: dia do fechamento e do vencimento da fatura. */
  closing_day: number | null;
  due_day: number | null;
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

/** Uma linha mês a mês das caixinhas (GET /savings). Valores em reais. */
export type SavingsMonth = {
  month: string;
  /** Total aplicado nas caixinhas no mês (saiu da conta). */
  applied: number;
  /** Total resgatado das caixinhas no mês (voltou para a conta). */
  withdrawn: number;
  /** applied - withdrawn: quanto o saldo cresceu por movimentação. */
  net: number;
  /** Saldo informado no fim do mês anterior. */
  opening: number | null;
  /** Saldo informado no fim deste mês. */
  closing: number | null;
  /** Rendimento = closing - opening - net; só com os dois saldos. */
  yield: number | null;
  /** yield / opening (fração, ex.: 0,011 = 1,1%). */
  yield_pct: number | null;
};

export type SavingsForecastPoint = {
  month: string;
  net: number;
  yield: number;
  balance: number;
};

export type SavingsOverview = {
  months: SavingsMonth[];
  /** Saldo do último mês informado, ou estimado até o mês corrente. */
  current_balance: number | null;
  current_balance_estimated: boolean;
  total_yield: number;
  forecast: SavingsForecastPoint[];
  /** Premissas da projeção: média mensal guardada e rendimento mensal médio. */
  assumptions: { avg_net: number; avg_rate: number } | null;
  insight: { content: string; created_at: string } | null;
};

/** Uma ação do histórico (GET /history), que pode ser desfeita. */
export type ActionLogEntry = {
  id: string;
  kind: string;
  /** Dados soltos para montar a frase da ação; a interface valida cada campo. */
  meta: Record<string, unknown>;
  created_at: string;
  undone_at: string | null;
};

export type HistoryResponse = {
  /** Relógio da api, para calcular a idade da ação sem depender do fuso do servidor web. */
  now: string;
  actions: ActionLogEntry[];
};
