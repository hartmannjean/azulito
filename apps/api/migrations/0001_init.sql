-- Schema inicial (D1/SQLite): bank_connections e transactions.
-- Não há RLS no D1: o isolamento por usuário é garantido no código — toda
-- query de rota autenticada filtra por `user_id` vindo do JWT do Cloudflare
-- Access (ver src/middleware/auth.ts), nunca de input do cliente.

create table bank_connections (
  id text primary key default (lower(hex(randomblob(16)))),
  user_id text not null,
  pluggy_item_id text not null unique,
  institution_name text not null,
  status text not null default 'connected'
    check (status in ('connected', 'updating', 'error', 'disconnected')),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index bank_connections_user_id_idx on bank_connections (user_id);

create trigger bank_connections_set_updated_at
  after update on bank_connections
  for each row
  begin
    update bank_connections
      set updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      where id = new.id;
  end;

create table transactions (
  id text primary key default (lower(hex(randomblob(16)))),
  user_id text not null,
  bank_connection_id text not null references bank_connections (id) on delete cascade,
  pluggy_transaction_id text not null unique,
  description text not null,
  amount real not null,
  currency_code text not null default 'BRL',
  transaction_date text not null,
  category text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index transactions_user_id_date_idx on transactions (user_id, transaction_date desc);
create index transactions_bank_connection_id_idx on transactions (bank_connection_id);
