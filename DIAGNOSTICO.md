# DIAGNÓSTICO TÉCNICO — Bikco (pato-ai)

> Documento de handoff. Estado em 2026-06-02. Escrito para outra IA/dev continuar a correção.
> **Sintoma atual: o feed entra em loop infinito (re-render / reconexão contínua). O produto não é usável.**

---

## 1. Stack e arquitetura

- **Next.js 16.2.6** (Turbopack), **React 19.2.4**, TypeScript strict.
- Middleware é `src/proxy.ts` (Next 16 renomeou `middleware` → `proxy`).
- **Supabase** (`@supabase/ssr ^0.5.2`, `@supabase/supabase-js ^2.49.4`):
  - Client browser: `src/lib/supabase/client.ts` (singleton via `createBrowserClient`).
  - Client server: `src/lib/supabase/server.ts`.
- Alias `@/*` → `./src/*`.
- Deploy: Vercel. Repo: github.com/bico-afk/pato-ai (branch `master`).
- Auth: Supabase OTP (magic link por email). Usuário de teste logado: `bico.atendimento@gmail.com` (users.id `9ee44959-...`).

**Schema relevante:** `users` (auth_id→auth.users), `professional_profiles`, `demands`, `applications`, `chats`, `messages`.

---

## 2. O que ESTÁ confirmado funcionando

| Item | Como foi verificado |
|---|---|
| Backend Supabase online | `curl` REST `/demands?status=eq.open` → **200 em ~1s**, retorna 5 pedidos |
| RLS de leitura pública | Usuário **rodou** `demands_select_public ... to anon, authenticated using(true)` com sucesso |
| Build de produção | `npm run build` → **exit 0**, sem erros de tipo |
| Rotas SSR | `/`, `/feed`, `/nova-demanda` → **HTTP 200** |
| Env vars locais | `.env.local` tem `NEXT_PUBLIC_SUPABASE_URL=https://hbiifqlyynddfvgabkjf.supabase.co` + anon key JWT válida |
| Há dados | 5 `demands` abertas (2 do usuário logado, 1 de outro user, 2 anônimas) |

**Conclusão:** backend, dados, RLS e build estão OK. O problema é **100% no client-side React/Supabase**.

---

## 3. Linha do tempo do bug (o que aconteceu, em ordem)

1. **Feed travava em spinner infinito** ("conectando", nunca "ao vivo"). Query do Supabase no browser **nunca resolvia**. `curl` com a mesma anon key funcionava em 1s.
2. Adicionado `try/catch/finally` + `withTimeout` (Promise.race 12s) em `fetchInitial`/`loadMore`, e `fetchWithTimeout` (AbortController 12s) no client. → O feed passou a mostrar **`⚠ falha: timeout`** em vez de spinner mudo. **Prova de que a query TRAVA (não volta vazia, não dá erro de RLS — ela pendura).**
3. Diagnóstico: deadlock do **`navigator.locks`** que o `@supabase/supabase-js` usa para serializar o token de auth. Trava ANTES do fetch (por isso `curl` funciona e browser não; por isso REST **e** realtime travam juntos).
4. **"Fix" aplicado (commit `3ea2b39`): desabilitei o lock** passando um `noopLock` em `auth: { lock }`. → **Resultado: agora o feed entra em LOOP INFINITO.**

> **Hipótese central para o próximo dev:** remover o `navigator.locks` **trocou o deadlock por um loop de refresh de token concorrente**. O lock existia justamente para serializar o refresh; sem ele, múltiplos `getSession`/refresh disparam em paralelo, a rotação de refresh token invalida uns aos outros, gera erros de auth em cascata → `onAuthStateChange` dispara em storm → re-render infinito (o `Navbar` global usa `useAuth`, então o app inteiro re-renderiza).

---

## 4. Causa raiz (análise)

O nó é a **camada de auth do `@supabase/ssr` no browser**, não o feed em si:

- **Versão suspeita:** `@supabase/supabase-js ^2.49.4` + `@supabase/ssr ^0.5.2` + **React 19 StrictMode** (ligado por padrão em dev no Next).
- StrictMode monta→desmonta→remonta os effects. O `navigator.locks` é adquirido no 1º mount e a limpeza do StrictMode pode deixar o lock **preso** (promise zumbi que nunca libera) → **toda** query subsequente e o WebSocket de realtime ficam esperando o lock para sempre = o "hang" original.
- Ao remover o lock (`noopLock`), some o deadlock mas aparece **concorrência de refresh** = o loop atual.

Ambos os sintomas (hang e loop) são faces do mesmo problema: **serialização de auth quebrada no browser**.

---

## 5. Correção recomendada (para a outra IA)

**Não remover o lock (reverter o `noopLock`). Em vez disso, usar uma das opções abaixo, em ordem de preferência:**

### Opção A (recomendada) — usar `processLock` do `@supabase/auth-js`
Lock em memória, serializa DENTRO da aba sem usar `navigator.locks` (não deadlocka com StrictMode, não causa refresh concorrente):
```ts
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import { processLock } from '@supabase/auth-js'

createBrowserClient(url, key, {
  auth: { lock: processLock },
  global: { fetch: fetchWithTimeout }, // manter o timeout de rede
})
```
Verificar se `@supabase/auth-js` está disponível (é dep transitiva do supabase-js). Se não, instalar.

### Opção B — desligar StrictMode em dev (se o problema só existir em `npm run dev`)
```ts
// next.config.ts
const nextConfig = { reactStrictMode: false, /* ...resto... */ }
```
Atenção: isso mascara o problema em dev mas não resolve produção. Só vale se confirmar (via React DevTools) que o loop só acontece com StrictMode.

### Opção C — atualizar as libs Supabase
Subir `@supabase/supabase-js` e `@supabase/ssr` para as versões mais recentes (várias correções de lock/SSR saíram depois da 2.49). Testar.

**Depois de escolher, validar com React DevTools / console:** procurar o erro `Maximum update depth exceeded` (confirma render loop) ou um storm de `TOKEN_REFRESHED` no `onAuthStateChange`.

---

## 6. Onde olhar (arquivos e pontos exatos)

| Arquivo | O que tem / o que checar |
|---|---|
| `src/lib/supabase/client.ts` | **Aqui está o `noopLock` a reverter.** Tem `fetchWithTimeout` (manter). Singleton OK. |
| `src/hooks/useAuth.ts` | `onAuthStateChange` chama `setState` a cada evento de auth → se houver storm de refresh, é o motor do loop. Usado pelo `Navbar` global. |
| `src/components/Navbar.tsx` | Global (em `layout.tsx`), usa `useAuth` → re-renderiza o app a cada mudança de auth. |
| `src/hooks/useDemandFeed.ts` | Feed realtime. `useEffect([fetchInitial])`. `fetchInitial` é `useCallback` com deps `[opts.city/state/country/keyword]` (primitivas, estáveis). `subscribe()` faz reconnect com backoff em CHANNEL_ERROR — **se realtime não conectar, vira loop de reconexão** (verificar se as tabelas estão na publication). |
| `src/app/feed/page.tsx` | `loadMore` + IntersectionObserver (`useEffect([loadMore])`). `feedOpts` é `useMemo`. Possível 2º suspeito de loop se `loadMore` recriar em cadeia. Offset corrigido para `20 + page*20`. |
| `src/proxy.ts` | Middleware: `getUser()` só em rotas protegidas. OK. |
| `supabase-setup.sql` | SQL de RLS/trigger/realtime. Usuário já rodou a policy de `demands`; **falta confirmar se rodou o resto** (users, professional_profiles, chats, messages, trigger, realtime publication). |

---

## 7. Padrões já aplicados (não regredir)

- **`createClient()` sempre via `useRef`** nos componentes/hooks (`const sbRef = useRef(createClient()); const supabase = sbRef.current`) e **`supabase` fora das deps** de `useEffect`/`useCallback`. Isso já matou vários loops anteriores. Manter.
- `feedOpts` memoizado com `useMemo`.
- `proxy.ts` (não `middleware.ts`); `cookies()` é async no server client.
- Joins PostgREST nomeados (`users!inner`) falhavam silenciosamente → usar enriquecimento por query separada (já feito no feed e na busca).

---

## 8. Itens secundários (depois de destravar o feed)

1. **Realtime publication:** confirmar `alter publication supabase_realtime add table demands, applications, messages;` rodou. Sem isso, `status` fica "conectando" e o `subscribe()` entra em backoff infinito.
2. **RLS de chats/messages/applications:** rodar o resto de `supabase-setup.sql` para candidaturas/chat funcionarem.
3. **Trigger `increment_candidate_count`:** contador de candidatos não incrementa sem ele.
4. **Busca (`useSearch.ts`):** já troquei mock por query real em `professional_profiles` (match client-side por headline/skills). Sem resultado → publica `demand` (em `SearchResults.tsx`). Validar após o feed voltar.
5. **Username:** logados aparecem como `@usuário` se o enriquecimento via tabela `users` falhar (RLS de `users` precisa permitir leitura — incluído no SQL).

---

## 9. Como reproduzir / validar

```bash
# backend OK (deve retornar 5 linhas em ~1s):
curl "https://hbiifqlyynddfvgabkjf.supabase.co/rest/v1/demands?select=id&status=eq.open" \
  -H "apikey: <ANON_KEY do .env.local>" -H "Authorization: Bearer <ANON_KEY>"

# build:
npm run build      # deve dar exit 0

# rodar:
npm run dev        # abrir /feed e /  → observar console do browser
```
**No browser, abrir DevTools → Console.** Logs úteis já existem: `[useDemandFeed] ...`. Procurar:
- `Maximum update depth exceeded` → render loop (confirma seção 4).
- Storm de eventos de auth → confirma refresh concorrente do `noopLock`.
- `falha: timeout` na tela → query travando (volta pro hang do lock).

---

## 10. Resumo executivo (1 parágrafo)

O backend, os dados, a RLS e o build estão corretos e verificados. O produto trava no **client-side, na serialização de autenticação do Supabase no browser**: a versão em uso deadlocka o `navigator.locks` sob React 19 StrictMode (causava o feed travado/"timeout"); a tentativa de contornar removendo o lock (`noopLock`, commit `3ea2b39`) trocou o deadlock por um **loop de refresh de token concorrente** (sintoma atual). **A correção certa é manter a serialização mas sem `navigator.locks` — usar `processLock` do `@supabase/auth-js`** (Opção A da seção 5), e então validar realtime/RLS restantes. Reverter o `noopLock` é o primeiro passo.
