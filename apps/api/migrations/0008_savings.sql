-- Caixinhas (RDB do Nubank): o OFX da conta só traz os movimentos de
-- "Aplicação"/"Resgate", nunca o saldo nem o rendimento. O usuário informa o
-- saldo do fim de cada mês; o rendimento sai por diferença
-- (saldo final - saldo inicial - aplicações + resgates).
create table savings_snapshots (
  user_id text not null,
  month text not null check (month glob '[0-9][0-9][0-9][0-9]-[01][0-9]'),
  balance real not null check (balance >= 0),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (user_id, month)
);

-- Última análise gerada pela IA (uma por usuário e tipo), para a página abrir
-- sem chamar o modelo de novo.
create table ai_insights (
  user_id text not null,
  kind text not null check (kind in ('savings')),
  content text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (user_id, kind)
);
