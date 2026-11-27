# Frente 3: specs que eram verdes e estão vermelhos (laboratório de 12/11, `4d705dee7`)

**Fonte:** `lab_execucoes`. Rodada completa de 12/11 03:13: 85 specs vermelhos em 846. Destes, **36 já estiveram verdes**; os outros 49 nunca estiveram e ficam para o inventário da Frente 6.

**Ambiente:** cada área é reproduzida no **laboratório local**, igual ao do CI: Supabase local com todas as migrações, `alinhar-producao`, `seed-lab`, `massa-varredura`, build com as variáveis do lab e site na porta 3123.

**Atenção à janela:** entre 23/10 e 09/11 os pushes da main não rodaram estes specs (0 passou, 0 falhou). Para eles, "último verde" no banco quer dizer "última vez que rodou".

## Índice por área (um PR por área)

| Área | Specs | Estado |
|---|---|---|
| **busca/home** | t66, t70, t71, t78 | **Este PR** |
| anúncio/cadastro | t38, t40, t64, t77, t79, t88, t161, t176, t186, t195, t204, t288, t292, t295, t296, t389, t707 | a fazer |
| admin | t81, t227, t229, t231, t273, t290 | a fazer (t229, t231 e t273: Central refeita pelo E330/E474, `docs/e744-triagem-falhas.md`) |
| mapa/e-mail/página pública | t112, t692, t839, t840 | a fazer (t112: `prop-passo-anuncie.webp` repetida em /para-proprietarios) |
| conta/contas de teste/parceiros | t39, t236, t241, t250, t286 | a fazer |

## Área busca/home

| Spec | Falha no lab | Causa (com prova) | Classe | Ação |
|---|---|---|---|---|
| t70 (teste 1) | lista com 52,8% da tela (pede ≥ 53%); mapa termina em 1376 px em vez de 1416 | **C1b** (`43836b8f1`, 08/11): a faixa do "Fale com a Viva" (`padding-right` do `.container-page` público) passou a valer no contêiner da /buscar, que usa `lg:px-0`, e a /buscar nem mostra o botão (`ESCONDER`, E95). Desfez a geometria do **E659**. Prova com build de cada commit: `f20f971a0` (anterior) **3 passed**; `43836b8f1` **1 failed**. | **Regressão de código** | O contêiner da busca se marca `data-sem-faixa-flutuante`, e a regra do C1b o deixa de fora. Nenhuma asserção muda. |
| t66 (atalhos) | "Aceita pets" não aparece na home | **E131** (`60a7fba69`, 25/10, decisão "a regra dos exemplos decidida uma vez"): com anúncio real no banco, os exemplos saem também das contagens. A massa do lab só tem studios de 1 quarto a R$ 3.200, então todos os atalhos dão 0 e a seção some. Prova no lab local: `c54097ebc` (anterior) **5 passed**; `60a7fba69` **1 failed**. | **Massa do teste desatualizada pela decisão E131** | O spec passa a criar um anúncio real que cobre cada atalho (`fixtures/massa-filtros-busca.ts`). Nenhuma asserção muda. |
| t71 (9, Limpar tudo) | "Aceita pets" e a pílula de preço desligados | Mesma causa (E131 + massa): chips com 0 imóveis ficam desligados. | Massa desatualizada (E131) | Mesma massa |
| t78 (1280/390/360) | "Máquina de lavar" e "Garagem" desligados | Mesma causa | Massa desatualizada (E131) | Mesma massa |

**Instável?** Não: os quatro falhavam em **todas** as rodadas desde 09/11. Em modo demonstração passam porque lá os exemplos existem.
