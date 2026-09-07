import type { ptBR } from "./pt-BR";

export const en: typeof ptBR = {
  common: {
    toggleTheme: "Toggle light/dark theme",
    switchToEnglish: "Switch to English",
    switchToPortuguese: "Switch to Portuguese",
    appDescription: "Personal finance tracker integrated with Nubank via Open Finance.",
  },
  auth: {
    emailLabel: "Email",
    passwordLabel: "Password",
    sending: "Sending...",
    login: {
      heroTitle: "Your money, in one view.",
      heroSubtitle:
        "Connect your Nubank account and track income, expenses and balance in real time, without opening the statement.",
      heading: "Log in",
      submitLabel: "Log in",
      signupSuccessNotice: "Account created. Check your email if confirmation is enabled, then log in below.",
      switchPrompt: "Don't have an account?",
      switchLink: "Create account",
    },
    signup: {
      heroTitle: "Personal finance without spreadsheets.",
      heroSubtitle:
        "Create your account and connect Nubank to see income, expenses and balance organized automatically, every month.",
      heading: "Create account",
      submitLabel: "Create account",
      switchPrompt: "Already have an account?",
      switchLink: "Log in",
    },
    features: [
      { icon: "🔒", text: "Secure connection via Open Finance — your bank password never passes through here" },
      { icon: "📊", text: "Monthly summary, spending categories and trend over the last few months" },
      { icon: "🔄", text: "Transactions synced automatically, no manual entry" },
    ],
    illustrationAlt: "Illustration of a card and a finance chart",
    errors: {
      invalidCredentials: "Invalid email or password.",
      tooManyAttempts: "Too many attempts. Wait a moment and try again.",
      lockedOut: (minutes: number) => `Too many attempts for this email. Try again in ${minutes} min.`,
      invalidSignupInput: "Use a valid email and a password with at least 8 characters.",
      signupFailed: "Could not create the account. Please try again.",
      notAuthenticated: "Not authenticated.",
      connectFailed: "Failed to start the connection with Pluggy.",
    },
  },
  dashboard: {
    greeting: (name: string) => `Hi, ${name} 👋`,
    logout: "Log out",
    connected: (name: string) => `${name} connected`,
    noConnection: "No account connected",
    connectButton: "Connect Nubank",
    reconnectButton: "Reconnect Nubank",
    connecting: "Starting connection...",
    loadError: "Couldn't load your data right now. Please try again shortly.",
    transactionsHeading: "Transactions",
    previousMonth: "Previous month",
    nextMonth: "Next month",
  },
  summary: {
    income: "Income",
    expenses: "Expenses",
    balance: "Balance",
    deltaNew: "new",
    deltaUnchanged: "= last month",
    deltaChange: (arrow: string, value: number) => `${arrow} ${value}% vs last month`,
  },
  trend: {
    heading: (months: number) => `Income vs expenses (${months} months)`,
    empty: "📈 Not enough history yet.",
    ariaLabel: "Chart of income and expenses over the last few months",
    incomeTooltip: (month: string, value: string) => `Income in ${month}: ${value}`,
    expenseTooltip: (month: string, value: string) => `Expenses in ${month}: ${value}`,
  },
  categories: {
    heading: "Top expenses this month",
    empty: "🎉 No expenses this month.",
  },
  transactions: {
    empty: "📭 No transactions this month.",
  },
};
