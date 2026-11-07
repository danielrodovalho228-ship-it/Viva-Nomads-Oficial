# Pista C — relatório de 07/11/2026 (laboratório, testes, varredura)

Escopo: só `tests/e2e` e `scripts/lab`. Nada de produto, migração ou merge. Todos os PRs abaixo são rascunhos para o Muse.

## Lab da `main`
- Head `446308ade` (E653–E657) verde no lab-crítico (run 42325934331). Heads intermediárias foram canceladas por pushes sucessivos (comportamento esperado).
- Nenhuma falha de produto encontrada nesta rodada; **L-103 continua livre**.

## Varredura da página inteira (16ª volta, 390 e 1280 px)
| Bloco | Spec | PR | Grupo repetido | Resultado |
|---|---|---|---|---|
| 433 | t1329 | #3075 | 416 (t1311) | verde, run 42326590652 |
| 434 | t1330 | #3076 | 417 (t1312) | verde, run 42326724882 |
| 435 | t1333 | #3080 | 418 (t1313) | verde, run 42327937113 |
| 436 | t1336 | #3091 | 419 (t1314) | verde, run 42330829683 |
| 437 | t1338 | #3094 | 420 (t1315) | em andamento |

## Specs permanentes dos merges do dia
| Item | Merge | Spec | PR | Resultado |
|---|---|---|---|---|
| E657 | #3057 | t1331 | #3077 | verde (01:30 UTC → 06/11; 03:30 UTC → 07/11) |
| E656 | #3056 | t1332 | #3078 | verde (400 só por tamanho; 415 por tipo; 12 KB passa) |
| E655 | #3061 | t1334 | #3081 | verde após ajuste (ver abaixo) |
| E654 | #3060 | t1335 | #3082 | verde após ajuste (ver abaixo) |
| E653 (F1) | #3038 | t1337 | #3092 | verde (área do parceiro não grava o papel) |

Fora de escopo de tela, cobertos só por teste unitário do produto: E653 F2/F3 (lentidão do servidor), ramo de exceção do E654.

## Falhas de TESTE diagnosticadas e corrigidas no lab
- **t1334 (E655)**: candidatura criada como `new`; o Fechamento só abre com candidatura `accepted`, então `fechamento-prazo-dias` não existia. Corrigido (`accepted`), e a spec passou a gerar o contrato pela tela e conferir `prazo_total_dias = 45`.
- **t1335 (E654)**: o 1280 px passou; o 2º pedido do mesmo usuário (390 px) caiu numa resposta de erro visível (intervalo entre códigos). Isso cumpre o contrato do E654 (confirmação OU erro visível); a confirmação passou a ser exigida só no 1º pedido.
- Watchers (`segue.sh`) morreram sem imprimir resultado em um momento; os runs foram lidos direto da lista de execuções.

## Pendências para o Muse (nenhuma é item L)
- Decidir #2949 (régua de requisição cancelada) e um PR só com o commit `e1ef8e805` (lat/lng da massa).
- Remover o `test.fail` da t1285 quando #2970/#2971 forem para a `main`.
- Produto aberto que toca telas já cobertas: #3083 (data de reenvio da candidatura, tela da t1331), #3084 (E661) e #3085 (E660). Reavaliar t1331 se #3083 mergear.
