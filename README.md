# Azulito

App pessoal de controle financeiro em tempo real, conectado à conta do Nubank
via Pluggy (Open Finance). Monorepo com **frontend e backend separados**:
`apps/web` (Next.js) e `apps/api` (Express), cada um deployado como um
projeto Vercel próprio.

> Repositório público. Segurança foi tratada como prioridade #1 em todas as
> decisões de arquitetura — ver checklist completo mais abaixo.

## Estrutura

```
apps/
  web/      Next.js 16 (App Router) — SÓ frontend: páginas, login/cadastro,
            dashboard. Zero rotas de API própria.
  api/      Express 5 — backend dedicado: transações, conexões bancárias,
            integração com a Pluggy. Deploy separado.
packages/
  shared/   Tipos e schemas Zod compartilhados + rate limiting (Upstash),
            usado pelos dois apps.
supabase/
  migrations/   Schema do banco + RLS
  tests/        Prova em SQL de que o RLS bloqueia acesso entre usuários
```

Por que separado: decisão explícita do usuário, para ter backend e frontend
como projetos de fato independentes (deploys, ciclo de vida e código
separados), não só uma pasta `app/api` dentro do mesmo app Next.js.

### Como a autenticação atravessa a separação

- `apps/web` mantém sua própria sessão via cookies httpOnly
  (`@supabase/ssr`) — usada só para logar/deslogar e proteger as páginas.
- `apps/api` não conhece cookies. Toda rota protegida exige
  `Authorization: Bearer <access_token>` (o JWT do Supabase Auth) e valida
  chamando `supabase.auth.getUser(token)`.
- O browser nunca fala com `apps/api` diretamente — toda chamada sai do
  servidor de `apps/web` (Server Components/Server Actions), então o access
  token do usuário nunca precisa chegar ao JavaScript do client.
- RLS continua valendo em `apps/api`: as rotas escopam o client Supabase ao
  usuário autenticado (chave anônima + o access token dele), nunca usam a
  service role key pra atender uma requisição de usuário logado.

## Como rodar localmente

### 1. Pré-requisitos

- Node.js **22.x** ou mais recente.
- Uma conta [Supabase](https://supabase.com) (plano free) com um projeto criado.
- Uma conta [Upstash](https://upstash.com) (plano free) com um banco Redis criado.

### 2. Instalar dependências (raiz do monorepo, uma vez só)

```bash
npm install
```

### 3. Configurar o Supabase

No **SQL Editor** do seu projeto Supabase, rode `supabase/migrations/0001_init.sql`
(cria as tabelas com RLS já habilitado e as policies). Opcionalmente, rode
também `supabase/tests/rls_test.sql` para ver o RLS bloqueando, na prática,
um usuário tentando acessar dado de outro — a query inteira roda dentro de
uma transação com `ROLLBACK` no final, não deixa dado de teste no banco.

Em **Project Settings > API**, copie a `Project URL`, a `anon public key` e a
`service_role key`.

### 4. Configurar o Upstash Redis

Crie um banco Redis e, em **REST API**, copie a URL e o token. As duas apps
usam o MESMO banco (prefixos de chave diferentes evitam colisão).

### 5. Variáveis de ambiente (uma `.env.local` por app)

```bash
cp apps/api/.env.example apps/api/.env.local
cp apps/web/.env.example apps/web/.env.local
```

**`apps/api/.env.local`**

| Variável | Onde conseguir |
|---|---|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Supabase > Project Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API (só usada no webhook/sync da Pluggy) |
| `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` / `PLUGGY_WEBHOOK_SECRET` | Dashboard da Pluggy (integração ainda não conectada, ver seção própria) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash > seu banco > REST API |
| `CRON_SECRET` | Gere você mesmo (`openssl rand -hex 32`) |
| `WEB_APP_URL` | URL do frontend — único valor aceito em CORS. `http://localhost:3000` em dev |

**`apps/web/.env.local`**

| Variável | Onde conseguir |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Project Settings > API |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Mesmo banco Upstash usado pela apps/api |
| `API_BASE_URL` | URL da apps/api. `http://localhost:3001` em dev |
| `NEXT_PUBLIC_SITE_URL` | URL desta própria app, usada pra montar a CSP |

### 6. Rodar os dois apps (dois terminais)

```bash
npm run dev:api   # http://localhost:3001
npm run dev:web   # http://localhost:3000
```

Abra `http://localhost:3000` — sem sessão, você é redirecionado para
`/login`. Crie uma conta em `/signup`.

### Scripts disponíveis (raiz do monorepo)

| Comando | O que faz |
|---|---|
| `npm run dev:web` / `npm run dev:api` | Sobe um app em desenvolvimento |
| `npm run build` | Builda `packages/shared`, depois `apps/api`, depois `apps/web`, nessa ordem |
| `npm run typecheck` | `tsc --noEmit` nos três workspaces |
| `npm run lint` | ESLint em `apps/api` e `apps/web` |

`packages/shared` precisa estar buildado (`dist/`) antes de `apps/api`/`apps/web`
conseguirem importá-lo — os scripts `dev:*`/`build`/`typecheck` já cuidam
disso sozinhos.

## Status da integração com a Pluggy

**Ainda não conectada a credenciais reais.** Estrutura pronta, toda dentro de
`apps/api`, marcada com `TODO(pluggy)`:

- `apps/api/src/lib/pluggyClient.ts` — auth, connect token, listagem de
  transações, verificação de assinatura de webhook.
- `apps/api/src/routes/pluggy/connect-token.ts` — gera o token do widget
  (protegida por `requireAuth`).
- `apps/api/src/routes/pluggy/webhook.ts` — recebe notificações da Pluggy.
- `apps/api/src/routes/pluggy/sync.ts` — fallback de polling.
- `apps/web/components/connect-bank-button.tsx` — já chama o backend e
  recebe o connect token; falta inicializar o widget de verdade no browser.

Antes de usar em produção: confirme na [documentação oficial da
Pluggy](https://docs.pluggy.ai) o formato exato dos payloads e os domínios do
Connect Widget, e atualize `script-src`/`frame-src` da CSP em
`apps/web/lib/csp.ts` de acordo.

### Sync de transações: webhook + polling — por quê

- **Webhook** (`apps/api`, rota pública, validada por assinatura HMAC) é a
  fonte primária, tempo real.
- **Polling** (rota pública, autenticada por `CRON_SECRET`, pensada para
  rodar via [Vercel Cron](https://vercel.com/docs/cron-jobs) — configurado
  em `apps/api/vercel.json`) é o fallback para quando o webhook falha,
  atrasa, ou não está acessível (ex: localhost em desenvolvimento).
- Os dois caminhos gravam pela mesma função (`apps/api/src/lib/pluggySync.ts`),
  com `upsert` por `pluggy_transaction_id` — processar a mesma transação duas
  vezes nunca duplica dado.
- **Trade-off**: só-webhook fica vulnerável a webhooks perdidos; só-polling
  não é tempo real. A combinação cobre os dois casos ao custo de mais uma
  rota para manter.

## Checklist de segurança implementado

- [x] Autenticação via Supabase Auth (email + senha)
- [x] `apps/api`: middleware central `requireAuth` (Bearer token, valida
      contra o Supabase Auth) — nenhuma rota reimplementa checagem própria
- [x] `apps/web`: gate central de páginas em `proxy.ts` (cookies httpOnly)
- [x] Browser nunca fala direto com `apps/api` — token do usuário nunca
      trafega até o client-side JS
- [x] RLS habilitado desde a criação em **todas** as tabelas, com policies
      explícitas de select/insert/update/delete restritas a `user_id = auth.uid()`
- [x] Queries de `apps/api` escopadas ao usuário via chave anônima + access
      token (RLS aplicado) — service role só nos fluxos sem sessão (webhook/sync)
- [x] Script de teste de RLS (`supabase/tests/rls_test.sql`) provando bloqueio
      cruzado entre usuários, inclusive tentativa de forjar `user_id` em insert
- [x] Rate limiting em login/cadastro: por IP + bloqueio progressivo por
      e-mail (1 min → 5 min → 15 min → 1h)
- [x] Rate limiting básico em toda rota de `apps/api`
- [x] Rate limiting e auth com política de falha correta e testada: rate
      limit falha ABERTA (indisponibilidade do Upstash não derruba o app),
      auth falha FECHADA (qualquer erro ao validar token nega acesso)
- [x] CORS explícito (sem wildcard) em `apps/api`, restrito a `WEB_APP_URL`
- [x] CSP com nonce por request em `apps/web` (`proxy.ts` + `lib/csp.ts`),
      sem `'unsafe-inline'`
- [x] Headers adicionais: `X-Frame-Options`, `X-Content-Type-Options`,
      `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`
- [x] Validação de entrada com Zod em toda rota/Server Action
- [x] Toda chamada à API da Pluggy só existe dentro de `apps/api` — nunca no
      client, e nunca em `apps/web`
- [x] Handler de erro central em `apps/api` nunca vaza stack trace na resposta
- [x] `.gitignore` cobrindo `.env*`, `CLAUDE.md`, chaves/certificados desde o
      primeiro commit
- [x] `.env.example` por app, documentando as variáveis sem valores reais
- [x] Dependabot configurado, PRs de patch/minor agrupados
- [x] Dependências diretas ao mínimo e **versões pinadas exatas** — `npm
      audit` em 0 vulnerabilidades

## O que fica sob sua responsabilidade

- **Confirmar o schema da Pluggy contra a doc oficial** antes de ligar a
  integração de verdade — o código é a estrutura esperada, não uma
  integração testada com credenciais reais.
- **Configurar o webhook da Pluggy** apontando para
  `https://SEU_DOMINIO_DA_API/pluggy/webhook`. O Cron Job de polling já está
  em `apps/api/vercel.json` (a cada 15 min).
- **Rodar `supabase/tests/rls_test.sql`** depois de qualquer mudança nas
  policies de RLS, antes de deployar.
- **Deployar os dois projetos na Vercel** apontando cada um pro seu
  `Root Directory` (`apps/web` e `apps/api`), e configurar `WEB_APP_URL`
  (no projeto da api) e `API_BASE_URL` (no projeto do web) com as URLs de
  produção uma da outra.
- **Rotacionar `SUPABASE_SERVICE_ROLE_KEY`, `PLUGGY_CLIENT_SECRET`,
  `PLUGGY_WEBHOOK_SECRET` e `CRON_SECRET`** se algum vazar.
- **Revisar os PRs do Dependabot** antes de mergear, especialmente updates de
  major version.
- **Monitorar os logs da Vercel** dos dois projetos — não há observabilidade
  configurada além disso, o que é aceitável para um app pessoal.

## Próximo passo recomendado: Cloudflare como WAF (não implementado ainda)

O WAF nativo da Vercel é recurso do **plano Pro** (pago). Alternativa
gratuita, na frente do domínio do frontend (e, se quiser, também da api):

1. Adicionar o domínio no [Cloudflare](https://www.cloudflare.com) (plano
   free) e apontar o DNS pra lá.
2. Proxy do Cloudflare (nuvem laranja) na frente do domínio que aponta pra
   Vercel.
3. Ativar as **Managed Rules** gratuitas do WAF.
4. Configurar **Rate Limiting Rules** do Cloudflare mirando `/login`,
   `/signup` (no domínio do frontend) e as rotas da api — camada adicional
   *antes* do rate limiting da própria aplicação (Upstash), não substituto.
5. Ativar "Always Use HTTPS" e SSL/TLS **Full (strict)**.

Documentação para quando/se quiser adicionar — nada disso está implementado
no código deste repositório.
