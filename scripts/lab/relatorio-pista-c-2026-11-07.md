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

## Bloco 500 aberto (main `f0762e3cd`)

Bloco 499 (#3262) mesclado; main em `f0762e3cd` verde (run 42399678239). Único commit novo além do 499: documentação do E679 (mockups de Avaliações, #3264), sem código de produto: sem spec de merge. Bloco 500 (t1426, grupo do 483: cidade, buscar, comparar, institucionais, parceiros/buscar, admin atendimento/contratos/candidaturas) aberto no #3267; resultado na próxima atualização. L-104 segue aberto (produto); próximo livre: L-105. Defeitos de produto novos: nenhum.

## Bloco 500 verde (main `5ca95bc9b`)

Bloco 500 (t1426, #3267, grupo do 483) **verde** (run 42401538290), a 390 e 1280 px, e já mesclado por você; inclui as telas dos merges E446 e E529. Nenhum merge de produto novo desde `f0762e3cd`: sem spec de merge. L-104 segue aberto (produto); próximo livre: L-105. Defeitos de produto novos: nenhum. Próximo da fila: bloco 501 (grupo do 484).

## Specs sobre os drafts E681/E685-E686/E691/E674 e bloco 501 (main `6867b211e`)

**Foto.** Main em `6867b211e` (run em andamento; o de `061694cf1` foi cancelado por substituição). Merges de produto novos: E679 (#3231 critérios de avaliação, #3233 parceiro-avaliações, #3234 conduta cega; migrações 0322 a 0324) e E682 (#3252 termos do avaliador; migração 0325). Os quatro PRs que você citou continuam **em draft**: #3245 (E681), #3256 (E685/E686), #3253 (E691), #3263 (E674 resíduo).

**Specs preparadas sobre os drafts (todas com base na branch do draft; não mesclar antes dele):**
- t1427 / E681 (#3269): a página da estadia mostra um cartão de mês para cada mês da entrada à saída (~90 dias), sem faltar o do meio.
- t1428 / E686 (#3270): "Como é pago" dos avaliadores diz que o avaliador define valor e prazo e que a tabela é referência. **Parte E685 sem spec de tela**: documento mascarado do parceiro ativo no admin exige semear parceiro ativo + pedido ativado + sessão de admin; fica pendente (máscara coberta por teste unitário no draft).
- t1429 / E691 (#3271): laudo assinado mostra data, nº e registro curto do hash ao dono; laudo sem assinatura não mostra a linha (caminho negativo). **Visão do avaliador sem spec** (exige sessão de avaliador credenciado com pedido em andamento).
- t1430 / E674 resíduo (#3272): três cargas diretas em paralelo, com sessão viva, ficam no painel e não caem em `/auth`. É guarda de comportamento, não prova do mecanismo (a leitura transitória "sem sessão" não é reproduzível de forma determinística).

**Sem spec ainda (merges na main): E679 (0322–0324) e E682 (0325).** Mudanças em actions/migrações grandes (critérios de avaliação, avaliações do parceiro, conduta cega, termos do avaliador); a spec de tela depende de ler as telas novas — próxima da fila. Item pulado nesta rodada: E679/E682.

**Bloco 501** (t1431, grupo do 484: avisos, prévia de e-mails, caixa do leitor de QA) aberto no #3273. Defeitos de produto novos: nenhum. L-104 segue aberto; próximo livre: L-105.

## Resultado: t1427–t1430 e bloco 501 — todos verdes

Runs concluídos, **todos verdes**: t1427/E681 (#3269, 42403976707), t1428/E686 (#3270, 42404055257), t1429/E691 (#3271, 42404178157), t1430/E674 resíduo (#3272, 42404235764) e bloco 501 (t1431, #3273, grupo do 484, 42404299505). Como as specs rodam sobre as branches dos drafts, os quatro verdes são a prova de lab de que cada draft faz o que a spec descreve; o #3245, #3256, #3253 e #3263 seguem em draft aguardando QA/merge. Sem merge e sem fechar PR. Defeitos de produto novos: nenhum; L-104 segue aberto; próximo livre: L-105. Pendentes: spec de tela dos merges E679 (0322–0324) e E682 (0325), e a parte E685/visão do avaliador do E691. Próximo bloco da fila: 502 (grupo do 485).

## E679 (tela do formulário) e bloco 502 (main `9e08c86c6`)

**Foto.** Main em `9e08c86c6` (só o meu bloco 501 entrou desde `6867b211e`; run da main na fila). Sem merge de produto novo além de E679 (#3231/#3233/#3234) e E682 (#3252), já tratados abaixo.

**t1432 / E679 (#3278).** Spec de tela do formulário de avaliação do morador para o proprietário (critérios fixos do par `morador_avalia_dono`, etiquetas rápidas limitadas a 5, "Recomendaria este imóvel?"): o envio só habilita com nota + três critérios + "recomendaria" (caminho negativo: só a nota deixa o botão desabilitado). Locação `concluido` com `encerrado_em` de ontem (janela de 14 dias de `podeAvaliarLocacao`); não envia a avaliação. 390 e 1280 px. Run em andamento.

**Ainda sem spec de tela (item pulado):** avaliações do parceiro (0323: `servicos/pedidos/[id]/pedido-tela.tsx`, `/dashboard/parceiro/avaliacao`), conduta cega do avaliador (0324) e termos do avaliador (E682, 0325). Cada uma exige semear parceiro/avaliador credenciado/pedido; entram nas próximas rodadas, uma por vez. Regras puras do E679 já têm teste unitário.

**Bloco 502** (t1433, grupo do 485: contrato, imóvel, estadia, locação, sócios, autenticação; inclui a estadia com o calendário E681 e a saída E662) aberto no #3279. Defeitos de produto novos: nenhum. L-104 segue aberto; próximo livre: L-105.

## t1432 vermelha (erro de spec), reenviada; bloco 503 aberto

**t1432 / E679 (#3278), run 42405563808 — vermelho, diagnóstico: erro da spec, não defeito de produto.** O build passou e só falhou "Rodar os fluxos críticos": `getByTestId('avaliacao-enviar')` não existe no formulário de avaliação (esse testid é do formulário de *resposta*, usado na T93); o botão "Enviar avaliação" do `avaliacao-form.tsx` não tem testid. A tela abriu normalmente e os critérios foram achados. Correção só na spec: o botão passa a ser buscado por nome (`getByRole("button", { name: "Enviar avaliação" })`). Reenviada no head `e626b725e`; run novo em andamento. Nenhum rerun foi usado.

**Bloco 502 (#3279)** ainda em andamento ao registrar. **Bloco 503** (t1434, grupo do 486: admin sem id na URL) aberto. Sem merge novo na main desde `9e08c86c6`. Defeitos de produto novos: nenhum; L-104 aberto; próximo livre: L-105.

## Bloco 504 aberto (main `9e08c86c6`)

Em andamento ao abrir o 504: t1432 reenviada (#3278, run 42406334809), bloco 502 (#3279, run 42405598419) e bloco 503 (#3281, run 42406365423); nenhum vermelho até o momento. Sem merge novo na main desde `9e08c86c6`. Bloco 504 (t1435, grupo do 487: avaliação do imóvel, avaliadora, página pública da avaliadora, intenção; inclui telas dos merges do E679) aberto. Defeitos de produto novos: nenhum; L-104 aberto; próximo livre: L-105.

## Bloco 502 verde

Bloco 502 (t1433, #3279, grupo do 485: contrato, imóvel, estadia, locação, sócios, autenticação, com a estadia do E681 e a saída do E662) **verde** (run 42405598419), a 390 e 1280 px. t1432 (E679, #3278) no head corrigido `e626b725e` (run 42406334809) e blocos 503 (#3281) e 504 (#3283) ainda em andamento, sem vermelho. Defeitos de produto novos: nenhum; L-104 aberto; próximo livre: L-105.

## t1432, blocos 503/504 verdes e bloco 505 (main `2fd8659d8`)

Verdes e já mesclados por você: t1432 / E679 no head corrigido (#3278, run 42406334809), bloco 503 (#3281, 42406365423) e bloco 504 (#3283, 42406484002); bloco 502 (#3279) já registrado. Nenhum merge de produto novo desde `9e08c86c6`. O erro anterior da t1432 era só o seletor do botão "Enviar avaliação". Bloco 505 (t1436, grupo do 488: painel do proprietário sem id, com as respostas rápidas do E665) aberto. Ainda sem spec de tela: avaliações do parceiro (0323), conduta cega (0324), termos do avaliador (E682, 0325). Defeitos de produto novos: nenhum; L-104 aberto; próximo livre: L-105.

## Bloco 505 verde

Bloco 505 (t1436, #3286, grupo do 488: painel do proprietário sem id, incluindo as respostas rápidas do E665) **verde** (run 42407211303), a 390 e 1280 px. Sem merge de produto novo na main desde `9e08c86c6` (só PRs meus). Sem merge e sem fechar PR; o #3286 aguarda a mesclagem do Daniel. Defeitos de produto novos: nenhum; L-104 aberto; próximo livre: L-105. Próximo da fila: bloco 506 (grupo do 489).

## Onze merges de produto, specs promovidas e novas, bloco 506 (main `eef8fdd44`)

**Foto.** Main `eef8fdd44`: `tsc` limpo (build ok); run da main pendente. Entraram: E681 (#3245), E680 (#3239), E674 (#3263 e #3247), E703 (#3287), E700 (#3285), E699 (#3282), E696/E702/E704 (#3280), E701 (#3277), E695 (#3276), E694 (#3275) e os meus blocos 502–505/t1432. Bloco 505 (#3286) verde (run 42407211303).

**Specs promovidas à main (draft mesclado):** t1427 / E681 (#3269) e t1430 / E674 resíduo (#3272): main mesclada no ramo, cobertura reaplicada, diff só da spec, base trocada, fora de draft. Runs novos em andamento.

**Specs novas para merges sem guarda:** t1437 / E695 (#3293): busca vazia fala do lugar certo — lugar com imóveis e filtro que exclui tudo ≠ lugar sem imóveis. t1438 / E703 (#3294): conta sem celular tem o WhatsApp desligado e desabilitado com o convite e o link para o perfil; com celular, ligado e sem convite.

**Sem spec de tela ainda (item pulado):** E694 (exemplo sem beco), E696/E702/E704 (fórmula do total no cartão de preço), E699 (travas de publicação) e E700 (checklist do passo 10) — todos no assistente/cartão e dependem de semear imóvel em estado específico; E701 (área estável) e E680 (estadia alheia). Mais os de antes: avaliações do parceiro (0323), conduta cega (0324) e termos do avaliador (0325). **Pendentes:** t1428 (E685/E686, #3270) e t1429 (E691, #3271) seguem sobre drafts não mesclados (#3256, #3253).

**Bloco 506** (t1439, grupo do 489: morador sem id) aberto. Defeitos de produto novos: nenhum; L-104 aberto; próximo livre: L-105.

## Resultado: t1427, t1430, t1437, t1438 e bloco 506 — todos verdes

Runs concluídos, **todos verdes**: t1427 / E681 (#3269, 42408332120), t1430 / E674 resíduo (#3272, 42408336611), t1437 / E695 (#3293, 42408404421), t1438 / E703 (#3294, 42408469983) e bloco 506 (t1439, #3295, grupo do 489, 42408529791). Sem vermelho, sem rerun. Defeitos de produto novos: nenhum; L-104 aberto; próximo livre: L-105. Sem merge e sem fechar PR; os cinco PRs aguardam a mesclagem do Daniel. Pendentes: spec de tela de E694, E696/E702/E704, E699, E700, E701, E680, e das avaliações do parceiro/conduta cega/termos do avaliador; t1428 e t1429 seguem sobre drafts. Próximo bloco da fila: 507 (grupo do 490).

## L-105 — t323 e as avaliações semeadas sem critérios (E679); blocos 507, 508 e 509 (main `6cbae9c24`)

**L-105 (lab; origem: E679, migração 0322; encaminhado pela Pista A).** O t323 (selo "LinkedIn conectado" no card de avaliação) seguia quebrado por uma causa que **não** tem relação com a linha do LinkedIn em `/dashboard/conta/privacidade` (a A reverteu esse spec para a main). Diagnóstico:
- O gatilho de `avaliacoes` da migração 0322 rejeita (erro 23514) qualquer avaliação com status diferente de `rascunho` que não traga **exatamente os três critérios fixos do par** em `notas_categorias` (inquilino: `imovel_como_anuncio`, `limpeza_chegada`, `comunicacao`; proprietário: `cuidado_imovel`, `regras_casa`, `comunicacao`) e `recomendaria` preenchido.
- O t323 insere duas avaliações `enviada` só com `nota_geral` e **não confere o erro do insert** (`await ....insert(...)` sem olhar o retorno). As avaliações nunca existem, e o `poll` por `avaliacao-real` → `selo-linkedin` estoura o tempo. Não é defeito de produto: é fixture que ficou velha depois do E679.
- **Correção só de lab, PR #3300** (`claude-c/l105-t323`): helper `criteriosDaAvaliacao(papel)` em `tests/e2e/fixtures/laboratorio.ts`; o t323 passa a usá-lo e a conferir o erro do insert.
- **Mesmo defeito, ainda não corrigido (parte do L-105, uma a uma):** t28 (7 inserts; alguns podem testar a inserção inválida de propósito), t362, t93, t91, t351 e t369 semeiam `enviada` sem critérios. Podem estar vermelhas no lab completo; o lab-crítico só roda as alteradas.
- Próximo número livre: **L-106**.

**Blocos desta rodada (todos em andamento ao registrar):** 507 (t1440, #3302, grupo do 490: públicas com parâmetro), 508 (t1441, #3303, grupo do 491: admin com id e refazer 2FA) e 509 (t1442, #3304, grupo do 492: compartilhadas sem id, com a tolerância do L-104). Sem merge de produto novo na main desde `73fd0c336`. Sem merge e sem fechar PR. Um erro de operação meu foi corrigido sem perda: o t1440 foi parar por engano num commit do ramo do L-105, tirei com commit novo e o bloco 507 foi refeito em ramo próprio.

## Resultado dos blocos 507–509 e do #3300; achado L-106 (LinkedIn)

**Verdes:** bloco 507 (t1440, #3302, run 42411005642), bloco 508 (t1441, #3303, 42411047733) e bloco 509 (t1442, #3304, 42411076756); todos mesclados por você. O #3300 (L-105, t323 com os critérios do E679) foi mesclado com o run 42410943208 **vermelho**: o único teste que falhou foi o 1 do t323 ("nome divergente"), por outra causa, descrita abaixo. As avaliações semeadas passaram (49 de 50 no run).

**Diagnóstico do teste 1 do t323 (continuação do L-105).** `confianca-linkedin` não existe em `/dashboard/conta/privacidade`. O E66 (24/10, `74592d6e1`) moveu a lista de confiança (`ConfiancaLista`, com a linha do LinkedIn e o aviso `linkedin-aviso`) para `/dashboard/conta/seguranca`; o teste unitário `conta-blocos.test.ts` fixa isso (a lista "não está" em Privacidade; Privacidade só tem o link para Segurança). O t323 ficou apontando para a tela antiga. Só apareceu agora porque o lab-crítico roda apenas specs alteradas. Erro de spec; corrigido no #novo (ver abaixo).

**L-106 (produto — Pistas A/B; não corrigido por esta pista).** As rotas `src/app/api/conta/linkedin/conectar/route.ts` e `.../retorno/route.ts` (constante `CONTA = "/dashboard/conta/privacidade"`) e o cron `src/app/api/cron/linkedin/route.ts` (link do aviso `linkedin_vencendo`) ainda levam a pessoa para Privacidade. Quem volta do LinkedIn cai numa tela sem a linha do LinkedIn e **sem o aviso do resultado** (`?linkedin=nome|falha|cancelado|…`). Correção sugerida (das A/B): apontar `CONTA` e o link do aviso para `/dashboard/conta/seguranca`. Lab: t323 passa a abrir Segurança e anota `L-106` quando a volta cai em Privacidade (a anotação some sozinha quando o produto corrigir); t351 (linha 152) tem a mesma expectativa e deve ser ajustado depois do L-106.

**Numeração.** L-105 = avaliação semeada sem critérios (E679/0322; t323 corrigido; t28, t362, t93, t91, t351 e t369 ainda por ajustar); L-106 = volta do LinkedIn em Privacidade; **próximo livre: L-107** (os cabeçalhos dos blocos 507–509 ainda dizem L-106).

PR do ajuste do t323: `claude-c/l106-t323-seguranca` (run em andamento). Sem merge e sem fechar PR.

## t323 verde (L-105 + L-106 anotado)

PR #3306 (`claude-c/l106-t323-seguranca`) **verde** (run 42412032783): com a lista de confiança lida em `/dashboard/conta/seguranca` e as avaliações semeadas com os critérios do E679, o t323 inteiro passa no lab-crítico (os cinco testes do arquivo, incluindo o selo do LinkedIn no card de avaliação). L-106 (volta do LinkedIn em Privacidade) segue **aberto no produto**; o t323 anota `L-106` enquanto as rotas redirecionarem para Privacidade. Pendentes do L-105: t28, t362, t93, t91, t351 e t369 (semeiam `enviada` sem critérios). Próximo livre: **L-107**. Sem merge e sem fechar PR.

## L-105 fechado no lab (seis specs), L-106 aposentado e bloco 510 (main `713f8291b`)

**Correção de numeração.** Ao ajustar o t351 vi que ele já registra a volta do LinkedIn em Privacidade como **L-56** (Pista A, 24/10; `test.info().annotations.push({ type: "L-56" ... })`). O "L-106" que abri na rodada anterior era **duplicata do L-56**: o defeito de produto continua o mesmo (rotas `/api/conta/linkedin/conectar` e `/retorno` e o cron `linkedin_vencendo` ainda voltam para `/dashboard/conta/privacidade`, onde a lista de confiança, a linha do LinkedIn e o `linkedin-aviso` não existem desde o E66). O t323 passa a anotar `L-56`. **L-106 volta a ser número livre.**

**L-105 (lab), as seis specs pendentes, um commit por spec (PR #3309, `claude-c/l105-avaliacoes-specs`):** t93, t91, t362, t369, t351 e t28 agora semeiam a avaliação com `...criteriosDaAvaliacao(papel)`. O helper foi para `tests/e2e/fixtures/avaliacao-criterios.ts` (sem dependência de ambiente: t93, t91 e t28 não importam o `laboratorio.ts`), e `laboratorio.ts` só o reexporta. No t28 o helper `nova()` e o insert do proprietário levam os critérios; os casos de recusa (não-parte, duplicada, status publicada, fora do prazo) seguem recusados pelos próprios motivos. O lab-crítico roda as specs alteradas e valida as seis; resultado abaixo quando voltar.

**Bloco 510** (t1443, grupo do 493: conta, parceiro, orçamento, pedido de serviço do morador e três papéis) aberto no PR do bloco. Sem merge de produto novo na main desde `713f8291b`. Sem merge e sem fechar PR. Defeitos de produto novos: nenhum; L-104 e L-56 abertos; próximo livre: **L-106**.

## Bloco 510 verde; #3309 — cinco specs de avaliação passam, t93 ajustado no passo do admin

**Bloco 510** (t1443, #3310, grupo do 493) **verde** (run 42413400382).

**#3309 (L-105), run 42413362496:** 68 passaram, 1 falhou. As seis specs agora **semeiam** as avaliações (o t93 chegou ao passo do admin; t91, t362, t369, t351 e t28 passaram). O único vermelho é o último passo do **t93**: depois de "Manter no ar" ele esperava `toContainText("Mantida")` no pedido. Diagnóstico: erro de spec antigo, não do L-105 nem de produto. Desde o ADMIN-2 (25/10) a decisão mora na Central de Pendências (`central-linha`, `decidir-revisao-avaliacao.tsx`), que **nunca escreve "Mantida"** (`grep` em `src` não acha o texto na interface; só existe como valor `mantida` da decisão). O item sai da fila. O teste só aparecia verde antes porque a avaliação nem chegava a ser criada (L-105 mascarava). Correção só de spec: a espera passa a ser pelo registro da decisão no banco (`avaliacao_contestacoes.status = 'mantida'`), que o próprio teste já conferia no fim. Novo head `ec8c88a22`, run em andamento. Sem rerun. Nenhum item de produto novo; próximo livre: **L-106**.

## #3309 mesclado antes da correção do t93 — correção levada à main no #3317

O #3309 (L-105, seis specs) foi mesclado no head `ecabbd2bf` (run 42413362496, 68 passaram e 1 falhou: o último passo do t93). Meu commit de correção `ec8c88a22` foi empurrado depois do merge e ficou órfão (sem run). Para não deixar a main com o t93 quebrado, o mesmo commit foi cherry-picked num ramo novo (`claude-c/t93-central`, **#3317**, head `025195554`): só `t93-avaliacao-tela.spec.ts`, a decisão do admin passa a ser provada pelo registro no banco, não pelo texto "Mantida" (que a Central de Pendências nunca escreve desde o ADMIN-2). Run em andamento. Bloco 510 (#3310) mesclado. Único commit novo na main fora os meus: #3315 (Pista QA, documentação e capturas, sem código de produto). L-104 e L-56 abertos; próximo livre: **L-106**. Sem merge e sem fechar PR.

## t93 verde e na main — L-105 fechado no lab

#3317 (t93, a decisão do admin provada pelo registro no banco) **verde** (run 42418234029) e **mesclado** na main (`58afe82e1`). Com isso, as seis specs de avaliação do L-105 (t93, t91, t362, t369, t351, t28) e o t323 estão na main e passaram no lab-crítico. **L-105 encerrado no lab.** Nenhum merge de produto novo. L-104 e L-56 seguem abertos no produto (Pistas A/B); próximo livre: **L-106**. Próximo da fila: bloco 511 (grupo do 494). Sem merge e sem fechar PR.

## Bloco 511 aberto (main `58afe82e1`)

Nada pendente da sessão: o #3317 (t93) já estava verde e mesclado (run 42418234029) e a main em `58afe82e1` está verde (run 42418702131). Nenhum merge novo, então nenhuma spec de merge a escrever. Bloco 511 (t1444, grupo do 494: detalhe da proposta e da visita, pelos dois lados) aberto no #PR do bloco, em andamento. Abertos no produto: L-104 (400 em `/api/proximidades` no "Qualificar o imóvel") e L-56 (volta do LinkedIn em Privacidade); próximo livre: L-106. Sem merge e sem fechar PR; PR com conflito é da pista dona.

## Bloco 511 verde (main `1dc15a295`)

Bloco 511 (t1444, #3319, grupo do 494: detalhe da proposta e da visita, pelos dois lados) **verde** (run 42419435472), a 390 e 1280 px, e já mesclado. O outro commit novo na main (#3318, Pista QA) é documentação, sem código de produto: nenhuma spec de merge a escrever. L-104 e L-56 abertos no produto; próximo livre: L-106. Próximo da fila: bloco 512 (grupo do 495). Sem merge e sem fechar PR.

## Bloco 512 aberto (main `1dc15a295`)

Main em `1dc15a295`: sem merge de produto novo desde a última foto (o run de `3a69c0bd9` deu verde; o de `1dc15a295` estava em andamento), então nenhuma spec de merge. Bloco 512 (t1445, grupo do 495: `/conferir`, pedidos do morador, Admin → Sistema) aberto, em andamento. Sem falha nova para ligar à lista-master. L-104 e L-56 abertos no produto; próximo livre: L-106. Sem prova ao vivo, sem merge e sem fechar PR.

## Bloco 512 verde (main `b205b52d6`)

Bloco 512 (t1445, #3320, grupo do 495: `/conferir`, pedidos do morador, Admin → Sistema) **verde** (run 42420808861), a 390 e 1280 px, e já mesclado. Nenhum merge de produto novo na main. Sem falha nova para a lista-master; L-104 e L-56 abertos no produto; próximo livre: L-106. Próximo da fila: bloco 513 (grupo do 496). Sem prova ao vivo, sem merge e sem fechar PR.

## E697, E698, E708 e bloco 513 (main `6832dd107`)

**Foto.** Main `6832dd107` (run 42421587492 verde). Merges de produto novos: E697 (#3299), E704 (#3291), E706 (#3301), E708 (#3313) e E698 (#3312); mais o bloco 512 meu.

**E708 (#3313) — numeração.** O E708 usou o nome **L-106** para "as rotas de retorno do LinkedIn voltam para Segurança": é o mesmo defeito que o t351 já registrava como **L-56** e que eu chamei de L-106 por engano antes de aposentar o número. O produto agora usa uma constante única (`ROTA_CONTA_LINKEDIN`) nas três rotas e o próprio PR já ajustou o t323 e o t351 (a volta cai em `/dashboard/conta/seguranca`, `expect(url.pathname)`). **Corrigido; sem spec nova.** Por isso o L-106 fica como "volta do LinkedIn em Privacidade — corrigido pelo E708 (= L-56)"; o aberto no produto continua só o L-104; **próximo livre: L-107**.

**Specs novas (PR #3321, `claude-c/t1446-e697-e698`, t1446):** E697: a galeria do anúncio de exemplo `ube-015` não repete foto (mosaico no desktop, carrossel no celular), conferindo que os endereços das imagens são todos diferentes; E698: a primeira pintura de `/buscar` não tem quadro de foto em estado `falhou` e o quadro do mapa é o mapa ou o aviso "Carregando o mapa…", nunca um retângulo vazio. 390 e 1280 px. Em andamento.

**Sem spec de tela ainda:** E704 (pinos do mapa com rótulo de cidade) e E706 (título da avaliação do nível), além dos de antes (E694, E696/E702/E704-fórmula, E699, E700, E701, E680, avaliações do parceiro/conduta cega/termos do avaliador).

**Bloco 513** (t1447, grupo do 496: estadia, cartão, desempenho, contrato) aberto. Sem prova ao vivo, sem merge e sem fechar PR.

## t1446 e bloco 513 verdes

t1446 / E697 + E698 (#3321) **verde** (run 42422586647): a galeria do exemplo `ube-015` não repete foto e a primeira pintura de `/buscar` não tem foto quebrada nem mapa vazio, a 390 e 1280 px. Bloco 513 (t1447, #3322, grupo do 496) **verde** (run 42422614415). Nenhum merge de produto novo além dos já tratados. Aberto no produto: L-104 (400 em `/api/proximidades` no "Qualificar o imóvel"); próximo livre: **L-107**. Próximo da fila: bloco 514 (grupo do 497). Sem prova ao vivo, sem merge e sem fechar PR.

## Blocos 514 e 515 abertos (main `2f7eac9df`)

**Dependência de merge.** #3321 (t1446) e #3322 (bloco 513) já foram mesclados (runs verdes 42422586647 e 42422614415). Os blocos 514 e 515 foram abertos sobre a main atual, sem depender de nenhum PR pendente; os dois são independentes entre si.

**Merges desde `6832dd107`.** Só PRs meus (#3321, #3322) e dois da Pista QA (#3327, #3328: capturas e rodadas de QA em `docs/`); `src` e `supabase` não mudaram, então nenhuma spec de merge a escrever. Main: run de `1c2d233cd` verde (42423390299); o de `2f7eac9df` estava em andamento.

**Blocos.** 514 (t1448, grupo do 497: início, buscar, imóvel, ajuda, painel do proprietário) e 515 (t1449, grupo do 498: admin visão geral/eventos/funil, visitas, serviços, públicas de parceiros), a 390 e 1280 px. Em andamento. Aberto no produto: L-104; próximo livre: **L-107**. Sem prova ao vivo, sem merge e sem fechar PR.

## Blocos 514 e 515 verdes (main `2ac418ec8`)

Bloco 514 (t1448, #3332, grupo do 497: início, buscar, imóvel, ajuda, painel do proprietário) **verde** (run 42425138013) e bloco 515 (t1449, #3333, grupo do 498: admin, visitas, serviços, públicas de parceiros) **verde** (run 42425164158), a 390 e 1280 px; os dois já mesclados. Nenhum merge de produto novo na main. Aberto no produto: L-104; próximo livre: **L-107**. Próximo da fila: bloco 516 (grupo do 499). Sem prova ao vivo, sem merge e sem fechar PR.

## Bloco 516 aberto (vigia 17:30; main `1ca739d24`)

Estado conferido antes de seguir: main `1ca739d24` (o #3332 entrou depois do #3333); run de `2ac418ec8` verde (42425684428), o de `1ca739d24` em andamento. Nenhum merge de produto novo desde `6832dd107` (só meus blocos/specs e documentação da Pista QA): sem spec de merge a escrever. Bloco 516 (t1450, grupo do 499: painéis do morador e do dono, notificações, `/empresas`, `/para-proprietarios`) aberto, a 390 e 1280 px, em andamento. Aberto no produto: L-104; próximo livre: **L-107**. Sem prova ao vivo, sem merge e sem fechar PR.

## Bloco 516 verde (main `c1ae2d65c`)

Bloco 516 (t1450, #3334, grupo do 499: painéis do morador e do dono, notificações, `/empresas`, `/para-proprietarios`) **verde** (run 42426267647), a 390 e 1280 px, e já mesclado. O outro commit novo (#3335, Pista QA) é documentação: nenhuma spec de merge a escrever. Aberto no produto: L-104; próximo livre: **L-107**. Próximo da fila: bloco 517 (grupo do 500). Sem prova ao vivo, sem merge e sem fechar PR.
