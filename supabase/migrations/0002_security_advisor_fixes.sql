-- Corrige avisos do security advisor do Supabase.

-- 1) set_updated_at (nossa função, criada em 0001_init) precisa de
-- search_path fixo para não ser vulnerável a search_path hijacking.
alter function public.set_updated_at() set search_path = '';

-- 2) rls_auto_enable é um event trigger interno da Supabase (liga RLS
-- automaticamente em tabelas novas como rede de segurança). Não precisa
-- ser chamável via API por anon/authenticated — só o dono/event trigger
-- precisa executá-lo.
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
