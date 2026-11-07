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
| 437 | t1338 | #3094 | 420 (t1315) | verde, run 42332827229 |
| 438 | t1339 | #3102 | 421 (t1316) | verde, run 42334015848 |
| 439 | t1342 | #3110 | 422 (t1317) | verde, run 42335446406 |
| 440 | t1346 | #3115 | 423 (t1318), admin com id | verde, run 42336442969 |
| 441 | t1347 | #3116 | 424 (t1319), compartilhadas sem id | verde, run 42336504771 |
| 442 | t1348 | #3118 | 425 (t1320) | verde, run 42337566620 |
| 443 | t1352 | #3126 | 426 (t1321) | verde, run 42338943386 |
| 444 | t1353 | #3130 | 427 (t1322) | verde, run 42339536862 |
| 445 | t1354 | #3131 | 428 (t1323) | verde, run 42340010694 |
| 446 | t1355 | #3136 | 429 (t1325) | verde, run 42341800370 |
| 447 | t1356 | #3137 | 430 (t1326) | verde, run 42343316653 |
| 448 | t1359 | #3140 | 431 (t1327) | verde, run 42344128965 |
| 449 | t1360 | #3141 | 432 (t1328) | verde, run 42345926425 |
| 450 | t1361 | #3142 | 433 (t1329) | verde, run 42347366048 |
| 451 | t1362 | #3143 | 434 (t1330) | verde, run 42348039111 |
| 452 | t1363 | #3146 | 435 (t1333) | verde, run 42349095375 |
| 453 | t1364 | #3147 | 436 (t1336) | verde, run 42350134573 |
| 455 | t1366 | #3151 | 438 (t1339) | verde, run 42351735688 |
| 454 | t1365 | #3150 | 437 (t1338) | verde após rerun único (run 42351696195, tentativa 2); a 1ª rodada foi instabilidade de infra (t8-rascunho ×5 e t82 webkit: upload lento das fotos de teste no runner), não defeito do bloco |
| 456 | t1367 | #3152 | 439 (t1342) | verde, run 42352665121 |
| 457 | t1368 | #3153 | 440 (t1346) | verde, run 42353447927 |
| 458 | t1369 | #3154 | 441 (t1347) | verde, run 42354136749 |
| 459 | t1370 | #3155 | 442 (t1348) | verde, run 42354904238 |
| 460 | t1371 | #3156 | 443 (t1352) | verde, run 42355956197 |
| 461 | t1372 | #3157 | 444 (t1353) | verde, run 42355979321 |
| 462 | t1373 | #3158 | 445 (t1354) | verde, run 42356004099 |
| 463 | t1374 | #3159 | 446 (t1355) | verde, run 42357374849 |
| 464 | t1375 | #3160 | 447 (t1356) | verde, run 42358114145 |
| 465 | t1376 | #3165 | 448 (t1359) | verde, run 42359328089 |
| 466 | t1377 | #3168 | 449 (t1360) | verde, run 42360285365 |
| 467 | t1378 | #3170 | 450 (t1361) | verde, run 42360837202 |

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

## Atualização (blocos 438–450 e specs dos merges E414/E650/E651)
Specs na `main` (base `main`): E651 t1341 (#3123, verde), E650 t1350 (#3124, verde), E414 t1351 (#3125, verde).
Specs preparadas sobre drafts (base = branch do draft; rebasear na `main` quando o draft for mesclado): E664 t1340 (#3104), F47 t1343 (#3111), E660 t1344 (#3112), E663 t1345 (#3113), E667 t1349 (#3119), E668 t1357 (#3138), E669 t1358 (#3139) — todas verdes. A t1341 antiga (#3107) está superada pela do #3123.

### Triagem dos vermelhos desta rodada (todos spec, nenhum produto)
| Spec | Sintoma | Causa | Classe |
|---|---|---|---|
| t1334 (E655) | `fechamento-prazo-dias` inexistente | candidatura criada como `new`; o Fechamento só abre com `accepted` | spec errada |
| t1335 (E654) | 2º pedido de código (390 px) não mostrou confirmação | intervalo mínimo entre códigos responde erro visível — é o contrato do E654 | expectativa estreita demais |
| t1341 (E651) | `sp-doc-erro` ausente | o draft #3093 e a versão mesclada (#3023) divergem: erro em `seja-parceiro-erro`, texto "Informe o CNPJ com 14 dígitos" | spec escrita sobre draft superado |
| t1358 (E669) | contagem de laudos sempre 0 | `conferencia_laudos` não tem coluna `id` (chave `conferencia_id`); a consulta falhava | spec errada (e leitura sem `poll` na 1ª tentativa) |

### Auditorias 160–174 (#3098–#3129)
Corrigem a mensagem exibida quando a LEITURA do banco falha. Reproduzir exige derrubar o banco no lab (escopo novo); cobertura = testes unitários escritos antes e vistos vermelhos em cada PR. Sem spec de tela.

### Defeitos de produto
Nenhum item L novo. **L-103 segue livre.**

### Merge novo na `main` desde a46ab219e (E414)
- **#3173** ([Faixa D] t162 e t266 alinhadas ao E452 e ao E495, `27855dc92`): só ajusta duas specs de laboratório existentes; nenhum comportamento de produto novo, logo sem spec nova. Registrado; a varredura segue.
