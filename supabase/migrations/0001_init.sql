-- Schema inicial: bank_connections e transactions.
-- RLS é habilitado e as policies são criadas no MESMO arquivo que cria cada
-- tabela — nunca deixar uma tabela "aberta" à espera de uma migration futura
-- que adicione RLS.

create extension if not exists "pgcrypto";

-- Função utilitária para manter updated_at em dia.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================================
-- bank_connections: uma linha por conexão Open Finance (ex: um Item da Pluggy
-- representando a conta do Nubank do usuário).
-- =========================================================================
create table public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pluggy_item_id text not null unique,
  institution_name text not null,
  status text not null default 'connected'
    check (status in ('connected', 'updating', 'error', 'disconnected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bank_connections_user_id_idx on public.bank_connections (user_id);

create trigger bank_connections_set_updated_at
  before update on public.bank_connections
  for each row
  execute function public.set_updated_at();

alter table public.bank_connections enable row level security;
-- Nenhuma tabela deve existir sem RLS habilitado neste projeto.

-- O usuário só enxerga/gerencia as próprias conexões bancárias. Em operação
-- normal, quem cria/atualiza linhas aqui é o backend usando a service role
-- (troca do Connect Token da Pluggy, atualização de status via webhook), mas
-- as policies abaixo garantem que, mesmo que uma rota algum dia use o client
-- autenticado do próprio usuário para isso, ele nunca consiga ler ou alterar
-- a conexão de outra pessoa.
create policy "bank_connections_select_own"
  on public.bank_connections for select
  to authenticated
  using (user_id = auth.uid());

create policy "bank_connections_insert_own"
  on public.bank_connections for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "bank_connections_update_own"
  on public.bank_connections for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "bank_connections_delete_own"
  on public.bank_connections for delete
  to authenticated
  using (user_id = auth.uid());

-- =========================================================================
-- transactions: histórico de transações sincronizadas da Pluggy.
-- =========================================================================
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bank_connection_id uuid not null references public.bank_connections (id) on delete cascade,
  pluggy_transaction_id text not null unique,
  description text not null,
  amount numeric(14, 2) not null,
  currency_code text not null default 'BRL',
  transaction_date date not null,
  category text,
  created_at timestamptz not null default now()
);

create index transactions_user_id_idx on public.transactions (user_id);
create index transactions_bank_connection_id_idx on public.transactions (bank_connection_id);
create index transactions_user_id_date_idx on public.transactions (user_id, transaction_date desc);

alter table public.transactions enable row level security;

-- O usuário só enxerga as próprias transações. Escrita normalmente acontece
-- via service role (webhook/sync da Pluggy, ver lib/supabase/admin.ts), que
-- ignora RLS por design — mas as policies de insert/update/delete abaixo
-- existem como defesa em profundidade caso algum código futuro tente
-- escrever usando o client autenticado do usuário.
create policy "transactions_select_own"
  on public.transactions for select
  to authenticated
  using (user_id = auth.uid());

create policy "transactions_insert_own"
  on public.transactions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "transactions_update_own"
  on public.transactions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "transactions_delete_own"
  on public.transactions for delete
  to authenticated
  using (user_id = auth.uid());
