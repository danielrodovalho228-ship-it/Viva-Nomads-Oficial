# E793 Onda 0: as peças da sessão conferida no servidor (nada visível com a chave desligada)

O desenho aprovado está em `docs/e793-painel-sessao-servidor.md` (#3745). Os 7 ajustes do coordenador (A1–A7) vencem o desenho onde houver diferença. Este PR é a **Onda 0**: entrega as peças e a chave. A lista de rotas do piloto fica para a Onda 1 (PR 2).

## O que mudou, em linguagem simples

1. **O proxy entrega ao painel os cookies que acabou de renovar (A1).**
   - Antes, o token renovado voltava só para o navegador. O pedido que seguia para o layout levava o token **vencido** e o refresh token **já gasto**.
   - Agora o proxy segue o padrão oficial do `@supabase/ssr`: grava também no pedido e recria a resposta, mantendo o `x-vn-destino` e o `comCookies` do E428.
   - Código: `src/lib/supabase/cookies-renovados.ts`, usado em `src/proxy.ts`. Nenhuma outra regra do proxy mudou.
2. **O servidor sabe quem está logado** (`src/lib/auth/sessao-servidor.ts`).
   - É `server-only`, com `cache()` por requisição e `getClaims()` (A3). Lê uma linha de `profiles`.
   - **Nunca lança e nunca redireciona (A2).** Se falhar, devolve `null`.
3. **Um mapeamento só de perfil → usuário** (`src/lib/auth/usuario-do-perfil.ts`). O AuthProvider (cliente) e o servidor usam as mesmas funções, para os dois desenharem o mesmo nome, papel e `isTeste`.
4. **Contexto e hooks do quadro** (`src/components/auth/sessao-servidor-contexto.tsx`).
   - O usuário do servidor chega ao cliente por **prop + Context**, nunca pelo store global no servidor (risco H1).
   - `useUsuarioAtual()` e `useModoAtual()` seguem o A4: no servidor e na hidratação, **só o contexto**. Depois de montar, valem contexto ?? store até a conferência do cliente; depois dela, vale o store.
   - O `useMontado` usa `useSyncExternalStore` com `getServerSnapshot = false`.
   - A **semeadura** (A5) roda só em `useEffect`. Ela grava o usuário do servidor no store quando o store está vazio ou é de outra conta; nesse caso o `setUser` trata a troca de conta. Se o usuário for o mesmo, não sobrescreve.
5. **AuthGuard (A6).** Ele só libera o conteúdo no 1º quadro, com o usuário do contexto, quando a rota está na lista da onda ligada. Nas demais rotas, ou sem contexto, o comportamento é exatamente o de hoje. O redirecionamento para `/auth` continua vindo só da conferência do cliente.
6. **Layout do painel.**
   - Com a chave `off`, nem lê a sessão, e a árvore é idêntica à de hoje.
   - Ligada, lê a sessão com `comLimite(…, LIMITE_CASCA_MS)`. Se a leitura falhar, o layout segue sem contexto e **nunca redireciona** (A2).
7. **Chave `PAINEL_SESSAO_SERVIDOR`** (`src/lib/flags.ts`).
   - Valores: `off` (padrão) ou `piloto`. É lida só no servidor.
   - A lista de rotas de cada onda está em `src/lib/auth/painel-sessao-servidor.ts`. Na Onda 0, a do piloto é **vazia**: ligar `piloto` agora só liga a leitura no servidor e a semeadura, e nenhuma rota muda o 1º quadro.

## Rollback (A7)

Na Vercel, uma mudança de variável só vale para um deploy novo. O rollback **não precisa de código**: basta trocar `PAINEL_SESSAO_SERVIDOR` para `off` e refazer o deploy do mesmo commit, o que leva alguns minutos. Portanto **não é instantâneo**. Mudar a variável em produção fica com o Daniel e o Muse.

## A3: `getClaims` e o tipo de chave

**Versão instalada:** `@supabase/auth-js` 2.108.2 (`@supabase/ssr` 0.12.0). Trecho de `GoTrueClient.getClaims`, em `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js`:

```js
const signingKey = !header.alg ||
    header.alg.startsWith('HS') ||
    !header.kid ||
    !('crypto' in globalThis && 'subtle' in globalThis.crypto)
    ? null
    : await this.fetchJwk(header.kid, ...);
// If symmetric algorithm or WebCrypto API is unavailable, fallback to getUser()
if (!signingKey) {
    const { error } = await this.getUser(token);
    if (error) { throw error; }
    // getUser succeeds so the claims in the JWT can be trusted
    return { data: { claims: payload, header, signature }, error: null };
}
```

Com chave simétrica, o próprio `getClaims` confere a sessão no servidor de autenticação, pelo `getUser`. Por isso o código usa `getClaims()` sempre, sem desvio manual.

**Tipo de chave:**
- **Laboratório local:** as chaves do Supabase CLI são `{"alg":"HS256","typ":"JWT"}`.
- **Produção** (`esezeutgtycekfosxplk`): a chave anon legada (JWT) está **ativa**, com cabeçalho `HS256`. Existe também uma chave nova `sb_publishable_…`.
- **Leitura:** o projeto assina com o segredo JWT simétrico. Então `getClaims` faz um salto de rede ao Auth por navegação dura, o custo de 50 a 150 ms aceito pelo Muse.
- **O que não pude conferir:** o JWKS público de produção (`/auth/v1/.well-known/jwks.json`) não respondeu desta sessão, porque a rede está bloqueada. Se o projeto migrar para chaves assimétricas, a conferência passa a ser local e sem mudança de código.

## Testes

| Teste | O que prova |
|---|---|
| `src/lib/supabase/e793-a1-cookies-renovados.test.ts` | A1. **Antes**, o pedido encaminhado levava `ANTIGO` (3 falhas). **Depois**, leva `NOVO`, mantém o `x-vn-destino` e não perde cookies entre dois `setAll`. |
| `src/lib/auth/e793-usuario-do-perfil.test.ts` | Mapeamento comum: perfil com dados, perfil ausente, `is_teste` nulo, nome e papel faltando. Também confere que o AuthProvider usa as mesmas funções. |
| `src/lib/auth/e793-onda0-regras.test.ts` | Chave `off`/`piloto`. A6: rota fora da lista não libera. A4: na hidratação vale o contexto mesmo com o store de **outra conta**; depois de `authChecked`, vale o store. A5: regra de semeadura. |
| `src/components/auth/e793-montado.test.ts` | O `useMontado` é falso no render do servidor (`renderToString`), e os dois hooks passam por ele e pelas regras do A4. |
| `src/lib/auth/e793-onda0-guardas.test.ts` | (a) nenhuma escrita no store durante o render na casca e no guarda, com um caso de controle que o detector pega; (b) `server-only` e `getClaims`; (c) o layout não redireciona, usa o limite da casca e, com `off`, nem lê a sessão. |
| `tests/e2e/specs/t1607-e793-onda0-nada-muda.spec.ts` | Lab, chave `off` e `piloto` (lista vazia): o HTML de `/dashboard` e de `/dashboard/conta/perfil` segue com `auth-guard-carregando`, e a tela abre depois. |
