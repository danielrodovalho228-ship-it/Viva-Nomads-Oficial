# E779 — triagem dos PRs draft da área visual (Pista A) — 09/11/2026

Foto única do estado (GitHub, 09/11). Critério: **mergeável** = verde (`verify`, `lab-critico`, `e2e`), sem conflito com a `main` e com teste ligado; **obsoleto** = já coberto por outro PR/merge; **duplicado** = entrega o mesmo que outro PR aberto. Nenhum merge feito por esta pista. Os ajustes de teste do #3598 que carrego em vários PRs são idênticos ao dele e se unificam quando ele entrar.

| # | PR | Item | Classe | Observação |
|---|---|---|---|---|
| 1 | #3611 | E780 topo da busca | mergeável | prova 390 px com mockup pendente (QA) |
| 2 | #3610 | E781 abas do anúncio | mergeável | prova aba a aba, anúncio real (QA) |
| 3 | #3617 | E782 Avaliações + "Uberlândia" | mergeável | abas sublinhadas (decisão do Daniel, 09/11) |
| 4 | #3618 | E783 foto do cabeçalho | mergeável | reverte a exceção do E55 |
| 5 | #3620 | E784 Voltar ao site | mergeável | 3 caminhos no celular (QA) |
| 6 | #3599 | E777 `resumoEmMeses` | mergeável | sem mudança de valores |
| 7 | #3613 | E774 contato | mergeável | usa os textos-fonte do E776; irmãs de outros fluxos pendentes de decisão |
| 8 | #3583 | E767 rótulo "sem IPTU" | mergeável | `ROTULO_TOTAL_MES` do painel fora do escopo |
| 9 | #3584 | E769 nota do proprietário | mergeável | |
| 10 | #3585 | E773 guia sem /precos | mergeável | volta sozinho com `PRECOS_VISIVEL` |
| 11 | #3586 | E770+E771+E772 /empresas | mergeável | prazo de 7 dias (decisão do Daniel, 09/11) |
| 12 | #3574 | E757 identidade (texto único) | mergeável | CI reexecutando depois do ajuste de teste |
| 13 | #3577 | E758 Avaliação × busca | mergeável | |
| 14 | #3578 | E763 taxas em /parceiros | mergeável | |
| 15 | #3644 | E729 portfólio na categoria | mergeável | constante movida: sem conflito com o #3586 |
| 16 | #3666 | ícones de comodidade | mergeável | |
| 17 | #3589 | E720 resíduo (Estadia confirmada/convidado) | mergeável | |
| 18 | #3535 | E738 voltar único | mergeável | |
| 19 | #3498 | E724 aviso primeiro | mergeável | um `lab-critico` antigo cancelado; o válido está verde |
| 20 | #3530 | E732 contraste do rótulo | mergeável | `text-white/90` (decisão do Daniel, 09/11), sobre a pastilha |
| 21 | #3533 | E734 foco do Esc | mergeável | Pista C tira o `test.fail` do t1486 ao entrar |
| 22 | #3536 | E737 skip link primeiro | mergeável | |
| 23 | #3537 | E736 bordas de campo 3:1 | mergeável | |
| 24 | #3543 | O4 "N Mbps" numa linha | mergeável | resíduo do E715 |
| 25 | #3603 | E778 evidência Superpowers (Pista A) | mergeável (docs) | par: #3637 (Pista B), não duplicado |
| 26 | #3632 | entrega QA + esta triagem (docs) | mergeável (docs) | |
| 27 | #3460 | E712 matriz (home não muda) | mergeável (docs) | única diferença contra a `main`: matriz + ajuste de teste; fora de draft por ação anterior |

**Obsoletos:** nenhum (E723 #3496, E726 #3497, E746/E747/E750, E761, E714, E720 #3455 e E718 #3467 já estão na `main`).
**Duplicados:** nenhum. Sobreposições de arquivo checadas par a par entre os 27: o único conflito (#3644 × #3586, mesmo fim de `regras.ts`) foi resolvido movendo a constante do E729.
**De outra pista na área visual:** #3612 (E768, fotos do detalhe, Pista B): verde, mergeável.

## Ordem de merge sugerida (menos atrito)
1. #3598 (main verde). 2. Independentes: #3611, #3610, #3618, #3620, #3599, #3583, #3584, #3585, #3586, #3577, #3578, #3644, #3666, #3530, #3533, #3536, #3537, #3543. 3. #3617 e #3589/#3535 (mexem em `voltar-painel`/telas do painel; sem conflito hoje). 4. Docs: #3603, #3632, #3460.
