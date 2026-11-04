-- Parcelas de cartão: o Nubank reaproveita o MESMO FITID em todas as parcelas
-- de uma compra, e a chave de idempotência (account_id, fitid) descartava da
-- segunda parcela em diante. A importação agora grava `<fitid>~<data>` nas
-- parcelas (ver lib/ofx.ts); aqui as já gravadas ganham a mesma chave, para
-- reimportar o mesmo arquivo continuar sem duplicar.
update transactions
set fitid = fitid || '~' || transaction_date
where account_id in (select id from accounts where kind = 'credit_card')
  and description glob '*[Pp]arcela [0-9]*/[0-9]*'
  and fitid not like '%~%';
