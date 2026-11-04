-- ai_insights passa a guardar mais de um tipo de análise por usuário
-- (caixinhas, sugestões de orçamento, recorrências, revisão do mês). O
-- SQLite não altera CHECK, então a tabela é recriada com o mesmo conteúdo.
create table ai_insights_new (
  user_id text not null,
  kind text not null check (length(kind) between 1 and 40),
  content text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (user_id, kind)
);

insert into ai_insights_new (user_id, kind, content, created_at)
  select user_id, kind, content, created_at from ai_insights;

drop table ai_insights;
alter table ai_insights_new rename to ai_insights;
