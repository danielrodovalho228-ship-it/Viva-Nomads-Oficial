# E679-B, parte 1 — critérios por par na estadia, moderação e "fato falso × caução"

Mockups aprovados pelo Daniel em 07/11/2026. Produção conferida em 07/11/2026: `avaliacoes`, `avaliacao_respostas`, `avaliacao_contestacoes`, `parceiro_avaliacoes` e `vistoria_conduta` têm 0 linhas (migração sem custo de dados).

## O que mudou
- `src/lib/avaliacoes-criterios.ts` (regras puras): critérios fixos dos quatro pares, etiquetas rápidas, "recomendaria", validação inteira da avaliação, regra de "fato falso".
- Migração `0322`: o gatilho `avaliacao_valida` passa a exigir, ao ENVIAR, os 3 critérios do par (1 a 5), "recomendaria" e até 5 etiquetas. Rascunho segue livre. Dado pessoal inclui documento (`contem_documento`) e vai para `em_moderacao`. Gatilho novo recusa pedido de revisão "fato falso" que fale de dano, sujeira, caução ou valor.
- `avaliar()` grava critérios, etiquetas, recomendaria e as duas notas privadas. `pedirRevisaoAvaliacao()` aplica a regra de caução antes de gravar.
- `AvaliacaoForm` recebe os controles funcionais (critérios, etiquetas, sim/não, recados privados). O visual dos mockups é da Pista A.
- Sem edição depois de enviada: já vale desde a 0089 (gatilho recusa UPDATE do cliente fora de rascunho); `tests` confirmam.

## O que NÃO mudou
- Contestação nunca apaga nota legítima: só `ofensa`, `dado_pessoal` e `fato_falso` (verificável) tiram do ar; a decisão é do admin.
- A disputa de caução não lê nenhuma tabela de avaliação (teste de guarda em `avaliacoes-fluxo-e679.test.ts`).
- `ranking_sinais`, `ORDEM_NOVA_ATIVA` e `AUTOMACOES_ATIVO` intocados.

## Dúvidas (leitura conservadora aplicada)
1. A lista de etiquetas rápidas dos mockups não estava acessível a esta pista: usei 6 etiquetas por par, todas neutras ou positivas, no máximo 5 por avaliação. Basta trocar a lista em `ETIQUETAS`.
2. "Fato falso" é barrado por palavras (caução, depósito, dano, sujeira, limpeza, conserto, desconto, devolução…). É deliberadamente conservador: um texto legítimo que cite essas palavras é recusado com a explicação do motivo; o avaliado pode reescrever só com o fato conferível.
3. Specs E2E (lab) que enviam avaliação só com estrelas + comentário passam a precisar dos critérios e do sim/não (Pista C).
