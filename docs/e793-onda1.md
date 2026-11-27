# E793 Onda 1 (piloto): as 5 rotas do painel desenhadas no servidor

Este documento vem depois da Onda 0 (`docs/e793-onda0.md`, #3748, mesclado em `f2a1ae81`). Valem o desenho (`docs/e793-painel-sessao-servidor.md`) e os ajustes A1–A7 do coordenador.

## O que mudou

1. **A lista do piloto** (`ROTAS_DA_ONDA.piloto`) tem as 5 rotas decididas:
   - `/dashboard`
   - `/dashboard/conta`
   - `/dashboard/conta/[secao]` (Perfil, Segurança, Ajuda e as demais seções)
   - `/dashboard/conta/avaliacoes`
   - `/dashboard/conta/excluir`

   Com a chave `piloto`, o `AuthGuard` libera essas rotas já no 1º quadro, com o usuário conferido no servidor. A página sai pronta no HTML.
2. **A casca lê usuário e modo pelos hooks do quadro (A4).** Os hooks centrais `useViewMode` (`lib/roles.ts`) e `useDisplayUser` (`lib/demo/demo-mode.tsx`), e a `MobileTabBar`, passam a usar `useUsuarioAtual()` / `useModoAtual()` quando há sessão do servidor. Assim o 1º quadro do servidor e o da hidratação desenham o mesmo usuário e o mesmo modo. Sem sessão do servidor (site público, chave `off`), tudo continua no store, como antes.
3. **Por que o resto da casca já hidrata igual.** No zustand 5, durante a hidratação, o `useStore` usa o `getInitialState()` como snapshot do servidor. Então quem lê o store direto desenha "sem usuário" no servidor e também no 1º quadro do cliente. Só depois da hidratação o componente passa ao valor guardado no navegador. A conta guardada no navegador nunca entra no 1º quadro.

## Inventário H6 (casca e as 5 telas)

Leituras de `window`, `localStorage`, `matchMedia` e datas que **ficaram dentro de `useEffect` ou de handler**. Nenhuma roda no 1º render.

| Arquivo | Leitura | Onde |
|---|---|---|
| `dashboard-shell.tsx` | `window.addEventListener(FOTO_ATUALIZADA)`; eventos dos contadores, `focus` e `setInterval` | `useEffect` |
| `dashboard-shell.tsx` | `window.location.search` (`?demo=`) | `useEffect` |
| `dashboard-shell.tsx` | `localStorage` (`vn-push-token`), `window.location.assign` | handlers (sair, trocar modo) |
| `dashboard-shell.tsx` | `Date.now()` (contadores) | `useEffect` |
| `menu-cascata.tsx` | `localStorage` (`vn-menu-aberto`) | `useEffect` e handler |
| `perfil-tela.tsx` | `window.matchMedia("(min-width: 1024px)")`; `window.addEventListener` | `useEffect` |
| `sino-avisos.tsx` | `Date.now()`, `new Date()`, `window.addEventListener` | `useEffect` e handlers |
| `conta/page.tsx` | `window.matchMedia`, `window.location` (computador → Perfil) | `useEffect` |
| `demo-mode.tsx` | `sessionStorage` (store do modo demonstração) | `persist`; na hidratação, o zustand usa o estado inicial |
| `dashboard/page.tsx` | `new Date()` | componente de **servidor** (sem hidratação) |

## Prova (lab local, build de produção, carga fria, contexto novo, sessão real)

O spec é `tests/e2e/specs/t1608-e793-onda1-piloto.spec.ts`. Ele roda com `PAINEL_SESSAO_SERVIDOR` igual no servidor e no Playwright.

| Ponto | Com `piloto` (HEAD) | Antes |
|---|---|---|
| 1. HTML do servidor (JS desligado) com o conteúdo próprio da tela e sem `auth-guard-carregando` | ✓ nas 4 rotas com conteúdo | ✗ na main `f2a1ae8`: o HTML de `/dashboard` não tem `inicio-dono` |
| 2. TPCU ≤ 300 ms, sem esqueleto em nenhum quadro | ✓ **0 ms** em todas, a 390 e 1280 px | ✗ na main: 932 a 1034 ms até o nome no Perfil (t1601) |
| 3. Zero erro de hidratação (`/Hydration\|did not match\|Minified React error #(418\|423\|425)/`, em console e pageerror) | ✓ | Controle: uma divergência proposital na casca faz o teste falhar com `pageerror: Minified React error #418`. Ou seja, o detector pega a forma de produção. |
| 4. Proteção (sem sessão → `/auth?redirect=`; morador em `/admin` → 404) | ✓ | já passava (não-regressão) |
| 5. Troca de conta (localStorage de A, cookies de B): 1º quadro de B, A nunca aparece | ✓ | ✗ sem as peças (`062238ef5`): as iniciais da A ("AP") aparecem num quadro |
| 6. Token vencido (`expires_at` no passado): conteúdo sem `/auth` | ✓ (o HTML já traz o Perfil: o layout viu a sessão renovada) | ✗ na main: o HTML não traz o Perfil |
| 7. Fora do piloto com a chave ligada: `/dashboard/imoveis`, `/dashboard/leads` (Onda 3), `/dashboard/favoritos`, `/dashboard/candidaturas` (Onda 4), `/admin`, `/admin/usuarios` | ✓ HTML de hoje e zero erro de hidratação | — |
| 8. Chave `off`: as rotas voltam ao esqueleto (rollback) | ✓ (mesmo build, chave `off`) | — |
| 9. O HTML do painel não vai para cache compartilhado (`Cache-Control` sem `public`, com `private`/`no-store`) | ✓ | — |
