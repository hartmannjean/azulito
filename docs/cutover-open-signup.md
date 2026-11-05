# Virada: do Cloudflare Access para o cadastro aberto

Passo a passo para publicar a branch `feat/open-signup`. Nada aqui foi executado: cada passo que mexe em produção é seu.
A ordem importa. Os comandos assumem a raiz do repositório, salvo quando dizem `cd`.

## 0. O que muda

- Sai o Cloudflare Access de `/dash*`. O login passa a ser do próprio app (código por e-mail ou passkey).
- A api **deixa de ter endereço público**: só o web fala com ela (service binding). Isso é requisito de segurança, não detalhe.
- Teto de **5 usuários** e vários limites de uso (ver `apps/api/src/lib/limits.ts`).

## 1. Preparar contas e segredos (só você pode fazer)

1. **Resend** (envio do código de login, plano gratuito):
   - crie a conta e adicione o domínio `hartmanns.com.br` (a Resend mostra os registros SPF/DKIM; como o DNS está na Cloudflare, adicione-os lá);
   - crie uma chave de API com permissão **Sending access**, restrita a esse domínio.
2. **Turnstile** (anti-robô, gratuito): painel Cloudflare → Turnstile → *Add widget*, hostname `azulito.hartmanns.com.br`. Anote a **site key** (pública) e a **secret key**.
3. **Segredos da api** (digite no seu terminal; nunca cole em chat nem commite):
   ```
   cd apps/api
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # use a saída como BETTER_AUTH_SECRET
   npx wrangler secret put BETTER_AUTH_SECRET
   npx wrangler secret put TURNSTILE_SECRET_KEY
   npx wrangler secret put RESEND_API_KEY
   ```
4. **Variáveis públicas do web**, em `apps/web/wrangler.jsonc` (não são segredos):
   ```jsonc
   "vars": { "TURNSTILE_SITE_KEY": "<site key>", "CONTACT_EMAIL": "<e-mail de contato exibido na política de privacidade>" }
   ```
   Sem a `TURNSTILE_SITE_KEY` a página de login mostra um erro (de propósito: não existe login sem anti-robô).
5. Confira `MAIL_FROM` em `apps/api/wrangler.jsonc` (hoje `Azulito <login@hartmanns.com.br>`): tem que ser um endereço do domínio verificado.

## 2. Conferir o código

```
npm run typecheck && npm run lint
cd apps/api && npm test && npm run check:sql && npm run test:mutation
```
Se qualquer um falhar, **pare**.

## 3. Backup (antes de tocar em produção)

```
cd apps/api
npx wrangler d1 export azulito --remote --output backup-antes-da-virada.sql
npx wrangler d1 time-travel info azulito        # anote o timestamp atual: é o ponto de volta
```
O arquivo de backup tem seus dados financeiros: guarde-o fora do repositório.

## 4. Migrations (aditivas: o código antigo continua funcionando)

```
cd apps/api
npx wrangler d1 migrations apply azulito --remote      # 0012_auth.sql e 0013_usage_limits.sql
```

## 5. Publicar

```
cd apps/api && npx wrangler deploy
cd ../web && npx opennextjs-cloudflare build && npx wrangler deploy
```
Faça os dois em seguida: entre um e outro o app fica inconsistente por alguns instantes.

## 6. Tirar o Access e o endereço público da api

1. Zero Trust → Access → Applications: **apague (ou desative) a aplicação `azulito`**. Enquanto ela existir, o Access barra `/dash*` antes do login novo.
2. Workers → `azulito-api` → Settings → *Domains & Routes*: **remova o domínio `azulito-api.hartmanns.com.br`** (se ainda aparecer) e o registro DNS dele. O `wrangler.jsonc` já não declara a rota e desliga `workers.dev`, mas um domínio antigo pode continuar vinculado.
3. Confirme: `https://azulito-api.hartmanns.com.br/health` não deve responder.

## 7. Seu primeiro login (cria o usuário novo)

Abra `https://azulito.hartmanns.com.br/login`, entre com o seu e-mail e o código recebido. Você vai ver um painel vazio: seus dados ainda estão no id antigo.

## 8. Migrar seus dados para o usuário novo

```
cd apps/api
npx wrangler d1 execute azulito --remote --command "select distinct user_id from transactions"
npx wrangler d1 execute azulito --remote --command "select id, email from \"user\""
```
O primeiro deve devolver **um** valor (o id antigo, o `sub` do Access); o segundo, o seu usuário novo.

```
node scripts/cutover-owner.mjs <ID_ANTIGO> <ID_NOVO> > cutover.sql
```
**Leia o `cutover.sql`** (ele só tem `update ... where user_id = antigo`). Depois:
```
npx wrangler d1 execute azulito --remote --file cutover.sql
```
As consultas do final do arquivo mostram, por tabela, `no_novo` (deve ser o total que você tinha) e `no_antigo` (deve ser 0). Se o arquivo recusar rodar com *integer overflow*, é a trava: o usuário novo já tinha dados e nada foi movido.

Os arquivos do R2 **não** precisam ser movidos: cada importação guarda a chave completa do arquivo.

**Se algo der errado:** `npx wrangler d1 time-travel restore azulito --timestamp=<o que você anotou no passo 3>` (ou importe o `backup-antes-da-virada.sql`).

## 9. Conferir no navegador

- [ ] `/dash` sem login redireciona para `/login`.
- [ ] Você vê todas as suas transações, orçamentos e caixinhas.
- [ ] Abrir um extrato antigo em *Contas e importação* funciona.
- [ ] *Conta* → cadastrar uma passkey e sair/entrar com ela.
- [ ] *Conta* → baixar os dados.
- [ ] `/privacidade` abre e mostra o seu contato.

## 10. Convidar a segunda pessoa

Ela só abre `/login` e entra com o e-mail dela: a conta nasce no primeiro login (o teto é 5 contas no total). Para fechar novos cadastros sem afetar quem já tem conta, ponha `"SIGNUPS_ENABLED": "false"` nas `vars` de `apps/api/wrangler.jsonc` e publique de novo.

## 11. Limpeza depois de tudo funcionando

- Apague o `apps/api/.env.local` antigo (chaves do Supabase, Pluggy e Upstash da versão anterior) e revogue essas chaves nos painéis.
- Desligue os projetos antigos da Vercel e do Supabase quando você confirmar.
- Teste a **exclusão de conta** com um e-mail descartável antes de convidar mais gente.

## Voltar atrás (rollback)

`npx wrangler rollback` em `azulito-api` e `azulito-web` volta o código. O Access precisa ser recriado à mão (Zero Trust). As migrations `0012` e `0013` são aditivas e podem ficar. Se você já tinha migrado os dados (passo 8), restaure o ponto do passo 3 antes de voltar ao código antigo, porque ele procura os dados pelo id antigo.
