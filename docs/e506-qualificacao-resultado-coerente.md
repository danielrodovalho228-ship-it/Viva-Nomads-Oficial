# E506 (2ª rodada) — resultado da Qualificação coerente

Reprovado no lote 6 (06/11). Desde o E196 `/qualificar` redireciona para a Qualificação do assistente
(`/dashboard/imoveis/novo`); as frases contraditórias do E506 original já saíram (#2428), mas a tela de resultado ainda dizia:

| Sintoma | Causa | Correção |
|---|---|---|
| "Qualificação · pronta" + "Faltam 12 itens" + "ainda sem nível" | rótulo fixo "pronta" no resultado | `rotuloProgressoQualificacao(faltam)`: "pronta" só com 0 faltando; senão "Qualificação · resultado"; rodapé "Resultado da qualificação · a seguir, o Passo 1" |
| "Sim, tem" já confirmado contado como "falta" | o resultado (itens, título, nível) só olhava as respostas da Qualificação, ignorando as confirmações de conforto do rascunho (Passo 5) | `confortoDoResultado(respostas, confirmados)` = respostas ∪ confirmados do rascunho (`conf.marcados`), usado em itens, título e nível |
| Barra "Progresso do cadastro" em 0 na tela 1/5 de rascunho adiantado | fração vinha só das perguntas respondidas | `fracaoDaQualificacao`: maior entre perguntas respondidas e essencial já confirmado |

Teste: `src/lib/anuncio/e506-resultado-coerente.test.ts` (escrito antes, visto vermelho). Escopo `anuncio/*qualific*|e506*|assistente*`: 58/58; `tsc` limpo.

Dúvida: "sobe 0→10 ao pular as 5 telas" (a barra pula de 0 para 10 no resultado) é desenho do `progressoQualificacao`
(Qualificação ocupa os 10% iniciais); não mudei. Não provado ao vivo (é do QA).
