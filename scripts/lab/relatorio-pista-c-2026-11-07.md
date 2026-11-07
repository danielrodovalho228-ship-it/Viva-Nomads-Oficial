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

## Lote t1397–t1399 e blocos 478/479 (main `57d2a5503`)

Main: só blocos meus (#3197, #3200) entraram; nenhum merge de produto novo. Run da main em `57d2a5503` em andamento ao fechar este lote (o de `a96a7a8e0` deu verde).

| Item | PR | Resultado |
|---|---|---|
| Bloco 478 (t1389, grupo do 461: conferir, pedidos, admin/sistema) | #3200 | verde (run 42372952868); mesclado |
| t1396 — E667 (sobre #3117) | #3198 | verde (run 42372803589) |
| t1397 — E675 (sobre #3171) | #3199 | verde (run 42372888517) |
| t1398 — E672 (sobre #3162) | #3201 | verde (run 42373485653) |
| t1399 — E674, troca de conta no navegador (sobre #3166) | #3202 | em andamento; cobre o store, não a porta de QA (`/qa/entrar`, exige servidor extra como a t596) |
| Bloco 479 (t1400, grupo do 462: solicitações, cartão, estadia, desempenho, contrato) | #3203 | em andamento |

Risco registrado na t1399: se a tela de entrada gravar `user: null` no guardado antes da conta B entrar, `estadoAoTrocarDeConta` não enxerga a troca. Se o run vier vermelho por isso, é lacuna do draft #3166 (item novo L-103, origem: t1399), não da spec.

Defeitos de produto novos: nenhum. Drafts ainda sem spec: E662 tela (#3164), E661 (#3114, #3133), E668 (#3134), E530b (#3132), E671 (#3161, coberto pelo ajuste da t57 no próprio PR).

## Merges novos na main (E670, E678, E662 migração, E446, E427) — specs e blocos 479/480

Foto: main passou por `f64e4c671` (E670 #3148), `4a254567d` (E678 #3191), `a9f43e813` (E662 migração #3149, 0320), `62a813196` (E446 #2971), `82f11dedf` (E427 #2978) e o bloco 479 (#3203). Os runs da main em `62a813196` e `82f11dedf` terminaram **cancelados** (substituídos por run mais novo, não vermelho); o seguinte (`762046015`) estava pendente ao fechar.

| Item | PR | Resultado |
|---|---|---|
| t1399 — E674 (sobre #3166) | #3202 | verde (run 42374399771): a conta seguinte não herda o modo da anterior; o risco do `user: null` na tela de entrada não se confirmou |
| Bloco 479 (t1400) | #3203 | verde (run 42374440915); mesclado |
| t1393 — E678, agora na main | #3192 | base trocada para a main, branch com a main mesclada; run novo em andamento |
| t1394 — E670, agora na main | #3193 | idem |
| t1401 — E446, contagem da cidade (spec nova, merge #2971) | #3205 | em andamento |
| Bloco 480 (t1402, grupo do 463, inclui interessados e novo anúncio) | #3206 | em andamento |

Cobertura dos demais merges: E427 já tem t804/t923 (nome igual e nome na página do imóvel); a nova tentativa de leitura do nome (E427 nova-tentativa) só tem unitário; E662 (migração 0320, instrução única de saída) ganha spec de tela quando o draft da tela (#3164) mesclar. Defeitos de produto novos: nenhum (L-103 livre).

## Merges E528/E529 e bloco 481 (main `56a62b079`)

Novos na main: E528 (#3050, painel de preço sem rolagem) e E529 (#3051, barra de comparar). Os dois já trazem as specs atualizadas no próprio merge (t843 e t844) e rodam no lab-crítico da main; sem spec nova a criar. t1401 (E446, #3205) verde (run 42375339282). t1393 (#3192), t1394 (#3193), bloco 480 (#3206) e a main em `56a62b079` ficaram em andamento ao fechar este registro. Bloco 481 (t1403, grupo do 464: admin, visitas, serviços, parceiros) aberto no #3207. Defeitos de produto novos: nenhum (L-103 livre). Spec de tela do E662 aguarda o draft #3164.

## Colheita e bloco 482 (main `2efa62001`)

Verdes: t1393 (#3192, run 42375213154), t1394 (#3193, run 42375216804), bloco 480 (#3206, run 42375384858); t1401 (#3205), bloco 480 e bloco 481 (#3207) já mesclados na main. Runs da main em `56a62b079`/`2c0853c4a` substituídos por mais novos (cancelados, não vermelhos); o de `2efa62001` pendente ao fechar. Bloco 482 (t1404, grupo do 465: candidaturas, favoritos, propostas, locações, mensagens, contratos, leads, orçamentos, públicas; inclui telas do E670/E677/E675) aberto no #3210. Defeitos de produto novos: nenhum (L-103 livre).

## Bloco 482 verde e bloco 483 (main `8eaf146be`)

Bloco 482 (#3210) verde (run 42376349669) e mesclado; main em `2efa62001` verde (run 42376262301), run de `8eaf146be` em andamento. Nenhum merge de produto novo desde `2efa62001`, então sem spec de merge nova. Bloco 483 (t1405, grupo do 466: cidade, buscar, comparar, institucionais, parceiros/buscar, admin atendimento/contratos/candidaturas) aberto no #3218. Defeitos de produto novos: nenhum (L-103 livre).

## Bloco 483 verde e bloco 484 (main `df7417787`)

Bloco 483 (#3218, grupo do 466, com as telas do E446 e do E529) verde (run 42377481986) e mesclado; main em `8eaf146be` verde (run 42377405929), run de `df7417787` em andamento. Nenhum merge de produto novo na foto, então sem spec nova; t1395–t1399 seguem bloqueadas pelos drafts de produto (E676/E677/E672/E674/E675 não mesclados) e puladas. Bloco 484 (t1406, grupo do 467: avisos/desligar, prévia de e-mails, caixa do leitor de QA) aberto no #3220. Defeitos de produto novos: nenhum (L-103 livre).

## Bloco 484 verde e bloco 485 (main `df7417787`)

Bloco 484 (#3220, grupo do 467) verde (run 42378741647); main em `df7417787` verde (run 42378530990). Nenhum merge de produto novo na foto; t1395–t1399 seguem bloqueadas pelos drafts de produto. Bloco 485 (t1407, grupo do 468: contrato, imóvel, estadia, locação, sócios, autenticação) aberto no #3222. Defeitos de produto novos: nenhum (L-103 livre).

## Bloco 486 (main `df7417787`, 07:50)

Bloco 485 (#3222) ainda em andamento (run 42379411068) ao abrir o 486; main sem merge novo desde `df7417787` (verde). Bloco 486 (t1408, grupo do 469: admin sem id na URL) aberto no #3224. Defeitos de produto novos: nenhum (L-103 livre).

## Blocos 484–486 mesclados, E287, caminho negativo do E676 e bloco 487 (main `769f258c6`)

Verdes e mesclados: blocos 484 (#3220), 485 (#3222, run 42379411068) e 486 (#3224, run 42379562391). Merge de produto novo: E287 (#3223, migração 0321 só de dados, com teste de migração próprio em `tests/migracoes/marca-boas-vindas-0321.test.ts`); sem tela, sem spec de lab a criar. Runs da main em `74a33330c`/`769f258c6` pendentes ao fechar.

Caminho negativo (expiração) acrescentado à t1395 (E676, #3194, sobre o draft #3167): proposta de alteração com prazo vencido não mantém a faixa de crítico; dentro do prazo a faixa aparece. Não repeti specs dos demais drafts da Pista B (E671–E677): os caminhos negativos já cobertos são código inventado recusado (t57), faixa que persiste enquanto falta assinatura (t1395) e reenvio de quem já assinou (t1397). Bloco 487 (t1409, grupo do 470: avaliação do imóvel, avaliadora, página pública da avaliadora, intenção) aberto no #3226. Defeitos de produto novos: nenhum (L-103 livre).

## Colheita final da rodada e bloco 488 (main `769f258c6`)

Runs que estavam pendentes, todos verdes: t1395/E676 com o caso de expiração (#3194, run 42380905569; o run anterior `c5c6c1eac` foi cancelado por novo push, não falhou); main em `74a33330c` (run 42379724697) e `769f258c6` (run 42380624163). Nenhum merge novo desde `769f258c6`. Migração 0321 (E287, #3223): `tests/migracoes/marca-boas-vindas-0321.test.ts` rodou local, 4 de 4 verdes; sem regressão, sem spec nova. Bloco 487 (#3226) em andamento; bloco 488 (t1410, grupo do 471: painel do proprietário sem id) aberto no #3227. Defeitos de produto novos: nenhum (L-103 livre).

## Bloco 487 verde, 488 em andamento, bloco 489 (main `769f258c6`)

Bloco 487 (#3226) verde (run 42381032660). Bloco 488 (#3227) ainda em andamento (run 42381486072) ao abrir o 489: registrado, sem vermelho. Main em `769f258c6` verde, sem merge novo desde então; nada a rodar além do que já passou (migração 0321, 4 de 4 locais). Bloco 489 (t1411, grupo do 472: morador sem id na URL) aberto no #3229. Defeitos de produto novos: nenhum (L-103 livre).

## Merges de 07/11, blocos 487–489 mesclados e bloco 490 (main `e45408216`)

Blocos 487 (#3226), 488 (#3227, run 42381486072) e 489 (#3229, run 42381912736) verdes e mesclados; main em `e45408216` verde (run 42382068919). Nenhum merge de produto novo desde `769f258c6`.

Conferência de cobertura dos merges de produto do dia (E414, E446, E477, E427, E528/E529, E649–E657, E662 migração, E670, E678, E287): as specs de E653–E657, E650, E651, E414 e E477 existem, mas estão em PRs de spec ainda abertos em draft (#3077, #3078, #3081, #3082, #3092, #3123, #3124, #3125, #3186) — não mesclados por regra da pista. Sete deles (#3077, #3081, #3082, #3092, #3123, #3124, #3125) estavam em conflito com a main (só o `cobertura.json`, que os blocos mexem a cada rodada); mesclei a main em cada ramo, reapliquei o registro de cobertura, os testes de numeração/cobertura passam (13/13) e os runs novos foram disparados. #3078 (E656) e #3186 (E477) não tinham conflito. E649 (#3015, CPF do parceiro), E662 (migração) e E287 (migração de dados) têm só teste unitário/de migração; spec de tela do E662 espera o draft #3164. Specs de E670/E678/E446 já estão na main (#3193, #3192, #3205); E674/E676/E677 seguem sobre os drafts (#3202, #3194, #3188), conferidas e não duplicadas.

Bloco 490 (t1412, grupo do 473: públicas com parâmetro) aberto no #3232. Defeitos de produto novos: nenhum (L-103 livre).

## Drafts da Pista A/B mesclados, specs promovidas e t1413/t1414 (main `305cb9bd5`)

Entraram na main: E672 (#3162), E673 (#3163), E674 (#3166), E675 (#3171), E676 (#3167), E677 (#3169), E660 (#3085), E661 (#3084 dois blocos, #3114 guia da estadia, #3133 condomínio), E663 (#3089), E664 (#3090), E665 (#3086), E666 (#3087) e o bloco 490 (#3232). Run da main em `305cb9bd5` em andamento ao fechar; runs anteriores verdes.

Specs que estavam sobre esses drafts e foram promovidas (main mesclada no ramo, cobertura reaplicada, base trocada para a main, fora de draft): t1391/E677 (#3188), t1392/E673 (#3189), t1395/E676 (#3194), t1397/E675 (#3199), t1398/E672 (#3201), t1399/E674 (#3202), t1340/E664 (#3104), t1344/E660 (#3112), t1345/E663 (#3113). Runs novos disparados. As sete specs de E414/E477/E650–E657 atualizadas na rodada anterior deram verde (runs 42382779107 a 42382803725).

Specs novas para merges sem guarda de tela: t1413 (E665, modelos de respostas rápidas) e t1414 (E666, legenda do calendário), no #3236. Ainda sem spec de tela: E661 (guia da estadia em blocos, comodidades e condomínio) e E662 tela (#3164 não mesclado). Bloco 490 (#3232) já mesclado. Defeitos de produto novos: nenhum (L-103 livre).

## L-103 — a main não compila: conflito semântico entre E661 (guia/condomínio) e E662 (instrução de saída) — achado de produto

**Sintoma.** Todos os runs do lab-crítico ficaram vermelhos ao mesmo tempo: o da main em `305cb9bd5` (run 42383221233) e os dez PRs de spec recém-atualizados (t1391, t1392, t1395, t1397, t1398, t1399, t1340, t1344, t1345 e t1413/t1414), todos no passo 12, "Build do site (modo simulado)". Nenhuma spec chegou a rodar.

**Diagnóstico (log lido, reproduzido no código da main).**
`src/lib/estadia/instrucoes.ts(140,14): error TS2739` — `GRUPO_DA_INSTRUCAO: Record<ChaveInstrucao, GrupoInstrucao>` não tem cinco chaves de `ChaveInstrucao`: `condominio_wifi_rede`, `condominio_wifi_senha`, `condominio_recepcao`, `condominio_fechadura` (E661 apoio, #3133, commit `3ca4085bd`) e `instrucao_saida` (E662, #3149, commit `f0d49dab7`). Cada PR passou sozinho; a combinação dos merges de #3114 (guia da estadia, que cria o mapa de grupos), #3133 e #3149 quebra o tipo. Não é infra, não é flaky: não faço rerun.

**Efeito.** O lab-crítico fica vermelho em todo PR e em toda push na main até o conserto; os blocos de varredura e as specs novas não rodam. Parei de abrir blocos (o 491 só ficaria vermelho pelo mesmo motivo).

**Item para a lista-master (L-103, produto, Pistas A/B — não corrigido por esta pista).** Incluir as cinco chaves em `GRUPO_DA_INSTRUCAO` (as `condominio_*` no grupo `condominio`; `instrucao_saida` no grupo que o guia da estadia definir) e, se o guia deve mostrá-las, em `TITULO_GRUPO_INSTRUCAO`/ordem dos blocos. Assim que o conserto entrar na main, reencadeio: um único rerun dos runs que ficaram vermelhos e depois o bloco 491, a spec do E661 e o acompanhamento de t1413/t1414.

## Veredito do #3164 pelo lab (L-103) e destravamento

**Veredito: VERDE.** Branch `claude-a/e662-tela-saida` (head `83b11bb3b`, 5 commits à frente da main `305cb9bd5` e 0 atrás): lab-crítico, run **42386061247**, `completed success`; o passo 12 "Build do site (modo simulado)", que falhava na main, **passou**. Conferido também localmente: `tsc --noEmit` na branch sem erro em `src/` nem `tests/` — o `TS2739` em `src/lib/estadia/instrucoes.ts(140,14)` (cinco chaves faltando em `GRUPO_DA_INSTRUCAO`) **sumiu**; a branch tem as chaves `condominio_wifi_rede`, `condominio_wifi_senha`, `condominio_recepcao`, `condominio_fechadura` (grupo `condominio`) e `instrucao_saida` (grupo `saida`, com título "Como sair (check-out)"). Pode mesclar o #3164 antes dos demais.

**Runs bloqueados pela main (só pelo L-103, sem rerun em loop).** Os dez runs vermelhos falharam todos e apenas no passo 12 (build): main `305cb9bd5` (42383221233); t1413/t1414 (#3236, 42383824141); E677 (#3188, 42383632714); E673 (#3189, 42383636552); E676 (#3194, 42383640870); E675 (#3199, 42383645348); E672 (#3201, 42383649578); E674 (#3202, 42383653397); E664 (#3104, 42383657511); E660 (#3112, 42383662161); E663 (#3113, 42383665803). Nenhuma outra causa; nenhum item novo. Status: **bloqueado-pela-main**. Rerun só depois do #3164 na main (um por run, e só do que seguir vermelho).

**Spec nova sobre o #3164.** t1415 (E661 guia em blocos + nota do condomínio; E662 instrução única de saída no guia do morador, lembretes do dono e gravação pela edição do imóvel), PR #3238 em draft com base `claude-a/e662-tela-saida`; não mesclar antes do #3164. Run em andamento.

**Destrava quando o #3164 mergear.** (1) Rerun único dos dez runs acima. (2) t1415 passa a mirar a main (retarget do #3238). (3) Retomo o bloco 491 e o acompanhamento de t1413/t1414. Defeitos de produto novos: nenhum além do L-103.

## Despacho "Code 3": merges E287/E668/E671/E667/E658/E659/E504/E506/E193 e a main ainda bloqueada (L-103)

**Lab (a).** A main avançou para `e0ee5ff29` (dez merges novos, incluindo #3228/#3235 do E287, E668, E671, E667, E658, E659, E504, E506, E193), mas o #3164 **não** foi mesclado: `tsc` na main reproduz o mesmo TS2739 de `src/lib/estadia/instrucoes.ts(140,14)` (cinco chaves faltando). Os runs da main em `1f8f792d1` e `a94306738` foram cancelados por serem substituídos; o de `e0ee5ff29` estava pendente e vai falhar no build pelo mesmo motivo. Sem falha nova: o único vermelho continua sendo o L-103. O veredito verde do #3164 (run 42386061247) segue de pé, e a t1415 sobre ele também deu **verde** (run 42386516939, #3238). Os rerun dos dez runs bloqueados continuam esperando o #3164 na main.

**Varredura (b).** Bloco 491 não aberto: sairia vermelho pelo mesmo build quebrado. Sem achado visual novo.

**Specs dos merges novos (c).**
- #3235/#3228 (E287): t1416 (#3240) cobre a rota `POST /api/admin/pioneiras-e287` só de admin, caminhos negativos (visitante 403, conta comum 403, GET 405), sem enviar nada; o envio e a montagem têm teste unitário (`pioneiras-e287*.test.ts`) e a migração 0321 tem teste próprio. Não há tela nova do E287.
- E668 (#3134), E667 (#3117) e E671 (#3161): as specs que estavam sobre esses drafts foram promovidas à main (main mesclada, cobertura reaplicada, base trocada, fora de draft): t1357/E668 (#3138), t1396/E667 (#3198) e t1349/E667 (#3119). **Atenção:** t1349 e t1396 cobrem o mesmo E667 (a t1396 foi escrita depois e checa o gráfico; a t1349 é a anterior). Não fecho PR por regra da pista; fica para decisão de quem mescla qual delas. E671 já está coberto pelo ajuste da t57 no próprio PR.
- E658, E659, E504, E506, E193: só têm unitário/sem tela nova a testar sem prova ao vivo; sem spec nova.

Defeitos de produto novos: nenhum além do L-103.

## Checagem do L-103 (main `5f76206c8`) e t1416

**L-103 segue aberto.** O #3164 continua aberto (não mesclado) e `tsc` na main `5f76206c8` ainda dá o mesmo `TS2739` em `src/lib/estadia/instrucoes.ts(140,14)` (faltam `condominio_wifi_rede`, `condominio_wifi_senha`, `condominio_recepcao`, `condominio_fechadura`, `instrucao_saida`). O lab segue **bloqueado pelo L-103**: sem rerun dos dez runs bloqueados, sem retarget do #3238 (continua sobre a branch do #3164, verde no run 42386516939) e **sem bloco 491** (sairia vermelho só pelo build quebrado).

**t1416 (E287, #3240).** Run 42387810339 vermelho, e **só** no passo 12 "Build do site" — o mesmo L-103, não a spec. Status: bloqueado-pela-main, sem rerun.

**Merge novo desde `e0ee5ff29`:** E669 (#3135). A spec t1358 (#3139), que estava sobre esse draft, foi promovida (main mesclada, cobertura reaplicada, base trocada, fora de draft); o run novo falhará no build enquanto o L-103 durar. Nenhuma outra spec nova a escrever; defeitos de produto novos: nenhum além do L-103.

## L-103 RESOLVIDO (#3241) — retomada (main `20e6203e8`)

**Foto nova.** O #3241 (`claude-b/fix-tsc-instrucoes`, Pista B) entrou na main; `tsc --noEmit` em `20e6203e8` está **limpo** (sem erro em `src/` nem `tests/`): o `TS2739` de `src/lib/estadia/instrucoes.ts` sumiu. **L-103 encerrado.** Não peço mais o merge do #3164 como desbloqueio (ficou como via anterior; o destino dele é do chat principal). O próximo número livre da lista passa a ser **L-104**.

**Rerun.** Um rerun de run antigo de PR reaproveita o merge-ref feito com a main quebrada e falharia de novo; por isso o "rerun" foi mesclar a main em cada ramo de spec (uma única vez), o que gera um run novo e correto. Quinze ramos: #3188 (t1391/E677), #3189 (t1392/E673), #3194 (t1395/E676), #3199 (t1397/E675), #3201 (t1398/E672), #3202 (t1399/E674), #3104 (t1340/E664), #3112 (t1344/E660), #3113 (t1345/E663), #3236 (t1413/t1414, E665/E666), #3240 (t1416/E287, reavaliada aqui), #3138 (t1357/E668), #3198 (t1396/E667), #3119 (t1349/E667) e #3139 (t1358/E669). Os resultados vão na coleta abaixo.

**t1415 (#3238) NÃO foi retargetada para a main — e por quê.** A spec exercita a tela do E662 (seção "Como sair (check-out)" na edição do imóvel, `estadia-lembretes`), que **só existe na branch do #3164**; `grep` na main não acha `secao-instrucao-saida` nem `estadia-lembretes`. Retargetar traria os 5 commits de produto do #3164 para dentro de um PR de spec. Ela fica com base na branch do #3164 (verde, run 42386516939) e só pode ir à main junto com a tela do E662. Item pulado: t1415 — depende do destino do #3164.

**Bloco 491 retomado.** t1417, grupo do 474 (admin com id: atendimento, contrato, pedido de parceiro, refazer 2FA), #3243.

**Merges novos depois da foto anterior.** Só o #3241 (correção de tipo, sem tela). E669 (#3135) segue coberto pela t1358 (#3139, promovida). E680 (#3239) ainda em draft: sem spec até a CI dele fechar e o PR mesclar (item pulado: E680).

**Duplicidade t1349 (#3119) × t1396 (#3198), ambas do E667 — recomendação, sem fechar PR.** Recomendo **manter a t1396 (#3198)**: lê o mínimo do Gestor e o texto da legenda das fontes únicas (`FAIXAS_COMISSAO_PADRAO`, `GESTOR_TEXTO`), então não quebra se o mínimo mudar, e confere a frase removida ("31+ segue em 6%"). A t1349 tem os mesmos 390/1280 mas hardcoda "20+" e a regex da legenda. Única coisa que só a t1349 checa: nenhuma ocorrência de "31+" na página; se a decisão for manter só uma, vale levar esse `not.toMatch(/\b31\s*\+/)` para a t1396. A decisão final é do chat principal/rotina de merge.

## Colheita após o L-103 e achado L-104 (main `20e6203e8`)

**Dezesseis runs colhidos — quinze verdes.** Todos os ramos de spec que receberam a main nova deram **verde**: #3188 (t1391/E677, 42389635987), #3189 (t1392/E673, 42389640383), #3194 (t1395/E676, 42389645448), #3199 (t1397/E675, 42389648489), #3201 (t1398/E672, 42389653916), #3202 (t1399/E674, 42389658734), #3104 (t1340/E664, 42389664946), #3112 (t1344/E660, 42389667819), #3113 (t1345/E663, 42389672089), #3236 (t1413/t1414, E665/E666, 42389676522), #3240 (t1416/E287, 42389682599 — reavaliada, passou), #3138 (t1357/E668, 42389685976), #3198 (t1396/E667, 42389691803), #3119 (t1349/E667, 42389695620) e #3139 (t1358/E669, 42389698294); bloco 491 (#3243, 42389741496) também verde. O build da main está OK. Nenhum rerun foi necessário.

**Bloco 492 (#3244, run 42390173568) — vermelho por defeito de produto novo: L-104.** Único vermelho; só no passo "Rodar os fluxos críticos" (build passou). 58 passaram, 1 falhou: `T1418 › proprietário — Qualificar o imóvel`, nos dois tamanhos (390 e 1280 px, também no retry), **somente** na classe console: `Failed to load resource: the server responded with a status of 400 (Bad Request) http://localhost:3123/api/proximidades`. As seis classes visuais passaram.
- **Item L-104 (produto, para a lista-master):** o editor do imóvel da massa aberto por `/qualificar?imovel=<id>` volta a chamar `POST /api/proximidades` e levar 400 — o mesmo sintoma do L-99 (editor sem CEP), corrigido pelo E593 (#2714); o bloco 475, com a mesma tela, passou limpo, então regrediu depois. O único código que chama a rota é `src/app/(dashboard)/dashboard/imoveis/novo/page.tsx` (`buscarPerto`). Merges entre o 475 e agora que mexem no editor/assistente: E660 (#3085), E193 (#2956), E506 (#3047), E678 (#3191) e o fix de tipo #3241. Sem bisect por CI; é para as Pistas A/B julgarem. Não corrijo.
- **Tratamento no lab:** a t1418 passou a anotar `L-104` e tolerar **só** esse erro de console nessa tela (comentário no código para remover quando o produto corrigir); qualquer outro erro de console continua falhando. Run novo da t1418 em andamento.
- Próximo número livre: **L-105**.

**Bloco 493 (t1419, grupo do 476) aberto no #3246.** Defeitos de produto novos além do L-104: nenhum.

## Desfecho do bloco 492, #3164 mesclado e blocos 493/494 (main `4ffdb7572`)

**Desfecho do bloco 492 (#3244).** Foi mesclado no head anterior ao commit que anota o L-104 (`a846d5b19`; o ajuste `33ece6ed6` ficou só na branch). Resultado: a t1418 na main ainda falharia só no console de "Qualificar o imóvel" (400 em `/api/proximidades`, L-104). Levei o ajuste para a main num PR novo (**#3248**, `claude-c/l104-t1418`, cherry-pick, só a spec): anota o L-104 e tolera só esse erro nessa tela. O L-104 segue como defeito de produto aberto (Pistas A/B); próximo número livre: **L-105**.

**#3164 mesclado (E662 tela + mapa de grupos).** A t1415 (E661/E662, #3238) foi retargetada para a main (main mesclada no ramo, diff só da spec e da cobertura, fora de draft); run novo em andamento. Mesclados também por você: t1391, t1396, t1397, t1398, t1399, t1413/t1414, t1416, blocos 491 e 492. Nenhum outro merge de produto na foto (`4ffdb7572`); o run da main em `f795c5c5b` deu verde, o de `4ffdb7572` estava em andamento.

**Bloco 493 (#3246).** Estava sem run porque conflitava com a main (só `cobertura.json`, que muda a cada bloco mesclado); mesclei a main e reapliquei o registro. Run novo em andamento. **Bloco 494** (t1420, grupo do 477: detalhe da proposta e da visita, com a ordem do E677) aberto no #3249. Defeitos de produto novos além do L-104: nenhum.

## Colheita final e bloco 495 (main `4ffdb7572`)

Verdes: t1415 (E661/E662, #3238, run 42392179474), L-104 anotado na t1418 (#3248, run 42392154371), bloco 493 (#3246, run 42392196249) e bloco 494 (#3249, run 42392234820). Main em `4ffdb7572` verde (run 42391830751); nenhum merge novo desde então, então sem spec de merge a escrever. L-104 segue aberto (produto, Pistas A/B); próximo número livre: L-105. Bloco 495 (t1421, grupo do 478: conferir, pedidos, admin/sistema) aberto no #3254. Defeitos de produto novos: nenhum.

## Bloco 495 verde e bloco 496 (main `7b5d30e28`)

Bloco 495 (#3254) verde (run 42393066883). Mesclados por você desde `4ffdb7572`: t1415 (#3238), blocos 493 (#3246) e 494 (#3249) e o ajuste L-104 da t1418 (#3248); nenhum merge de produto, então sem spec nova. L-104 segue aberto (produto); próximo livre: L-105. Bloco 496 (t1422, grupo do 479: estadia, cartão, desempenho, contrato) aberto no #3255. Defeitos de produto novos: nenhum.

## Bloco 496 verde e bloco 497 (main `70e2ba5d1`)

Bloco 496 (#3255) verde (run 42393784036) e mesclado, junto com o 495. Nenhum merge de produto novo desde `7b5d30e28`; sem spec nova. Bloco 497 (t1423, grupo do 480: visitante e painel do proprietário, incluindo editar o anúncio) aberto no #3257; se o editor repetir o 400 em `/api/proximidades`, é o L-104, não item novo. Próximo livre: L-105. Defeitos de produto novos: nenhum.

## Bloco 497 verde (main `70e2ba5d1`)

Bloco 497 (#3257, grupo do 480, incluindo interessados, novo anúncio e editar o anúncio) verde (run 42394617497): o editor do anúncio **não** repetiu o 400 em `/api/proximidades`, então o L-104 fica restrito ao "Qualificar o imóvel" (`/qualificar?imovel=`). Nenhum merge de produto novo. L-104 segue aberto (produto); próximo livre: L-105. Próximo bloco da fila: 498 (grupo do 481: admin, visitas, serviços, parceiros).

## Bloco 498 (main `c6f776acd`)

Bloco 497 (#3257) mesclado por você, sem outra mudança de produto na main (só blocos meus desde `70e2ba5d1`): nenhuma spec de merge escrita. Bloco 498 (t1424, grupo do 481: admin visão geral/eventos/funil, visitas, serviços, públicas de parceiros) aberto no #3261, a 390 e 1280 px; resultado do run entra na próxima atualização. Sem merge e sem fechar PR nesta rodada. L-104 segue aberto (produto); próximo livre: L-105. Defeitos de produto novos: nenhum.

## Bloco 498 verde

Bloco 498 (t1424, #3261, grupo do 481) **verde** (run 42395956892), a 390 e 1280 px. Aguarda a mesclagem do Daniel; sem merge e sem fechar PR. L-104 segue aberto (produto); próximo livre: L-105. Defeitos de produto novos: nenhum. Próximo da fila: bloco 499 (grupo do 482).

## Bloco 499 verde (main `e099ae6b6`)

Bloco 499 (t1425, #3262, grupo do 482: candidaturas, favoritos, propostas, locações, mensagens, contratos, leads, orçamentos, públicas) **verde** (run 42396972859), a 390 e 1280 px; inclui telas dos merges E670, E677 e E675. Bloco 498 (#3261) já mesclado. Nenhum merge de produto novo na main desde `c6f776acd` (só blocos meus): sem spec de merge. Sem merge e sem fechar PR. L-104 segue aberto (produto); próximo livre: L-105. Defeitos de produto novos: nenhum. Próximo da fila: bloco 500 (grupo do 483).
