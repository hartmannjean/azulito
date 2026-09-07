export const ptBR = {
  common: {
    toggleTheme: "Alternar tema claro/escuro",
    switchToEnglish: "Mudar para inglês",
    switchToPortuguese: "Mudar para português",
    appDescription: "Controle financeiro pessoal integrado ao Nubank via Open Finance.",
  },
  auth: {
    emailLabel: "E-mail",
    passwordLabel: "Senha",
    sending: "Enviando...",
    login: {
      heroTitle: "Seu dinheiro, numa visão só.",
      heroSubtitle:
        "Conecte sua conta do Nubank e acompanhe receitas, despesas e saldo em tempo real, sem precisar abrir o extrato.",
      heading: "Entrar",
      submitLabel: "Entrar",
      signupSuccessNotice:
        "Conta criada. Verifique seu e-mail se a confirmação estiver habilitada, depois entre abaixo.",
      switchPrompt: "Não tem conta?",
      switchLink: "Criar conta",
    },
    signup: {
      heroTitle: "Controle financeiro sem planilha.",
      heroSubtitle:
        "Crie sua conta e conecte o Nubank pra ver receitas, despesas e saldo organizados automaticamente, todo mês.",
      heading: "Criar conta",
      submitLabel: "Criar conta",
      switchPrompt: "Já tem conta?",
      switchLink: "Entrar",
    },
    features: [
      { icon: "🔒", text: "Conexão segura via Open Finance — sua senha do banco nunca passa por aqui" },
      { icon: "📊", text: "Resumo mensal, categorias de gasto e tendência dos últimos meses" },
      { icon: "🔄", text: "Transações sincronizadas automaticamente, sem digitar nada" },
    ],
    illustrationAlt: "Ilustração de cartão e gráfico de finanças",
    errors: {
      invalidCredentials: "E-mail ou senha inválidos.",
      tooManyAttempts: "Muitas tentativas. Aguarde um momento e tente novamente.",
      lockedOut: (minutes: number) => `Muitas tentativas para este e-mail. Tente novamente em ${minutes} min.`,
      invalidSignupInput: "Use um e-mail válido e uma senha com pelo menos 8 caracteres.",
      signupFailed: "Não foi possível criar a conta. Tente novamente.",
      notAuthenticated: "Não autenticado.",
      connectFailed: "Falha ao iniciar conexão com a Pluggy.",
    },
  },
  dashboard: {
    greeting: (name: string) => `Olá, ${name} 👋`,
    logout: "Sair",
    connected: (name: string) => `${name} conectado`,
    noConnection: "Nenhuma conta conectada",
    connectButton: "Conectar Nubank",
    reconnectButton: "Reconectar Nubank",
    connecting: "Iniciando conexão...",
    loadError: "Não foi possível carregar seus dados agora. Tente novamente em instantes.",
    transactionsHeading: "Transações",
    previousMonth: "Mês anterior",
    nextMonth: "Próximo mês",
  },
  summary: {
    income: "Receitas",
    expenses: "Despesas",
    balance: "Saldo",
    deltaNew: "novo",
    deltaUnchanged: "= mês anterior",
    deltaChange: (arrow: string, value: number) => `${arrow} ${value}% vs mês anterior`,
  },
  trend: {
    heading: (months: number) => `Receitas x despesas (${months} meses)`,
    empty: "📈 Ainda não há histórico suficiente.",
    ariaLabel: "Gráfico de receitas e despesas ao longo dos últimos meses",
    incomeTooltip: (month: string, value: string) => `Receitas em ${month}: ${value}`,
    expenseTooltip: (month: string, value: string) => `Despesas em ${month}: ${value}`,
  },
  categories: {
    heading: "Maiores gastos do mês",
    empty: "🎉 Nenhuma despesa neste mês.",
  },
  transactions: {
    empty: "📭 Nenhuma transação neste mês.",
  },
};
