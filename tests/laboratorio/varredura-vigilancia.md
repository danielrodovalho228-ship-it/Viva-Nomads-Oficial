# Varredura t249 — vigilância da próxima rodada

Catraca: nenhuma falha nova na t249 em relação à main. Falha esperada é a que tem código D-V (`test.fail` ou combinação anotada em `ESPERADAS`); qualquer outra é falha nova e vai para o registro (`registro-defeitos.md`).

## Telas varridas (29, a 390 e a 1280 px)

| Conta | Telas |
|---|---|
| Visitante | Início, Buscar, Anúncio com 17 fotos, Cidade, Como funciona, Parceiros, Entrar, Pedido de moradia |
| Dono (DONO17) | Painel, Meus imóveis, Editar anúncio ativo, Fechamento, Contratos, Solicitações, Ferramentas, Carteira |
| Dono sem fotos (DONO0) | Cadastro com 0 fotos |
| Inquilina | Painel, Minhas locações, Locação (contrato completo), Conta, Favoritos, Buscas salvas, Estadia, Conta · perfil, Meus pedidos, Mensagens |
| Parceiro | Painel do parceiro |
| Três papéis | Painel |

Cidade em diante, ferramentas, carteira, favoritos, buscas e estadia entraram no #1022. Conta · perfil, Meus pedidos e Mensagens (telas do #1038) entraram no #1046 e passaram limpas na rodada 3.

## Falhas esperadas (não reprovam)

| Código | Tela | Tamanho | O que acontece | Dono |
|---|---|---|---|---|
| D-V5 | Editar anúncio ativo | 1280 | "Anúncio publicado" e "Falta para publicar" juntos | A |
| D-V8 | Entrar | 390 e 1280 | Sem `<main>` (marco principal) | A |

## Rodadas estáveis

Rodada 3 (lab-crítico do #1046, 22/10): 1ª estável — só D-V3, D-V5 e D-V8. Faltam 2 seguidas.

## Sob vigilância (passaram, mas já falharam)

| Item | O que olhar | Desde |
|---|---|---|
| D-V2 (barra de fotos a 390 px) | Voltou a falhar às 02h42 e 03h58 de 22/10, passa desde 05h07 | 22/10 |
| D-V4 (miniaturas de Meus imóveis) | Instável às 02h42 e 05h07 de 22/10 ("imagem quebrada"); espera de até 5 s no #1040; passou de primeira na rodada 3 (3,7 s) | 22/10 |
| D-V6 (imagens de Minhas locações) | Regra nova sem capa (#1023) | 22/10 |
| D-V7 (rascunho sem link para a página pública) | Corrigido no #1028; virou teste normal | 22/10 |
| Critério a e d com foto fictícia | Deve sumir com o #1016; se voltar, a causa é outra | 22/10 |
| Critério d com arquivo `/_next/static` cancelado | Deve sumir com o #1021 | 22/10 |
| Critério d com leitura `GET /api` cancelada | Regra nova no #1023 (painel e pedido de moradia) | 22/10 |
| t192 (Tributação a 390 px) | Ajuste no #1023: cartão dentro do `<main>` | 22/10 |
| Tempo da spec | 29 telas: 1,8 min por tamanho no lab-crítico da rodada 3 (2 workers); cabe | 22/10 |

## Fora da t249, na mesma triagem

L-1 (t255 F18), L-2 (t28, confirmar o #1019), L-4 (t263 baseline), L-5 (teto de 65 min), L-6 (t248), t185 e t132 (1 ocorrência cada, em observação).
