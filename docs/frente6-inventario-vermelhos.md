# Frente 6: inventário dos vermelhos sem histórico verde, e a completude do E744 em 12/11

Este documento só faz inventário. Nenhum spec e nenhum código foram alterados.

**Fonte:** a tabela `lab_execucoes` de produção, consultada somente para leitura em 12/11 por volta das 09:50 UTC.

- A **rodada de referência** é a última rodada completa do laboratório: `4d705dee7`, gravada em 12/11 às 03:13 (horário do banco).
- Ela tem 846 specs: 4.126 testes passaram, 148 falharam e 232 foram pulados.
- O **histórico** vai de 12/10 a 12/11.

## Passo 2: os vermelhos que nunca tiveram uma rodada verde

A rodada de referência tem **85 specs vermelhos**. Destes, **49 nunca tiveram uma rodada verde** no histórico inteiro. Chamo de rodada verde aquela em que o spec teve `falhou = 0` e `passou > 0`. O pedido falava em 53; a diferença está em "Dúvidas" no PR.

### O achado principal: 46 dos 49 nunca rodaram antes de 09/11

Antes de 09/11 às 03:16, cada rodada do laboratório executava cerca de 650 testes e pulava cerca de 3.800, porque a suíte não cabia num job (E744).

- A **primeira rodada fatiada** foi a `da51e6d65` (`workflow_dispatch`), em 09/11 às 03:16. Ela executou 3.938 testes e pulou 317.
- Até essa rodada, 46 dos 49 specs apareciam no histórico, mas **somente pulados** (`passou + falhou = 0`).
- A partir dela, os 46 executaram **21 vezes ou menos**, e ficaram vermelhos em todas.

Portanto, "sem histórico verde" quer dizer, para esses 46, "ainda não houve uma rodada que os executasse e passasse". Não quer dizer que já passaram e voltaram a falhar. É bem possível que alguns tenham entrado na main já vermelhos e só agora apareçam. Em nenhum deles a data do primeiro vermelho aponta um commit culpado.

As exceções são os três specs visuais (t245, t263 e t271). Eles executam desde 20/10 ou 22/10 e falharam em **todas** as rodadas em que executaram: 314, 200 e 105 rodadas.

### Critério de classificação

O critério foi aplicado nesta ordem. A primeira regra que valer decide a classe.

1. **Instável:** o número de testes que falham muda de rodada para rodada, ou algum teste do spec passou só na nova tentativa (`instavel > 0`). Os dois sinais vêm de rodadas do próprio spec.
2. **Nunca alcançado:** em nenhuma rodada **um único teste** do spec passou (`passou` máximo = 0). O primeiro teste falha e os seguintes ficam pulados. O corpo do spec além do primeiro passo **nunca foi alcançado**.
3. **Sempre falhou:** parte dos testes passa, e o mesmo ponto falha em todas as rodadas executadas.

**Colunas da tabela:**

- **Exec.**: quantas rodadas executaram o spec.
- **Verm.**: quantas dessas rodadas foram vermelhas.
- **Inst.**: quantas rodadas tiveram teste instável.
- **P/F/S**: passou, falhou e pulou na rodada de referência.
- **Primeiro erro**: o título do teste e o começo da mensagem, como estão em `falhas`.

### Instável (9)

| Spec | Exec. | Verm. | Inst. | P/F/S | Primeiro erro | Obs. |
|---|---|---|---|---|---|---|
| t245-visual-regressao | 314 | 314 | 3 | 0/38/0 | 01 home: `toHaveScreenshot` com 5.350 px diferentes (`01-home-390.png`) | O número de falhas variou 20 vezes. São imagens de referência vencidas, não um defeito único. |
| t263-visual-41 | 200 | 200 | 1 | 1/6/7 | ube-001 página inteira: esperado 390×11.728, recebido 390×13.298 | A altura mudou com a página do imóvel (abas, faixa). |
| t271-admin-visual | 105 | 105 | 0 | 0/11/0 | /admin 1280: 317.753 px diferentes | O número de falhas variou 10 vezes. |
| t316-sair-da-viva-51 | 21 | 21 | 1 | 2/1/1 | 3. regra dos 3 em 30 dias: a Correção do parceiro `parei_servico` não aparece | |
| t346-importar-calendario-53 | 21 | 21 | 7 | 1/1/1 | 3. a busca mostra o imóvel nas datas importadas (`esperado false, recebido true`) | Tem 7 rodadas com teste instável. É o mais oscilante. |
| t388-varredura-bloco23 | 21 | 21 | 0 | 15/1/0 | Contrato da estadia @1280: clique no botão primário sem resposta em 3 s | Falharam 1 ou 2 testes. |
| t464-prop6-inicio-dono | 21 | 21 | 1 | 0/1/5 | 1. 390 px: `inicio-dono-foto` não aparece | Nenhum teste passou. Ficaria em "nunca alcançado" se não fosse a instabilidade. |
| t585-e205b-emails-novos | 21 | 21 | 2 | 4/1/1 | d2. véspera na hora: nenhum e-mail `visita_vespera` na caixa de teste | |
| t800-cadastro-passo4-titulo | 21 | 21 | 1 | 0/2/0 | Passo 4 (390 px): `cartao-numeros` não aparece | Falharam 1 ou 2 testes. |

### Nunca alcançado (19)

Em todas as rodadas o primeiro teste falha, e o resto do spec nunca rodou.

| Spec | Exec. | P/F/S | Primeiro erro |
|---|---|---|---|
| t328-documento-sem-trava-l11 | 21 | 0/1/1 | 1. rascunho retomado com endereço: `documento-enviar` não fica visível |
| t331-preferencias-push-44b2 | 21 | 0/1/1 | 1. `notif-categorias` não encontrado |
| t386-cadastro-01-tipo | 21 | 0/1/2 | 1. 1280 px: `previa-titulo` mostra "Título ainda não definido" em vez de "Apartamento" |
| t400-chacara-sem-internet | 21 | 0/1/2 | 1. salvar "Não tem internet": esperado `nao_tem`, recebido `radio` |
| t401-cadastro-10-revisao | 21 | 0/1/2 | 1. revisão: "Falta: aceite do termo da IA" em vez de "Tudo certo para publicar" |
| t439-e101-deteccao-espelho | 21 | 0/1/4 | 1. localização: a string "Santa Mônica, Uberlândia - MG" não aparece |
| t547-e148a-texto-sugerido-passo7 | 18 | 0/1/1 | 1. 390 px: `cadastro-titulo` não recebe o texto do modelo |
| t590-espaco-trabalho-interesse | 17 | 0/1/2 | 1280: `espaco-procura` vazio em vez de `coworking` |
| t597-e213b-limpeza-renovacao | 17 | 0/1/4 | B + item 4: esperado 1 pedido por saída, recebido 0 |
| t644-conta-menu-alinhado | 17 | 0/1/1 | 1280: `conta-menu-lateral` não encontrado |
| t655-observador-botoes-filas | 17 | 0/1/2 | 1280 observador: `foto-aprovar` na fila de foto não aparece |
| t693-prova-de-publicacao | 21 | 0/1/3 | 1–2. 1280: esperado `publicou`, recebido `esperando` |
| t697-e259-pessoas-sugerido-grava | 21 | 0/1/3 | 1. 3 quartos e Pessoas vazio: esperado "6", recebido `undefined` |
| t735-e277-busca-parceiros-fotos | 21 | 0/1/3 | (1) 1280: `cartao-parceiro` da categoria não aparece (scroll com tempo esgotado) |
| t772-e329-visita-confirmada | 21 | 0/2/0 | aviso ao dono (390): `visita-video-abrir` não existe |
| t778-e347-x-visita-video | 21 | 0/2/0 | Tempo do teste (90 s) esgotado |
| t799-cadastro-regras-icones | 21 | 0/2/0 | Passo 6 (390): a regra não tem ícone (`-ico`) |
| t886-e464-cabecalho-conta | 21 | 0/1/1 | 1280 /dashboard/conta/perfil: `sino-parceiro` no `topo-parceiro` não aparece |
| t909-reembolso-linha-tablet | 21 | 0/1/2 | 390 px: o elemento da linha de reembolso não aparece |

### Sempre falhou (21)

Parte dos testes passa, e o mesmo teste falha em todas as rodadas executadas.

| Spec | Exec. | P/F/S | Teste que falha e erro | Obs. |
|---|---|---|---|---|
| t318-papel-ativo-fonte-unica | 21 | 2/1/1 | 2. selo = barra = página: esperado `proprietario`, recebido `morador` | |
| t348-triagem-vinculo-52 | 21 | 2/1/0 | 2. o HTML do selo contém um valor em R$ ou "salári" | |
| t370-conta-a3-papeis | 21 | 2/1/0 | 2. `papel-morar-toggle` desligado: o clique esgota o tempo | |
| t397-foto-na-hora | 21 | 4/1/1 | 5. prova anterior à regra: o texto do prazo de "Refaça a foto" é diferente | |
| t405-perfil-e60-e62 | 21 | 5/1/0 | E60 390 px: `fale-com-a-viva-raiz` não fica visível | |
| t435-cadastro-03-endereco | 21 | 2/1/2 | E104 390 px: Passo 3 em cartão branco (esperado true, recebido false) | |
| t442-foto-perfil-revisao | 21 | 2/1/2 | 3. "Fotos de perfil em revisão" não aparece no painel | |
| t456-comodidades-tipo-e111a | 21 | 2/1/1 | 2. troca de tipo: "Salvo" não aparece | |
| t465-admin4-inicial | 21 | 3/1/1 | 3–4. 390 px: `admin-decisoes` não encontrado | |
| t469-e134-passo4-alinhado | 21 | 2/1/1 | 3. 390 px: botões do passo "Tipo" vazando para o lado | |
| t534-e147-bairro-santa-monica | 18 | 1/1/1 | 1. 1280: depois do CEP o passo é "Adicione as fotos…", não "Detalhes do imóvel" | |
| t548-e132a-declaracoes-persistem | 18 | 1/1/2 | 2. 1280: as declarações do Passo 10 voltam `null` do rascunho | |
| t564-e193-qualificacao-cartoes | 18 | 2/1/1 | Passo 5 1280: esperadas 23 pílulas de comodidade, recebidas 0 | |
| t600-e200-conversa-da-estadia | 17 | 3/1/1 | 390 moradora: a conversa da estadia não traz o texto esperado | **Tratado no #3733** (mesclado em 12/11, 07:19 UTC), depois da rodada de referência |
| t621-varredura-bloco55 | 17 | 11/2/0 | E218 @1280: o checklist do dono novo não aparece | |
| t622-varredura-bloco56 | 17 | 3/1/0 | "Meus imóveis" com um rascunho @390: elemento fixo sobre o conteúdo | |
| t656-e224-plano-gestor | 17 | 2/1/1 | 1b. administradora liberada: o texto mostra "Plano Ges…" | |
| t678-e202-emails-candidatura | 21 | 1/1/0 | 4–5. dono aprova: o campo "Prazo total em meses" não existe | |
| t696-varredura-bloco74 | 21 | 8/1/0 | Passo 10 @1280: a tela do merge (`conferencia-tipo`) não aparece | |
| t739-varredura-parceiros-390 | 21 | 3/1/4 | 390 px: o cartão `lia-limpeza-t739-*` na busca de limpeza não aparece | |
| t816-cidade-bairros-grade-par | 21 | 2/1/0 | 1280: bairros em grade par, esperado < 580 px de altura, recebido 1.160 | |

### Agrupamentos que saltam à vista

São só para orientar uma correção futura. Nada foi reproduzido.

- **O fluxo do cadastro (`/qualificar`) concentra 15 dos 49:** t328, t386, t400, t401, t435, t456, t469, t534, t547, t548, t564, t693, t697, t799 e t800.
  - Vários erros apontam para o mesmo sintoma: o rascunho não guarda o que o passo anterior gravou (título, tipo, internet, declarações, Pessoas, comodidades) ou o passo seguinte é outro.
  - Uma causa comum é provável. Antes de mexer em cada spec, vale um único repro determinístico com o cadastro no lab.
- **Conta e papéis:** t318, t370, t644 e t886.
- **Parceiros:** t735 e t739 (o cartão do parceiro não aparece na busca, o que pode ser o mesmo E648 do t241, cadastro só com CPF) e t656.
- **Visual:** t245, t263 e t271 são imagens de referência vencidas. Pedem uma regravação com a decisão de quem aprova, não uma correção.

## Passo 3: a completude do E744 na main atual

### Ainda não existe rodada completa sobre a main de hoje

- **A última rodada completa é a `4d705dee7`** (run 43132987595, push de 12/11 às 01:13 UTC, conclusão `failure`).
  - Ela é anterior a todos os merges de hoje, de #3732 a #3743. O primeiro, o #3732, entrou às 04:41 UTC.
  - Ela também é anterior à Frente 0 (`1d797dcb3`), que criou os campos de completude. Por isso **`listados`, `executados` e `nao_executados` estão nulos** nela.
  - Ainda **não há** rodada com a completude gravada.
- **A Frente 0 tirou o push na main do `laboratorio.yml`.** Agora a suíte inteira só roda pelo agendamento (`cron: 0 6 * * *`) ou por disparo manual.
- **O agendado de 12/11 ainda não apareceu** até 09:52 UTC. Nos dias anteriores o GitHub atrasou o agendado para 13:44, 14:29 e 15:29 UTC.
- A main atual (`21fb46530`) tem só o lab-crítico. Os runs de cada merge estão verdes; o de `21fb46530` estava em andamento às 09:52.

Portanto, **não é possível medir hoje** executados × listados, nem fatias verdes × vermelhas sobre a main atual.

Para referência, eis a rodada `4d705dee7` (fatiada, mas sem os campos de completude):

- **Fatias:** 20, das quais 6 verdes (2, 11, 17, 18, 19 e 20) e 14 vermelhas. O `consolidar` ficou vermelho só por causa das fatias vermelhas.
- **Totais:** 4.126 passaram, 148 falharam, 232 foram pulados e 846 specs foram contados.
- **Execução:** como 4.126 + 148 = 4.274 executados de 4.506 contados, a execução foi de 94,9%. Os 232 pulados são `test.skip` dos specs ou testes seriais depois de uma falha. Não há fatia que tenha caído.

### O que os merges de hoje cobrem dos 85 vermelhos

Os merges cobrem **17 specs e 21 falhas**. Isso **não foi verificado** numa rodada completa: cada PR provou o seu spec no lab local ou no lab-crítico.

| PR (mesclado em 12/11) | Specs vermelhos da rodada de referência que ele trata | Falhas |
|---|---|---|
| #3733 (Frente 2) | t600 | 1 |
| #3734 (Frente 3, busca/home) | t66, t70, t71, t78 | 7 |
| #3735 (Frente 3, mapa/página pública) | t112, t839 | 3 |
| #3736 (Frente 3, admin) | t229, t231, t273, t290, t81 | 5 |
| #3737 (Frente 3, conta) | t39, t236 (já passava na main), t241, t250, t286 | 5 |

Os outros merges não estão na tabela, pelos motivos abaixo.

- **#3732 (t132):** o t132 não estava vermelho na rodada de referência.
- **#3738, #3739, #3741, #3742 e #3743:** são reprovas de QA com testes novos (t1604 e t1605) ou ajustes (t596 e t398). Nenhum desses specs estava vermelho na rodada de referência.

**O que deve sobrar na próxima rodada completa**, se cada PR de fato resolveu o seu spec:

- **68 specs** e cerca de **127 falhas**.
- Desse total, 48 são os vermelhos sem histórico verde da tabela acima (os 49 sem o t600).
- Os outros 20 já tiveram verde e hoje estão vermelhos: t161, t176, t186, t195, t204, t227, t288, t292, t295, t296, t38, t389, t40, t64, t692, t707, t77, t79, t840 e t88.

### Falhas novas na rodada de referência

As falhas novas são as que estavam vermelhas na `4d705dee7` e verdes na rodada completa anterior, a `c1b1b3408`.

| Spec | Erro | Rodadas completas desde 09/11 | Classe |
|---|---|---|---|
| t389-deteccao-fotos | 4. item de nível: a foto da galeria não vira prova (esperado true, recebido false em 30 s) | 13 vermelhas, 8 verdes, 4 com instável | **instável** |
| t692-e259-pagina-publica | 1280: `galeria-tile-0 img` com `fetchpriority=high` não encontrado | 6 vermelhas, 15 verdes, 4 com instável | **instável** |

Entre `c1b1b3408` e `4d705dee7` só entrou o #3705 (E687, massa 0338 do parceiro de Mudança). Esse merge não toca a galeria nem a detecção. As duas falhas alternam sem mudança de código relacionada.

Três specs alternam entre as três últimas rodadas (`02a337e62` → `c1b1b3408` → `4d705dee7`):

- **t290:** 5 vermelhas, 2 verdes e 14 com instável. Foi tratado no #3736.
- **t707:** 2 vermelhas e 19 verdes. Na rodada de referência o `sizes` veio `25vw` em vez de `50vw`.
- **t840:** 10 vermelhas e 11 verdes. Na rodada de referência o clique no pin 19 esgotou o tempo.

Os três também são **instáveis**.

**Não abri nenhuma correção.** Nenhuma dessas falhas foi reproduzida com um teste determinístico falhando na main, e reproduzir essa falha é condição para abrir correção.
