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
  /** Última análise da IA sobre as recorrências. */
  insight?: { content: string; created_at: string } | null;
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

/** Plano de economia da IA (conteúdo salvo em ai_insights, tipo "savings"). */
export type SavingsPlanSection = {
  category: string;
  /** Gasto médio mensal na categoria (últimos meses completos). */
  average: number;
  /** Economia mensal se cortar 20%. */
  saving: number;
  /** Meta do mês e micro-objetivos semanais, em texto. */
  text: string;
};

export type SavingsPlan = {
  summary: string;
  sections: SavingsPlanSection[];
};

/** Sugestão da IA para um orçamento (GET /budgets/suggestions). */
export type BudgetSuggestion = {
  category: string;
  /** Limite atual (`null` = ainda sem orçamento nessa categoria). */
  current: number | null;
  suggested: number;
  /** Gasto médio mensal nos últimos meses completos. */
  average: number;
  reason: string;
};

export type BudgetSuggestions = {
  suggestions: BudgetSuggestion[];
  created_at: string | null;
};

/** Um achado da revisão do mês (POST /audit). */
export type AuditItem = { id: string; date: string; description: string; amount: number; reason?: string };

export type AuditFinding = {
  type: string;
  title: string;
  detail: string;
  items: AuditItem[];
};

export type AuditResult = {
  month: string;
  income: number;
  expenses: number;
  balance: number;
  /** Parecer da IA sobre se os números fazem sentido. */
  verdict: string;
  findings: AuditFinding[];
  /** Transações que a IA achou suspeitas (categoria errada, deveria estar fora das somas...). */
  ai_items: AuditItem[];
  created_at: string;
};

/** Uma importação de OFX (GET /imports). */
export type ImportLogEntry = {
  id: string;
  file_name: string | null;
  imported: number;
  duplicates: number;
  created_at: string;
  institution_name: string;
  account_kind: "checking" | "credit_card";
  /** Arquivo original guardado (permite ver o conteúdo). */
  has_file: boolean;
};

/** O que um arquivo OFX trouxe (GET /imports/:id). */
export type ImportDetails = {
  period_start: string | null;
  period_end: string | null;
  total: number;
  income: number;
  expenses: number;
  transactions: Array<{
    date: string;
    description: string;
    amount: number;
    category: string | null;
    /** Fora das somas (fatura paga, aplicação/resgate). */
    excluded: boolean;
    /** Já está no app (false se a importação foi desfeita depois). */
    in_app: boolean;
  }>;
  truncated: boolean;
};

/** Conta a pagar ou a receber cadastrada (GET /forecast → items). */
export type ScheduledItem = {
  id: string;
  kind: "expense" | "income";
  description: string;
  amount: number;
  due_date: string;
  category: string | null;
  /** Marcada como paga à mão. */
  paid: boolean;
  /**
   * pending: ainda a pagar/receber; paid: marcada à mão; matched: o app achou
   * o pagamento nas transações importadas (mesmo valor, perto do vencimento).
   */
  status: "pending" | "paid" | "matched";
  /** Pendente e já vencida. */
  overdue: boolean;
};

export type ForecastMonth = {
  month: string;
  income: {
    received: number;
    /** Entradas cadastradas ainda não recebidas. */
    scheduled: number;
    /** Entradas recorrentes (ex.: salário) que ainda não caíram. */
    recurring: number;
    /** received + scheduled + recurring. */
    projected: number;
    /** Média dos últimos meses completos (referência). */
    average: number;
  };
  expenses: {
    /** Já lançado no mês (inclui a fatura do cartão que vence nele). */
    realized: number;
    /** Boletos e contas cadastrados ainda não pagos. */
    scheduled: number;
    /** Recorrentes da conta corrente que ainda não foram cobradas. */
    recurring: number;
    /** O que já é certo: realized + scheduled + recurring. */
    committed: number;
    /** Estimativa do mês: o maior entre o comprometido e a média histórica (cartão aberto também). */
    projected: number;
    average: number;
  };
  /** Receita prevista − despesa prevista. */
  balance: number;
};

export type ForecastResponse = {
  months: ForecastMonth[];
  items: ScheduledItem[];
  /** Salário informado pelo usuário, se houver (já incluído na previsão de receitas). */
  salary: { amount: number; day: number } | null;
};

/** Preferências financeiras do usuário (GET/PUT /settings). `null` = não informado. */
export type UserSettings = {
  salary_amount: number | null;
  salary_day: number | null;
  card_closing_day: number | null;
  card_due_day: number | null;
  /** Já respondeu (ou pulou) as perguntas iniciais. */
  onboarded: boolean;
};

/** Compras no cartão: este mês até hoje × mês passado até o mesmo dia (GET /card/comparison). */
export type CardComparison = {
  current_month: string;
  previous_month: string;
  /** Dia do mês até o qual as duas pontas foram somadas. */
  cutoff_day: number;
  cutoff_date: string;
  /** Data da última transação do cartão importada. */
  data_until: string | null;
  /** O último dado do cartão é anterior a hoje (falta importar a fatura). */
  stale: boolean;
  /** Ainda não há nenhuma compra do cartão neste mês. */
  no_data_this_month: boolean;
  current: { purchases: number; count: number; installments: number; refunds: number };
  previous: { purchases: number; count: number; installments: number; refunds: number };
  /** Compras novas do mês passado inteiro (referência). */
  previous_full: number;
  delta: { amount: number; percent: number | null };
  /** Variação por categoria (compras novas), das maiores diferenças. */
  categories: Array<{ category: string; current: number; previous: number; delta: number }>;
  /** Compras novas acumuladas por dia (índice 0 = dia 1). */
  daily: { current: number[]; previous: number[] };
};
