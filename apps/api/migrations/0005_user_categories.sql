-- Categorias criadas pelo usuário, além da lista fixa `CATEGORIES` (código).
-- Ficam no banco e não no código porque o repositório é público e os nomes
-- podem ser pessoais. `transactions.category`, `budgets.category` e
-- `merchant_rules.category` guardam o NOME, então uma categoria própria
-- funciona nelas sem mudar o esquema. `collate nocase` impede duplicar só
-- mudando maiúsculas/minúsculas.
create table user_categories (
  id text primary key default (lower(hex(randomblob(16)))),
  user_id text not null,
  name text not null collate nocase check (length(name) between 1 and 40),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (user_id, name)
);
