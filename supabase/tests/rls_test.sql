-- Prova, em SQL, que o RLS de bank_connections e transactions bloqueia
-- acesso entre usuários diferentes.
--
-- Como rodar: cole este arquivo inteiro no SQL Editor do dashboard do
-- Supabase (ou `psql` conectado ao banco) DEPOIS de aplicar
-- supabase/migrations/0001_init.sql. É seguro rodar quantas vezes quiser:
-- tudo roda dentro de uma transação que dá ROLLBACK no final, então nenhum
-- dado de teste fica no banco.
--
-- O script usa RAISE EXCEPTION para falhar alto e claro se alguma policy de
-- RLS não estiver se comportando como esperado, e RAISE NOTICE 'PASS: ...'
-- para cada checagem que passa.

begin;

-- --- Setup: dois usuários de teste e uma linha de cada tabela para cada um ---
-- Inserido como o role padrão do SQL Editor (postgres), que não é afetado
-- por RLS — isso simula dados legítimos já existentes no banco.

insert into auth.users (id, instance_id, email, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'user-a@example.com', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'user-b@example.com', 'authenticated', 'authenticated');

insert into public.bank_connections (id, user_id, pluggy_item_id, institution_name, status)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'item-user-a', 'Nubank', 'connected'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'item-user-b', 'Nubank', 'connected');

insert into public.transactions (id, user_id, bank_connection_id, pluggy_transaction_id, description, amount, transaction_date, category)
values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'tx-user-a', 'Compra user A', -50.00, current_date, 'mercado'),
  ('dddddddd-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000002', 'tx-user-b', 'Compra user B', -75.00, current_date, 'mercado');

-- --- Simula uma requisição autenticada como "user A" ---
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

do $$
declare
  visible_count int;
  other_users_row_count int;
  affected_rows int;
begin
  -- 1) SELECT só deve retornar as próprias linhas, nunca as de user B.
  select count(*) into visible_count from public.transactions;
  if visible_count <> 1 then
    raise exception 'FAIL: user A deveria ver exatamente 1 transação, viu %', visible_count;
  end if;
  raise notice 'PASS: user A ve apenas suas proprias transacoes (% linha)', visible_count;

  select count(*) into other_users_row_count
  from public.transactions
  where user_id = '22222222-2222-2222-2222-222222222222';
  if other_users_row_count <> 0 then
    raise exception 'FAIL: user A conseguiu ler transacao de user B via filtro explicito';
  end if;
  raise notice 'PASS: filtro explicito por user_id de outro usuario retorna 0 linhas';

  select count(*) into visible_count from public.bank_connections;
  if visible_count <> 1 then
    raise exception 'FAIL: user A deveria ver exatamente 1 bank_connection, viu %', visible_count;
  end if;
  raise notice 'PASS: user A ve apenas sua propria bank_connection';

  -- 2) UPDATE na linha de user B não deve afetar nenhuma linha.
  update public.transactions
  set description = 'HACKED'
  where id = 'dddddddd-0000-0000-0000-000000000002';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'FAIL: user A conseguiu fazer UPDATE na transacao de user B';
  end if;
  raise notice 'PASS: UPDATE na transacao de outro usuario afeta 0 linhas';

  -- 3) DELETE na linha de user B não deve afetar nenhuma linha.
  delete from public.bank_connections
  where id = 'bbbbbbbb-0000-0000-0000-000000000002';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'FAIL: user A conseguiu fazer DELETE na bank_connection de user B';
  end if;
  raise notice 'PASS: DELETE na bank_connection de outro usuario afeta 0 linhas';

  -- 4) INSERT tentando forjar user_id de outra pessoa deve ser bloqueado
  -- pelo WITH CHECK da policy de insert.
  begin
    insert into public.transactions (user_id, bank_connection_id, pluggy_transaction_id, description, amount, transaction_date)
    values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000002', 'tx-forjada', 'Tentativa de forjar user_id', -1.00, current_date);
    raise exception 'FAIL: insert com user_id forjado foi permitido';
  exception
    when insufficient_privilege or check_violation then
      raise notice 'PASS: insert com user_id forjado foi bloqueado pela policy';
  end;
end $$;

-- --- Repete a checagem de SELECT como "user B", pela simetria ---
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

do $$
declare
  visible_count int;
begin
  select count(*) into visible_count from public.transactions;
  if visible_count <> 1 then
    raise exception 'FAIL: user B deveria ver exatamente 1 transacao, viu %', visible_count;
  end if;
  raise notice 'PASS: user B ve apenas suas proprias transacoes (% linha)', visible_count;
end $$;

-- Desfaz TUDO — usuários e dados de teste não ficam no banco.
rollback;
