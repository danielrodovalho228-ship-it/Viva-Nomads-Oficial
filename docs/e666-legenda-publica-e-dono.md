# E666 — por que a legenda nova não chegou à produção, e o lado do dono

## Diagnóstico
- O **#3087 está na `main`** e foi para produção: a legenda pública virou **"Indisponível (já reservado ou fechado pelo proprietário)"** (um item só, com as duas causas no texto) e ganhou a linha "Dias na cor clara estão livres para pedir…".
- A **separação em dois itens, "Ocupado (já reservado)" e "Bloqueado pelo proprietário"**, está no **#3250**, que é **rascunho aguardando QA e NÃO foi mesclado** (verde no CI, sem conflito com a `main`). Enquanto ele não entrar, a página pública continua com um item só. Não há falha de deploy: o código novo simplesmente não está na `main`.
- **O que fazer:** o chat principal mesclar o #3250 (lado público).

## Lado do dono (este PR)
Na edição do anúncio (`BlockCalendar`) o dono já via "Estadia com contrato" (barra verde) e os dias bloqueados, mas o rótulo curto "Bloqueado" não dizia de quem era e nada explicava a diferença. Agora:
- legenda: **"Bloqueado por você ou de outro site"** (o bloqueio importado de outro calendário aparece igual ao manual; ao tocar, o aviso já diz "Veio do calendário de outro site");
- barra: **"Ocupado: estadia com contrato (toque para abrir)"**;
- uma linha fixa: "Ocupado: estadia com contrato. Bloqueado: dia que você fechou (ou que veio do calendário de outro site)."
- `LegendaCalendario` ganhou o parâmetro opcional `rotulos` (rótulo próprio por marca numa tela); as outras telas seguem com o da grade única.

## Resíduo: distinção por DIA na grade do dono
- Cada dia de estadia com contrato agora é marcado na grade como **"Ocupado (estadia com contrato)"** (verde-pálido), separado do **"Bloqueado por você ou de outro site"** (vermelho, riscado). Antes só havia a barra verde sobre a grade e o dia ficava sem marca própria.
- Um dia bloqueado e ocupado ao mesmo tempo mostra o bloqueado (maior prioridade) e o leitor de tela diz as duas coisas.
- O leitor de tela lê as mesmas palavras da legenda (`CalendarioMes` ganhou `rotulos`, como a legenda).
- A barra verde continua; sua legenda virou "Barra verde: estadia com contrato (toque para abrir)".
- Não consegui ver a grade do dono renderizada: ela não aparece no demo local (precisa de imóvel real). A prova é por teste e tipos; conferência visual fica para o laboratório e a QA.
