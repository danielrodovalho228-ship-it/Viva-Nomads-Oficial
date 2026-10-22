# Varredura t249 — vigilância da próxima rodada

Catraca: nenhuma falha nova na t249 em relação à main. Falha esperada é a que tem código D-V (`test.fail` ou combinação anotada em `ESPERADAS`); qualquer outra é falha nova e vai para o registro (`registro-defeitos.md`).

## Telas varridas (26, a 390 e a 1280 px)

| Conta | Telas |
|---|---|
| Visitante | Início, Buscar, Anúncio com 17 fotos, Cidade, Como funciona, Parceiros, Entrar, Pedido de moradia |
| Dono (DONO17) | Painel, Meus imóveis, Editar anúncio ativo, Fechamento, Contratos, Solicitações, Ferramentas, Carteira |
| Dono sem fotos (DONO0) | Cadastro com 0 fotos |
| Inquilina | Painel, Minhas locações, Locação (contrato completo), Conta, Favoritos, Buscas salvas, Estadia |
| Parceiro | Painel do parceiro |
| Três papéis | Painel |

As 10 últimas de cada lista (cidade em diante, ferramentas, carteira, favoritos, buscas, estadia) entraram no #1022: primeira rodada delas.

## Falhas esperadas (não reprovam)

| Código | Tela | Tamanho | O que acontece | Dono |
|---|---|---|---|---|
| D-V3 | Editar anúncio ativo | 390 | "Enviar documento" (trava da matrícula) não responde nem aponta o campo | A |
| D-V5 | Editar anúncio ativo | 1280 | "Anúncio publicado" e "Falta para publicar" juntos | A |
| D-V8 | Entrar | 390 e 1280 | Sem `<main>` (marco principal) | A |

## Sob vigilância (passaram, mas já falharam)

| Item | O que olhar | Desde |
|---|---|---|
| D-V2 (barra de fotos a 390 px) | Voltou a falhar às 02h42 e 03h58 de 22/10, passa desde 05h07 | 22/10 |
| D-V4 (miniaturas de Meus imóveis) | Instável às 02h42 e 05h07 de 22/10 ("imagem quebrada") | 22/10 |
| D-V6 (imagens de Minhas locações) | Regra nova sem capa (#1023) | 22/10 |
| D-V7 (rascunho sem link para a página pública) | Corrigido no #1028; virou teste normal | 22/10 |
| Critério a e d com foto fictícia | Deve sumir com o #1016; se voltar, a causa é outra | 22/10 |
| Critério d com arquivo `/_next/static` cancelado | Deve sumir com o #1021 | 22/10 |
| Critério d com leitura `GET /api` cancelada | Regra nova no #1023 (painel e pedido de moradia) | 22/10 |
| t192 (Tributação a 390 px) | Ajuste no #1023: cartão dentro do `<main>` | 22/10 |
| Tempo da spec | 26 telas: passa do alvo de 360 s; acompanhar se cabe no lab-crítico | 22/10 |

## Fora da t249, na mesma triagem

L-1 (t255 F18), L-2 (t28, confirmar o #1019), L-4 (t263 baseline), L-5 (teto de 65 min), L-6 (t248), t185 e t132 (1 ocorrência cada, em observação).
