# E784 (reprova de 10/11) — "‹ Voltar ao site" não existia no admin a 1920 px
Causa: a faixa `admin-nav-celular` (que leva o `VoltarAoSite`) tinha `lg:hidden` (E73/E176: "no computador a barra lateral já está aberta"). O E784 trocou o destino do link (última página pública guardada na aba; entrada direta → home; nunca /buscar salvo se foi a página anterior), mas o link continuava só no celular. A 1920 px sobrava o logótipo → home, que falha o caminho 1 (anúncio → admin → volta cai na home).
Correção: a faixa vale em TODAS as larguras (saiu o `lg:hidden`), logo o link está em todas as telas do admin, com a mesma regra de destino (`destinoVoltarAoSite`).
Testes: `src/lib/admin/admin-celular-e73.test.ts` (a faixa não esconde em `lg`) e `ultima-publica.test.ts` (destino); t404 (390 e 1280) passa a exigir a faixa e o link nos dois tamanhos. O fluxo por histórico a 390 px segue na spec do PR #3691 (t1595) — não duplicada; ela cobre os três caminhos (anúncio, home, entrada direta).
Limite: o rastro mora em `sessionStorage` da aba; admin aberto em aba nova sem passar por página pública na mesma aba sai para a home (é o caso "entrada direta"). Sem prova ao vivo.

## Ajuste após o lab-critico (10/11)
O `lab-critico` do PR falhou em `t404 › 390px`: o destino da primeira linha de decisão é `/admin/sistema#backup`, e a spec comparava só `pathname+search` (sem a âncora), então a URL certa nunca "batia" (timeout em `waitForURL`). Não era o link. A spec agora compara com `hash`; guarda em `admin-celular-e73.test.ts`.
