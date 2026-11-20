# E506 — barra "Progresso do cadastro" do /qualificar segue o rascunho

**Defeito (prova pós-merge, 07/11):** rascunho 57% completo → a barra lia 0 na tela 1/5 e subia 2 por tela (2/4/6/8; resultado 10). A correção anterior só considerava respondidas da Qualificação e o essencial confirmado; para esse rascunho as duas frações eram 0, então a barra seguia só os passos (a escala dos passos termina em 10 = onde começa o Passo 1).

**Correção:** `progressoQualificacaoComRascunho` (`assistente-telas.ts`) = o maior entre a barra de antes (passos e respostas) e o **% completo real do rascunho** (`prontidao.pct`, a fonte única do "X% completo" de todas as telas), limitado a 0–100. A página passa `progressoRascunho={prontidao.pct}` à Qualificação. Rascunho vazio: comportamento idêntico ao anterior.

**Prova (código):** `e506-barra-do-rascunho.test.ts` — rascunho 57% lê 57 em todas as 5 telas e no resultado; vazio = antes; nunca regride, trava em 100, ignora NaN/negativo; a tela passa o `prontidao.pct`. Sem prova ao vivo.

**Dúvida:** a barra dos Passos 1–10 segue por passo (Passo 1 = 10%), então um rascunho de 57% lê 57 no /qualificar e 10 ao entrar no Passo 1. Alinhar os dois é decisão de produto (a barra dos passos é "Passo N de 10" por desenho, E89).
