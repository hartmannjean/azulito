-- Contadores diários dos limites de uso (cota gratuita compartilhada).
-- `user_id` é o id do usuário, ou uma chave de sistema: '*' (contador global
-- da conta toda) e 'email:<sha256>' (pedidos de código por destinatário).
-- Dia em UTC: a cota do Workers AI zera às 00:00 UTC.
create table usage_counters (
  user_id text not null,
  day text not null,
  kind text not null,
  n integer not null default 0,
  primary key (user_id, day, kind)
);

create index usage_counters_day_idx on usage_counters (day);

-- Tamanho do OFX guardado no R2, para o limite de armazenamento por usuário.
alter table imports add column bytes integer not null default 0;
