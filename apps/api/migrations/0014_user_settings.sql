-- Preferências financeiras do usuário (salário e ciclo do cartão), perguntadas no
-- primeiro acesso. Sem RLS no D1: toda query filtra por `user_id` da sessão.
create table user_settings (
  user_id text primary key,
  -- Salário líquido mensal e dia do mês em que cai; null = não informado.
  salary_amount real check (salary_amount is null or (salary_amount >= 0 and salary_amount <= 10000000)),
  salary_day integer check (salary_day is null or (salary_day between 1 and 31)),
  -- Fechamento e vencimento padrão do cartão, para cartões importados daqui em diante.
  card_closing_day integer check (card_closing_day is null or (card_closing_day between 1 and 31)),
  card_due_day integer check (card_due_day is null or (card_due_day between 1 and 31)),
  -- Quando respondeu (ou pulou) as perguntas iniciais; null = ainda não viu.
  onboarded_at text,
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
