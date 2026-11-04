-- Histórico de ações com desfazer. Cada ação que muda dados grava aqui o
-- ESTADO ANTERIOR (`undo`, uma lista de operações inversas montada pelo
-- servidor — nunca vinda do cliente). Desfazer executa essas operações.
-- `meta` guarda só os dados para a mensagem ("Categoria X para Y"), que a
-- interface traduz. Mantém-se só as últimas ações de cada usuário.
create table action_log (
  id text primary key default (lower(hex(randomblob(16)))),
  user_id text not null,
  kind text not null,
  meta text not null default '{}',
  undo text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  undone_at text
);

create index action_log_user_idx on action_log (user_id, created_at desc);
