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
