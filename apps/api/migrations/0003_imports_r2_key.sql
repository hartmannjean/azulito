-- Chave do arquivo OFX original no bucket R2 (azulito-ofx). Nula só em
-- importações anteriores ao arquivamento.
alter table imports add column r2_key text;
