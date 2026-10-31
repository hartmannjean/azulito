-- Categorização (IA + regras por estabelecimento), orçamentos e recorrências.

-- `merchant_key` é o estabelecimento/pessoa normalizado (ver lib/merchant.ts):
-- é por ele que uma correção manual vira regra e se aplica às demais
-- transações do mesmo lugar. `category_source` diz quem definiu a categoria.
alter table transactions add column merchant_key text;
alter table transactions add column category_source text
  check (category_source in ('ai', 'rule', 'user'));

create index transactions_merchant_idx on transactions (user_id, merchant_key);
create index transactions_category_idx on transactions (user_id, category);

-- Correção do usuário: "este estabelecimento é sempre esta categoria".
create table merchant_rules (
  user_id text not null,
  merchant_key text not null,
  category text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (user_id, merchant_key)
);

-- Limite mensal de gasto por categoria.
create table budgets (
  user_id text not null,
  category text not null,
  monthly_limit real not null check (monthly_limit > 0),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (user_id, category)
);
