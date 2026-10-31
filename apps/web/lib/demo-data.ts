import type {
  Account,
  BudgetsProgress,
  CategoriesSummary,
  MonthlyTrendPoint,
  RecurringSummary,
  Transaction,
  TransactionsSummary,
} from "@azulito/shared";
import { shiftMonth } from "@/lib/format";

/**
 * Dados FICTÍCIOS da demonstração pública (/demo). Nada aqui vem do banco nem
 * da API: estabelecimentos e valores são inventados, sem IA e sem
 * persistência. As datas são relativas a hoje para a demo nunca parecer
 * defasada, mas o conteúdo é sempre o mesmo.
 */

const CHECKING: Account = {
  id: "demo-checking",
  institution_name: "Banco Demo",
  kind: "checking",
  last_import_at: null,
};

const CARD: Account = {
  id: "demo-card",
  institution_name: "Banco Demo",
  kind: "credit_card",
  last_import_at: null,
};

type Seed = [
  day: number,
  description: string,
  amount: number,
  category: string | null,
  source: Transaction["category_source"],
  card?: boolean,
  excluded?: boolean,
];

// [dia do mês, descrição, valor, categoria, origem da categoria, cartão?, fora das somas?]
const SEEDS: Seed[] = [
  [5, "Salário - Empresa Exemplo Ltda", 9500, "Income", "rule"],
  [18, "Projeto freelance - Cliente Alfa", 1800, "Income", "user"],
  [26, "Pix recebido - Maria Souza", 320, "Transfers", "ai"],
  [2, "Aluguel - Imobiliária Central", -2400, "Housing", "rule"],
  [3, "Condomínio Residencial Aurora", -650, "Housing", "rule"],
  [8, "Energia elétrica - Companhia Luz", -228.4, "Electricity", "ai"],
  [8, "Internet Fibra Max", -119.9, "Internet", "rule"],
  [9, "Plano Móvel Conecta", -59.9, "Telecommunications", "rule"],
  [4, "Supermercado Bom Preço", -312.75, "Groceries", "ai", true],
  [11, "Supermercado Bom Preço", -287.1, "Groceries", "ai", true],
  [19, "Mercadinho do Zé", -96.3, "Groceries", "ai"],
  [24, "Supermercado Bom Preço", -344.6, "Groceries", "ai", true],
  [6, "Posto Rota 66", -210, "Gas stations", "ai", true],
  [20, "Posto Rota 66", -185.5, "Gas stations", "ai", true],
  [7, "Streaming Plus", -39.9, "Video streaming", "rule", true],
  [7, "Música Já Premium", -21.9, "Digital services", "rule", true],
  [10, "Assistente IA - Assinatura", -110, "Digital services", "ai", true],
  [12, "Academia Corpo em Forma", -129.9, "Wellness and fitness", "rule"],
  [13, "Farmácia Saúde Total", -87.45, "Pharmacy", "ai", true],
  [14, "Restaurante Sabor da Casa", -96.8, "Eating out", "ai", true],
  [21, "Pizzaria Forno a Lenha", -118.5, "Eating out", "ai", true],
  [16, "Entrega Rápida Food", -54.9, "Food delivery", "ai", true],
  [23, "Entrega Rápida Food", -63.2, "Food delivery", "ai", true],
  [15, "App de Corridas", -34.5, "Transportation", "ai", true],
  [22, "App de Corridas", -28.9, "Transportation", "ai", true],
  [17, "Pet Shop Amigo Fiel", -142.3, "Pet supplies and vet", "user", true],
  [25, "Livraria Papel & Tinta", -89.9, "Education", "ai", true],
  [27, "Cinema Centro", -64, "Leisure", "ai", true],
  [27, "Loja de Eletrônicos Bit", -279.9, "Electronics", "ai", true],
  [28, "Pix enviado - Carlos Lima", -150, "Transfers", "ai"],
  [29, "Tarifa de manutenção", -14.9, "Bank fees", "ai"],
  [30, "Compra sem identificação", -47.6, null, null, true],
  [10, "Pagamento de fatura", -3180.45, "Transfers", "rule", false, true],
  [10, "Pagamento recebido", 3180.45, "Transfers", "rule", true, true],
  [14, "Aplicação RDB", -1500, "Other", "rule", false, true],
  [28, "Resgate RDB", 600, "Other", "rule", false, true],
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export type DemoData = ReturnType<typeof getDemoData>;

export function getDemoData(now: Date = new Date()) {
  // Mês de referência: o anterior ao atual, para ter o mês inteiro.
  const current = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
  const month = shiftMonth(current, -1);

  const accounts: Account[] = [
    { ...CHECKING, last_import_at: `${current}-01` },
    { ...CARD, last_import_at: `${current}-01` },
  ];

  const transactions: Transaction[] = SEEDS.map((seed, index) => {
    const [day, description, amount, category, source, card = false, excluded = false] = seed;
    const account = card ? CARD : CHECKING;
    return {
      id: `demo-${index + 1}`,
      description,
      amount,
      currency_code: "BRL",
      transaction_date: `${month}-${pad(day)}`,
      category,
      category_source: source,
      excluded,
      account_id: account.id,
      institution_name: account.institution_name,
      account_kind: account.kind,
    };
  }).sort((a, b) => b.transaction_date.localeCompare(a.transaction_date) || a.id.localeCompare(b.id));

  const counted = transactions.filter((tx) => !tx.excluded);
  const income = counted.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
  const expenses = counted.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum - tx.amount, 0);
  const round = (value: number) => Math.round(value * 100) / 100;

  const summary: TransactionsSummary = {
    month,
    income: round(income),
    expenses: round(expenses),
    balance: round(income - expenses),
  };

  const previousSummary: TransactionsSummary = {
    month: shiftMonth(month, -1),
    income: round(income * 0.93),
    expenses: round(expenses * 1.08),
    balance: round(income * 0.93 - expenses * 1.08),
  };

  const byCategory = new Map<string, number>();
  for (const tx of counted) {
    if (tx.amount >= 0) continue;
    const key = tx.category ?? "Other";
    byCategory.set(key, (byCategory.get(key) ?? 0) + -tx.amount);
  }
  const categories: CategoriesSummary = {
    month,
    categories: [...byCategory.entries()]
      .map(([category, total]) => ({
        category,
        total: round(total),
        percentage: Math.round((total / expenses) * 1000) / 10,
      }))
      .sort((a, b) => b.total - a.total),
  };

  // Série dos últimos 6 meses terminando no mês de referência.
  const factors: Array<[number, number]> = [
    [0.86, 0.9],
    [0.95, 1.04],
    [0.9, 0.97],
    [1.02, 1.12],
    [0.93, 1.08],
    [1, 1],
  ];
  const trend: MonthlyTrendPoint[] = factors.map(([incomeFactor, expenseFactor], index) => {
    const pointIncome = round(income * incomeFactor);
    const pointExpenses = round(expenses * expenseFactor);
    return {
      month: shiftMonth(month, index - (factors.length - 1)),
      income: pointIncome,
      expenses: pointExpenses,
      balance: round(pointIncome - pointExpenses),
    };
  });

  const limits: Array<[string, number]> = [
    ["Groceries", 800],
    ["Eating out", 250],
    ["Gas stations", 450],
    ["Digital services", 300],
    ["Food delivery", 100],
  ];
  const budgetRows = limits
    .map(([category, limit]) => {
      const spent = round(byCategory.get(category) ?? 0);
      return { category, limit, spent, percentage: Math.round((spent / limit) * 1000) / 10 };
    })
    .sort((a, b) => b.percentage - a.percentage);
  const budgets: BudgetsProgress = {
    month,
    budgets: budgetRows,
    totalLimit: round(budgetRows.reduce((sum, row) => sum + row.limit, 0)),
    totalSpent: round(budgetRows.reduce((sum, row) => sum + row.spent, 0)),
  };

  const recurring: RecurringSummary = {
    items: [
      { merchant: "Aluguel - Imobiliária Central", category: "Housing", amount: 2400, months_seen: 6, last_date: `${month}-02`, charged_this_month: true },
      { merchant: "Condomínio Residencial Aurora", category: "Housing", amount: 650, months_seen: 6, last_date: `${month}-03`, charged_this_month: true },
      { merchant: "Academia Corpo em Forma", category: "Wellness and fitness", amount: 129.9, months_seen: 6, last_date: `${month}-12`, charged_this_month: true },
      { merchant: "Internet Fibra Max", category: "Internet", amount: 119.9, months_seen: 6, last_date: `${month}-08`, charged_this_month: true },
      { merchant: "Assistente IA - Assinatura", category: "Digital services", amount: 110, months_seen: 5, last_date: `${month}-10`, charged_this_month: true },
      { merchant: "Plano Móvel Conecta", category: "Telecommunications", amount: 59.9, months_seen: 6, last_date: `${month}-09`, charged_this_month: false },
      { merchant: "Streaming Plus", category: "Video streaming", amount: 39.9, months_seen: 6, last_date: `${month}-07`, charged_this_month: false },
      { merchant: "Música Já Premium", category: "Digital services", amount: 21.9, months_seen: 6, last_date: `${month}-07`, charged_this_month: false },
    ],
    monthly_total: 0,
    pending_total: 0,
  };
  recurring.monthly_total = round(recurring.items.reduce((sum, item) => sum + item.amount, 0));
  recurring.pending_total = round(
    recurring.items.filter((item) => !item.charged_this_month).reduce((sum, item) => sum + item.amount, 0),
  );

  return {
    month,
    accounts,
    transactions,
    summary,
    previousSummary,
    categories,
    trend,
    budgets,
    recurring,
    uncategorized: transactions.filter((tx) => tx.category === null).length,
  };
}
