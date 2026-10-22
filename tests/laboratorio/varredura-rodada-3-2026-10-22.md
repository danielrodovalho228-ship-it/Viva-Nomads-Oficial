# Varredura t249 — rodada 3 (22/10, main com 29 telas)

Fonte: lab-crítico do #1046, run [39798048996](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/actions/runs/39798048996), 14h47–14h51 UTC. O commit testado é `91c11bb`: a main `b1385f6` (depois do #1040, #1043 e #1038) mais o #1046, que pôs na varredura três telas do #1038.
Os resultados vêm do log do job, com uma tentativa só (`--retries=1 --fail-on-flaky-tests`). O artefato não abre daqui, porque o proxy bloqueia o servidor de artefatos.

## Resultado da t249

| Bloco | Resultado |
|---|---|
| Varrer a 1280 px | Passou: 29 telas, 1,8 min |
| Varrer a 390 px | Passou: 29 telas, 1,8 min |
| D-V1, D-V2, D-V4, D-V6, D-V7 | Passaram na primeira tentativa |
| D-V3, D-V5, D-V8 | Falha esperada (`test.fail`): seguem abertos com a Pista A |
| Pulados | 0 de 10: a massa rodou e todas as telas foram varridas |
| Instáveis | 0: nenhum teste precisou do retry |

As telas novas, todas com a conta da inquilina, passaram nos cinco critérios nos dois tamanhos:
- Conta · perfil (`/dashboard/conta/perfil`);
- Meus pedidos (`/dashboard/pedidos`);
- Mensagens (`/dashboard/mensagens`).

## Critério b pela régua

Nenhuma sobreposição acusada em nenhuma tela e tamanho. Como pela régua do Muse só conta o que a rolagem não revela, também não houve exceção a registrar.

## Defeitos da rodada 3, um por linha

| Código | Página | Tamanho | Evidência | Novo ou conhecido | Situação |
|---|---|---|---|---|---|
| D-V3 | Editar anúncio ativo (`/dashboard/imoveis/:id/editar`) | 390 | "Enviar documento" não responde e não diz qual campo falta (`test.fail` falhou como esperado, 3,9 s) | Conhecido | Aberto, Pista A |
| D-V5 | Editar anúncio ativo (`/dashboard/imoveis/:id/editar`) | 1280 | "Anúncio publicado" e "Falta para publicar" na mesma tela (`test.fail` falhou como esperado, 4,5 s) | Conhecido | Aberto, Pista A |
| D-V8 | Entrar (`/auth`) | 390 e 1280 | Sem `<main>` (`test.fail` falhou como esperado; combinações `Entrar` anotadas no varrer geral) | Conhecido | Aberto, Pista A |
| D-V1 | Anúncio com 17 fotos (`/imoveis/:id`) | 390 e 1280 | Imagens acima da dobra carregaram sem rolar | Conhecido | Passou: corrigido |
| D-V2 | Cadastro com 0 fotos (`/dashboard/imoveis/novo`) | 390 | A barra "Fotos: 0 de 8" não cobre o conteúdo | Conhecido | Passou: corrigido (sob vigilância) |
| D-V4 | Meus imóveis (`/dashboard/imoveis`) | 1280 | Miniaturas carregadas em 3,7 s, dentro da espera de 5 s do #1040 | Conhecido | Passou: corrigido (sob vigilância) |
| D-V6 | Minhas locações (`/dashboard/locacoes`) | 390 e 1280 | Imagens acima da dobra carregadas | Conhecido | Passou: corrigido |
| D-V7 | Meus imóveis (`/dashboard/imoveis`) | 1280 | Rascunho sem link para a página pública (teste normal desde o #1040) | Conhecido | Passou: corrigido no #1028 |

Defeito novo de produto: nenhum. Falha nova da varredura (laboratório): nenhuma. Instável: nenhum.

## Conta para as 3 rodadas estáveis?

Sim: é a **1ª rodada estável**. Só restaram as três falhas esperadas, sem achado novo e sem retry.

As rodadas anteriores não contam:
- rodada de 22/10: trouxe o D-V8 novo e ruído do critério d;
- laboratório de `28752ee`: o D-V7 passou sem esperar.

Faltam 2 rodadas seguidas assim.

## A suíte em volta

O lab-crítico inteiro passou: 52 de 52, em 3,9 min.
- **t82 webkit e t8 T-RASC-6:** estavam em observação e passaram de primeira.
- **Laboratório completo de `b1385f6`:** ainda rodava quando este relatório foi escrito. A triagem dele (L-1, L-4, L-5, L-6, t185, t132) segue na triagem contínua.

## Veredito

Na main de 22/10, depois do #1040, #1043 e #1038, a t249 só tem as três falhas esperadas da Pista A: D-V3, D-V5 e D-V8. As três telas novas do #1038 entram limpas, e a lista priorizada do `registro-defeitos.md` segue a mesma (renumerada no #1046).
