# E744: completude da rodada fatiada de 12/11 e inventário das fatias vermelhas

Este documento só mede e inventaria. Nenhum spec foi corrigido.

**Rodada:** `laboratorio.yml` por disparo manual (`workflow_dispatch`) na main `0cc71c1f6`. Run [43206972603](https://github.com/danielrodovalho228-ship-it/viva-nomads-oficial/actions/runs/43206972603), de 11:11 a 12:14 UTC de 12/11. É a primeira rodada completa depois dos merges de 12/11 (#3732 a #3744 e o E788, #3740) e da Frente 0.

**Fontes:**
- o passo "Conferir a completude" do job `consolidar` (`scripts/lab/conferir-completude.mjs`, que compara o resultado com o `playwright test --list` do mesmo commit);
- a linha da rodada em `lab_execucoes` de produção (consulta somente leitura);
- o mapa de spec → fatia, refeito localmente com `LAB_PESADOS=fora npx playwright test --list --shard=N/16` no mesmo commit. O `--shard` é determinístico, e o mapa bate com o resultado: todos os vermelhos caem nas 12 fatias vermelhas, e nenhum nas verdes.

## Completude

| Medida | Valor |
|---|---|
| Listados (`playwright test --list`) | **4.538** |
| Executados | **4.347** (95,8%) |
| Pulados de propósito (`test.skip` dos specs) | **93** |
| **Não executados** (listados que não rodaram) | **98** |
| Conferência | 4.347 + 93 + 98 = 4.538 ✓ |
| Resultado dos executados | 4.210 passaram, **129 falharam**, 7 instáveis (passaram na nova tentativa) |
| Specs contados | 854 |
| Fatias | **20: 8 verdes** (1, 2, 5, 11, 17, 18, 19 e 20) e **12 vermelhas** (3, 4, 6, 7, 8, 9, 10, 12, 13, 14, 15 e 16) |
| `consolidar` | vermelho, por dois motivos: há fatias vermelhas e há 98 não executados ("❌ teste(s) listado(s) não rodaram") |

**Por que 98 não rodaram.** Nenhuma fatia caiu e nenhuma bateu no teto de tempo. Os 98 são testes de specs **em modo serial** que ficaram para trás depois que um teste anterior do mesmo spec falhou (o Playwright marca o resto da cadeia como "did not run"). Os maiores são:

- t263: 7
- t204: 6
- t288: 5
- t292: 4
- t296: 4
- t337: 4
- t295: 3

Todos são specs da lista abaixo, menos o **t337**, que está verde na rodada e merece uma olhada: 4 testes listados não rodaram nele.

**Pulou próximo de zero?** Não por completo. Os 93 pulados de propósito são `test.skip` declarados, que já existiam: só no laboratório, só num projeto, sem conta. Os 98 não executados desaparecem à medida que os vermelhos seriais forem corrigidos.

## O detector de regressão (verde → vermelho) disparou

A rodada gravou **24 regressões**: specs que já tiveram rodada verde e estão vermelhos agora.

**Cinco delas são novas.** Estavam verdes na última rodada completa (`4d705dee7`, 12/11 03:13) e ficaram vermelhas nesta:
- **t406, t407, t408 e t551** (varredura, visitante na **página do imóvel**): "clique no botão primário sem resposta visível em 3 s" a 1280 px, nas seções regras, "O que tem por perto", "Bom saber" e fotos. As quatro caíram juntas e mostram a mesma tela, então a causa provável é comum, numa das mudanças de hoje na página do imóvel:
  - #3737: a página saiu do `generateStaticParams` e passou a ser dinâmica;
  - #3738 (E795): a barra de seções ficou opaca;
  - #3743 (E786): a faixa de anúncio de teste;
  - #3735: galeria e mapa.

  **Ainda não reproduzido.** Pela regra, não se abre correção antes de um teste determinístico falhando na main.
- **t373** (Conta, dados): a data de nascimento não grava. Esperado `1991-03-14`, recebido `null`. Também não reproduzido.

As outras 19 regressões já estavam vermelhas antes desta rodada.

## O que os merges de 12/11 resolveram

Saíram da lista de vermelhos **20 specs**:

- **Os 17 que os PRs de 12/11 tratavam** (#3733, #3734, #3735, #3736 e #3737): t600, t66, t70, t71, t78, t112, t839, t229, t231, t273, t290, t81, t39, t236, t241, t250 e t286. Os 17 estão **verdes**, como se esperava no inventário da Frente 6.
- **Mais três que voltaram ao verde:** t227, t389 (instável) e t439.

Os totais mudaram assim:
- **specs vermelhos:** de **85** para **71**;
- **falhas:** de **148** para **129**.

## Inventário das fatias vermelhas

**Colunas:**
- **Falhas:** quantos testes do spec falharam nesta rodada.
- **Último verde:** a última rodada em que o spec passou inteiro; "—" quer dizer nenhuma.
- **Vermelho desde:** o começo da sequência vermelha atual. "09/11" é a primeira rodada fatiada: antes dela, esses specs não rodavam, como mostra a Frente 6.
- **Erro:** o primeiro erro registrado em `falhas`.


### Fatia 3/20: 2 spec(s), 3 falha(s)

| Spec | Falhas | Último verde | Vermelho desde | Erro |
|---|---|---|---|---|
| t161 | 1 | 08/11 | 08/11 | calendário: a legenda 'Indisponível' não aparece |
| t176 | 2 | 08/11 | 09/11 | ube-001 390 px: tempo do teste (90 s) esgotado |

### Fatia 4/20: 3 spec(s), 3 falha(s)

| Spec | Falhas | Último verde | Vermelho desde | Erro |
|---|---|---|---|---|
| t186 | 1 | 07/11 | 07/11 | do CEP ao anúncio publicado: `waitForURL` esgota (30 s) |
| t195 | 1 | 01/11 | 01/11 | fila de matrículas do admin: o resumo lido não traz o texto esperado |
| t204 | 1 | 29/10 | 29/10 | IA real: `ia-fotos-falha` não aparece (60 s) |

### Fatia 6/20: 1 spec(s), 38 falha(s)

| Spec | Falhas | Último verde | Vermelho desde | Erro |
|---|---|---|---|---|
| t245 | 38 | — | 20/10 | visual: 01-home-390 com 5.350 px diferentes (e mais 37 imagens) |

### Fatia 7/20: 6 spec(s), 21 falha(s)

| Spec | Falhas | Último verde | Vermelho desde | Erro |
|---|---|---|---|---|
| t263 | 6 | — | 22/10 | visual: página do imóvel 390×13.462 contra referência de 11.728 |
| t271 | 11 | — | 22/10 | visual: /admin 1280 com 28% dos pixels diferentes |
| t288 | 1 | 23/10 | 23/10 | cadastro: o passo esperado é 'Quanto custa por mês?', mas abre 'Título e descrição' |
| t292 | 1 | 23/10 | 09/11 | mesmo sintoma do t288 (ordem dos passos do cadastro) |
| t295 | 1 | 23/10 | 09/11 | elo mais fraco: `nivel-tenho-ar_sala` continua marcado |
| t296 | 1 | 23/10 | 23/10 | cartão com o nível: o texto esperado não aparece no cartão 'Studio Essencial' |

### Fatia 8/20: 6 spec(s), 6 falha(s)

| Spec | Falhas | Último verde | Vermelho desde | Erro |
|---|---|---|---|---|
| t316 | 1 | — | 09/11 | regra dos 3 em 30 dias: a Correção do parceiro não fica 'fechada' |
| t318 | 1 | — | 09/11 | selo = barra = página: esperado `proprietario`, recebido `morador` |
| t328 | 1 | — | 09/11 | rascunho retomado: `documento-enviar` escondido |
| t331 | 1 | — | 09/11 | `notif-categorias` não encontrado |
| t346 | 1 | — | 09/11 | calendário importado: a busca mostra o imóvel na data ocupada |
| t348 | 1 | — | 09/11 | o HTML do selo de vínculo contém valor em R$ ou 'salário' |

### Fatia 9/20: 13 spec(s), 13 falha(s)

| Spec | Falhas | Último verde | Vermelho desde | Erro |
|---|---|---|---|---|
| t38 | 1 | 23/10 | 09/11 | o 21º imóvel publicado não aparece em Meus imóveis |
| t40 | 1 | 23/10 | 09/11 | Novo anúncio → passo 1: tempo do teste (90 s) esgotado |
| t370 | 1 | — | 09/11 | `papel-morar-toggle` desligado (o clique esgota o tempo) |
| t373 | 1 | 12/11 03:13 | 12/11 12:14 | **NOVO:** a data de nascimento não grava (esperado 1991-03-14, recebido null) |
| t386 | 1 | — | 09/11 | passo 1: `previa-titulo` mostra 'Título ainda não definido' |
| t388 | 1 | — | 09/11 | varredura: Contrato da estadia, clique no primário sem resposta em 3 s |
| t397 | 1 | — | 09/11 | prova anterior à regra: o texto do prazo 'Refaça a foto…' diverge |
| t400 | 1 | — | 09/11 | 'Não tem internet': esperado `nao_tem`, recebido `radio` |
| t401 | 1 | — | 09/11 | revisão: 'Falta: aceite do termo da IA' |
| t405 | 1 | — | 09/11 | E60 390 px: `fale-com-a-viva-raiz` escondido |
| t406 | 1 | 12/11 03:13 | 12/11 12:14 | **NOVO:** varredura, visitante na página do imóvel (regras): clique no primário sem resposta em 3 s |
| t407 | 1 | 12/11 03:13 | 12/11 12:14 | **NOVO:** varredura, visitante na página do imóvel ('O que tem por perto'): idem |
| t408 (também na fatia 10) | 1 | 12/11 03:13 | 12/11 12:14 | **NOVO:** varredura, visitante na página do imóvel ('Bom saber'): idem |

### Fatia 10/20: 7 spec(s), 7 falha(s)

| Spec | Falhas | Último verde | Vermelho desde | Erro |
|---|---|---|---|---|
| t408 (também na fatia 9) | 1 | 12/11 03:13 | 12/11 12:14 | **NOVO:** varredura, visitante na página do imóvel ('Bom saber'): idem |
| t435 | 1 | — | 09/11 | E104 390 px: o Passo 3 não fica em cartão branco |
| t442 | 1 | — | 09/11 | 'Fotos de perfil em revisão' não aparece no painel |
| t456 | 1 | — | 09/11 | troca de tipo: 'Salvo' não aparece |
| t464 | 1 | — | 09/11 | `inicio-dono-foto` não aparece |
| t465 | 1 | — | 09/11 | `admin-decisoes` não encontrado |
| t469 | 1 | — | 09/11 | os botões do passo 'Tipo' vazam para o lado a 390 px |

### Fatia 12/20: 6 spec(s), 6 falha(s)

| Spec | Falhas | Último verde | Vermelho desde | Erro |
|---|---|---|---|---|
| t534 | 1 | — | 09/11 | depois do CEP o passo é 'Adicione as fotos', não 'Detalhes do imóvel' |
| t547 | 1 | — | 09/11 | `cadastro-titulo` não recebe o texto do modelo |
| t548 | 1 | — | 09/11 | declarações do Passo 10 voltam `null` do rascunho |
| t551 | 1 | 12/11 03:13 | 12/11 12:14 | **NOVO:** varredura, visitante na página do imóvel (fotos, E177): clique no primário sem resposta em 3 s |
| t564 | 1 | — | 09/11 | Passo 5: esperadas 23 pílulas de comodidade, recebidas 0 |
| t585 | 1 | — | 09/11 | e-mail da véspera sem 'Abrir no mapa: https://' |

### Fatia 13/20: 8 spec(s), 9 falha(s)

| Spec | Falhas | Último verde | Vermelho desde | Erro |
|---|---|---|---|---|
| t64 | 1 | 23/10 | 09/11 | novo anúncio a 1280 px: `novo-resumo` não aparece |
| t590 | 1 | — | 09/11 | `espaco-procura` vazio em vez de `coworking` |
| t597 | 1 | — | 09/11 | limpeza × renovação: 0 pedidos em vez de 1 |
| t621 | 2 | — | 09/11 | E218: o checklist do dono novo não aparece |
| t622 | 1 | — | 09/11 | 'Meus imóveis' com um rascunho a 390 px: elemento fixo sobre o conteúdo |
| t644 | 1 | — | 09/11 | `conta-menu-lateral` não encontrado |
| t655 | 1 | — | 09/11 | observador: `foto-aprovar` não aparece na fila de teste |
| t656 | 1 | — | 09/11 | administradora liberada: o texto mostra 'Plano Gestor…' |

### Fatia 14/20: 7 spec(s), 7 falha(s)

| Spec | Falhas | Último verde | Vermelho desde | Erro |
|---|---|---|---|---|
| t678 | 1 | — | 09/11 | o dono aprova: o campo 'Prazo total em meses' não existe |
| t683 | 1 | 10/11 | 10/11 | UFU no 'Tempo até': esperado < 650, recebido 1.083 (instável: alterna) |
| t692 | 1 | 12/11 02:12 | 12/11 03:13 | galeria: `fetchpriority=high` na 1ª foto não encontrado (instável: alterna) |
| t693 | 1 | — | 09/11 | Publicar: esperado `publicou`, recebido `esperando` |
| t696 | 1 | — | 09/11 | Passo 10: a tela do merge (`conferencia-tipo`) não aparece |
| t697 | 1 | — | 09/11 | 3 quartos e Pessoas vazio: esperado '6', recebido `undefined` |
| t707 | 1 | 12/11 01:11 | 12/11 02:12 | `sizes` 25vw em vez de 50vw (instável: alterna) |

### Fatia 15/20: 9 spec(s), 13 falha(s)

| Spec | Falhas | Último verde | Vermelho desde | Erro |
|---|---|---|---|---|
| t77 | 2 | 23/10 | 09/11 | 'Ver todas' das comodidades: o `h3` não aparece |
| t79 | 1 | 23/10 | 09/11 | a página publicada não mostra 'Acesso: Fechadura com senha' |
| t735 | 1 | — | 09/11 | o cartão da parceira não aparece na busca por categoria |
| t739 | 1 | — | 09/11 | o cartão `lia-limpeza-t739-*` não aparece |
| t772 | 2 | — | 09/11 | `visita-video-abrir` não existe |
| t778 | 2 | — | 09/11 | visita por vídeo: tempo do teste (90 s) esgotado |
| t799 | 2 | — | 09/11 | Passo 6: a regra não tem ícone |
| t800 | 1 | — | 09/11 | Passo 4: `cartao-numeros` não aparece |
| t816 | 1 | — | 09/11 | bairros em grade par: altura 1.160 px, esperado < 580 |

### Fatia 16/20: 4 spec(s), 4 falha(s)

| Spec | Falhas | Último verde | Vermelho desde | Erro |
|---|---|---|---|---|
| t88 | 1 | 22/10 | 23/10 | abas presas ao rolar: posição −2.895, esperado ≥ 115 |
| t840 | 1 | 12/11 01:11 | 12/11 02:12 | pins sobrepostos depois do zoom (instável: alterna) |
| t886 | 1 | — | 09/11 | /dashboard/conta/perfil: `sino-parceiro` não aparece no topo do parceiro |
| t909 | 1 | — | 09/11 | a linha do reembolso não aparece a 390 px |

## Causas agrupadas

O mesmo spec pode aparecer em mais de um grupo.

| Grupo | Specs | Causa (provável, não reproduzida aqui) |
|---|---|---|
| **Cadastro (`/qualificar`)**: o rascunho não guarda o passo anterior, ou a ordem dos passos mudou | t186, t288, t292, t328, t386, t400, t401, t435, t456, t469, t534, t547, t548, t564, t693, t696, t697, t799, t800, t40, t64 | Uma causa comum é provável; a Frente 6 já apontou isso. O t288 e o t292 esperam "Quanto custa por mês?" onde hoje abre "Título e descrição": a ordem dos passos mudou e os specs não acompanharam. |
| **Página do imóvel** | t406, t407, t408 e t551 (**novos**), t88, t77, t79, t176, t161, t692 e t707 (os dois últimos instáveis) | Os novos vieram de mudanças de 12/11 (ver o detector). O t88 está vermelho desde 23/10, com as abas presas mudadas. |
| **Visual** (imagens de referência vencidas) | t245, t263 e t271 | Pedem regravação com aprovação, não correção. |
| **Conta e papéis** | t318, t370, t373 (**novo**), t405, t644 e t886 | |
| **Parceiros** | t316, t735, t739 e t656 | O t735 e o t739 parecem o mesmo caso do E648 (cadastro só com CPF não aparece na busca), como o t241. |
| **Admin e QA** | t195, t442, t465 e t655 | |
| **Instáveis** (alternam sem mudança relacionada) | t346, t683, t692, t707 e t840 | |
| **Outros** | t295, t296, t331, t348, t388, t397, t585, t590, t597, t621, t622, t678, t772, t778, t816 e t909 | Um defeito ou uma decisão por spec; a classe de cada um está na Frente 6 (`docs/frente6-inventario-vermelhos.md`). |

