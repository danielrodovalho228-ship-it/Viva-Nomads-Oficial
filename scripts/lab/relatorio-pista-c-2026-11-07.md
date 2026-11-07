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
| 468 | t1379 | #3174 | 451 (t1362) | verde, run 42362324361 |
| 469 | t1380 | #3175 | 452 (t1363) | verde, run 42362348976 |
| 470 | t1381 | #3177 | 453 (t1364) | verde, run 42363887694 |
| 471 | t1382 | #3179 | 454 (t1365) | verde, run 42364888902 |
| 472 | t1383 | #3181 | 455 (t1366) | verde, run 42365089033 |
| 473 | t1384 | #3185 | 456 (t1367) | verde, run 42366225064 |
| 474 | t1385 | #3187 | 457 (t1368) | verde, run 42367145795 |

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

### Specs de draft — estado (conferido em 07/11, nenhuma foi fechada nem alterada)
Todas estão com o lab-crítico verde no PR de spec (base = branch do draft) e **aguardam o QA do chat principal e o merge do draft correspondente**; depois do merge do draft, a spec é rebaseada na `main`.
| Spec | Item | PR da spec (base) | Draft de produto | Estado do draft |
|---|---|---|---|---|
| t1340 | E664 emergência no dia da chegada | #3104 (`claude-b/e664-emergencia-chegada`) | #3090 | aberto, rascunho |
| t1343 | F47 alvos de toque do Fechamento | #3111 (`claude-a/f47-fechamento-alvos`) | #3096 | aberto, rascunho |
| t1344 | E660 ficha congela no contrato (migração 0316) | #3112 (`claude-b/e660-ficha-dentro`) | #3085 | aberto, rascunho |
| t1345 | E663 jornada de mensagens | #3113 (`claude-b/e663-jornada-mensagens`) | #3089 | aberto, rascunho |
| t1349 | E667 modelo de negócio sem faixa 31+ | #3119 (`claude-a/e667-modelo-31`) | #3117 | aberto, rascunho |
| t1357 | E668 papel parceiro só se escolhido (migração 0318) | #3138 (`claude-b/e668`) | #3134 | aberto, rascunho |
| t1358 | E669 laudo validado e removível (migração 0319) | #3139 (`claude-b/e669`) | #3135 | aberto, rascunho |

### Merges novos na `main` (07/11, depois de 27855dc92) e cobertura
| Merge | O que | Cobertura no lab |
|---|---|---|
| #3083 (`301624b00`) | E657: `reenviada_em` (migração 0315); a lista mostra o último envio | t1331 estendida (PR #3077): lead criado em 04/11 e reenviado em 06/11 mostra "Enviada em 06/11/2026" com a marca "Reenviada" |
| #3145 (`0b7916bce`) | E414 complemento: "Medir depois" como botão próprio em toda tela que mede | t1351 estendida (PR #3125): botão visível, "Medição adiada…", nada gravado |
| #3144 (`2c411b3c6`) | E477 resíduo: observadora da QA só leitura em Pendências, Fotos de perfil e Imóveis | t1390 nova (PR do branch `claude-c/t1390-e477`): Imóveis (sem "Pausar", com "Só leitura"; admin comum mantém "Pausar"). Pendências e Fotos de perfil: só teste unitário do PR |
Lab da `main`: #3144 (`2c411b3c6`) verde; #3145 cancelado pelo push seguinte; #3083 (`301624b00`) conferido ao fechar o bloco.

### Lote das 11:10 (07/11) — resultado
Verdes: bloco 474 (#3187, run 42367145795); t1331/E657 (#3077, run 42367029779); t1351/E414 (#3125, run 42367014027); t1390/E477 (#3186, run 42367090634).
t1391/E677 (#3188): 1ª rodada (run 42367518202) vermelha por **infra** — "Subir o Supabase local" caiu em ~1 min e os fluxos foram pulados (a spec nem rodou). Rerun único disparado.

### Specs sobre drafts da Pista B (base = branch do draft; não mesclar antes do draft)
| Item | PR do draft | Spec | PR da spec | Observação |
|---|---|---|---|---|
| E677 ordem das propostas | branch `claude-b/e677-numero-orcamento` | t1391 | #3188 | rerun único em curso |
| E673 "Disponível a partir de" | #3163 | t1392 | #3189 | em andamento |
| E671 saída no e-mail | #3161 | — | — | o próprio PR já ajusta a t57; sem spec nova |
| E672 comparativo do aditivo | #3162 | — | — | fica para depois (precisa de aditivo proposto pela tela) |
| E674 troca de conta | #3166 | — | — | fica para depois (porta de QA com duas contas) |
| E675 feedback da assinatura | #3171 | — | — | fica para depois (duplo envio de assinatura com código) |
| E676 faixa de crítico | #3167 | — | — | fica para depois (contrato pendente + sino) |

## Lote seguinte (main `cf52190ca`)

Main: só o #3195 (ajuste de lab da Pista D, t181) entrou desde `301624b00`; nenhum merge de produto novo, então nenhuma spec de merge a criar.

| Item | PR | Resultado |
|---|---|---|
| Bloco 475 (t1386) | #3190 | verde (run 42368603159) |
| t1391 — E677, ordem estável das propostas (sobre draft) | #3188 | verde (run 42369498067) após correção da fixture (`lead_id` por proposta) |
| t1392 — E673, disponível a partir de (sobre draft) | #3189 | verde (run 42369470690) após `periodo` no contrato semeado |
| t1393 — E678, scroll-padding-top do assistente (sobre draft) | #3192 | verde (run 42369627441) |
| t1394 — E670, resumo do candidato sem traço solto (sobre draft) | #3193 | verde (run 42370237800) |
| t1395 — E676, faixa de crítico confere a situação do contrato (sobre draft) | #3194 | verde (run 42370297097) |
| Bloco 476 (t1387, grupo do bloco 459) | #3196 | em andamento |

Defeitos de produto novos: nenhum (L-103 segue livre). Drafts da Pista B ainda sem spec: E672 (#3162), E674 (#3166), E675 (#3171); o caminho do aditivo do E676 também fica pendente.

## Lote das specs sobre drafts (E667, E675) e blocos 476/477 (main `95dade132`)

Main verde em `95dade132` (run 42371785428). Nenhum merge de produto novo desde `301624b00`: só ajustes de lab (#3195, `f3f3b8ff6`) e o bloco 476 (#3196).

| Item | PR | Resultado |
|---|---|---|
| Bloco 476 (t1387) | #3196 | verde; mesclado |
| Bloco 477 (t1388, grupo do bloco 460: detalhe da proposta e da visita) | #3197 | verde (run 42371849987) |
| t1396 — E667, /modelodenegocio sem "31+ segue em 6%" (sobre o draft #3117) | #3198 | em andamento |
| t1397 — E675, reenvio de quem já assinou vira sucesso (sobre o draft #3171) | #3199 | em andamento |

Defeitos de produto novos: nenhum (L-103 livre). Drafts ainda sem spec: E672 (#3162), E674 (#3166), E662 tela (#3164), E661 (#3114/#3133), E668 (#3134), E530b (#3132); os de alvo de toque 44 px (#3096, #3172, #3176, #3180, #3184) e as auditorias 160–177 (leitura que falha não vira "não encontrado") ficam para triagem.
