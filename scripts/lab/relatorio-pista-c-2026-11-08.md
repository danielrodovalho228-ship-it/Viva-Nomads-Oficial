# Relatório da Pista C — 08/11/2026 (continuação do registro de 07/11)

Detalhe anterior em `relatorio-pista-c-2026-11-07.md` (blocos 433–516, L-103 a L-106, specs dos merges do dia).

## Bloco 517 aberto (main `c1ae2d65c`)

Pendente da rodada anterior: nada vermelho. Bloco 516 (#3334) e o commit #3335 (Pista QA, documentação) entraram; run de `e4b3405fa` verde (42426815188), o de `c1ae2d65c` em andamento. Nenhum merge de produto novo: sem spec de merge nem regressão a registrar. Meus PRs abertos (t1428 #3270 e t1429 #3271) seguem limpos, sem conflito, sobre os drafts #3256 e #3253, ainda não mesclados. Bloco 517 (t1451, grupo do 500: cidade, buscar, comparar, institucionais, parceiros/buscar, admin) aberto, a 390 e 1280 px, em andamento. Aberto no produto: L-104; próximo livre: **L-107**. Sem prova ao vivo, sem merge e sem fechar PR.

## Bloco 517 verde (main `c9d212ad9`)

Bloco 517 (t1451, #3338, grupo do 500: cidade, buscar, comparar, institucionais, parceiros/buscar, admin atendimento/contratos/candidaturas) **verde** (run 42427834121), a 390 e 1280 px, e já mesclado; inclui as telas dos merges E446 e E529. O outro commit novo (#3336, Pista QA) não tem código de produto (`src`/`supabase` sem mudança): nenhuma spec de merge, nenhuma regressão. Aberto no produto: L-104; próximo livre: **L-107**. Próximo da fila: bloco 518 (grupo do 501). Sem prova ao vivo, sem merge e sem fechar PR.

## Blocos 518 e 519 abertos (main `c1d8b384c`)

**Passo 0.** Nenhuma coleta ficou pendente: o bloco 517 fechou verde (run 42427834121). A "falha" do `coleta2.py` citada na leitura anterior foi o coletor que eu mesmo encerrei (código 144) ao corrigir o arquivo de acompanhamento dos blocos 514/515; os dois blocos fecharam verdes (42425138013 e 42425164158). Main `c1d8b384c`: runs de `c9d212ad9` verde (42427931502); `e59f0aa13` e `c1d8b384c` ainda em andamento.

**Merges novos desde o bloco 517.** Só documentação da Pista QA (#3336, #3340: rodadas de QA em `docs/`); `src`, `supabase` e `tests` sem mudança: nenhuma spec de merge, nenhuma regressão.

**Blocos.** 518 (t1452, grupo do 501: avisos, prévia de e-mails, caixa do leitor de QA) e 519 (t1453, grupo do 502: contrato, imóvel, estadia, locação, sócios, autenticação), a 390 e 1280 px. Independentes entre si, abertos sobre a main atual; em andamento. Aberto no produto: L-104; próximo livre: **L-107**. Sem prova ao vivo, sem merge e sem fechar PR.

## Blocos 518 e 519 verdes; E680 coberto; novos merges E506, E699, E704 (main `b9a3fa4c4`)

**Verdes:** bloco 518 (t1452, #3342, grupo do 501, run 42429194387) e bloco 519 (t1453, #3343, grupo do 502, run 42429221163), a 390 e 1280 px; ambos já mesclados.

**Merges de produto novos** (todos já na main, `tsc` limpo em `b9a3fa4c4`): E506 barra de qualificação (#3298), E680 lista populada (#3311), E699 resíduos (#3337) e E704 rótulos de cidade no Leaflet (#3331). Run da main em `b9a3fa4c4` pendente ao registrar; sem regressão conhecida.

**Spec permanente nova:** t1454 / E680 (PR do ramo `claude-c/t1454-e680`): duas moradoras com uma locação cada; depois da troca de conta no mesmo navegador (guardado da A, sessão acabada, B entra), `/dashboard/locacoes` mostra só a locação da B; a 390 e 1280 px. Em andamento.

**Ainda sem spec de tela (item pulado, um por vez):** E506 (barra de qualificação), E699 (resíduos das travas de publicação), E704 (rótulos de cidade nos pinos do mapa; pede semear imóveis em cidades distintas), E706, E694, E696/E702, E700, E701, e as avaliações do parceiro/conduta cega/termos do avaliador. Aberto no produto: L-104; próximo livre: **L-107**. Sem prova ao vivo, sem merge e sem fechar PR.

## t1454 / E680 verde

t1454 (E680, #3346) **verde** (run 42430241110): depois da troca de conta no mesmo navegador, `/dashboard/locacoes` da conta que entrou mostra só a locação dela, a 390 e 1280 px. Sem regressão; sem defeito novo. Aberto no produto: L-104; próximo livre: **L-107**. Pendentes de spec de tela: E506, E699, E704, E706, E694, E696/E702, E700, E701, avaliações do parceiro/conduta cega/termos do avaliador. Próximo bloco da fila: 520 (grupo do 503). Sem prova ao vivo, sem merge e sem fechar PR.

## Jornadas da QA viram teste (t1455) e bloco 520 (main `1b76bf880`)

**Estado.** Main `1b76bf880`; t1454 / E680 (#3346) já verde (run 42430241110); run da main em andamento. Merges novos do dia desde `b9a3fa4c4`: só E694 (#3339), coberto agora pela t1455.

**Propostas da Pista QA** (`docs/qa-rodadas/2026-11-07.md`, "Para a Pista C, testes determinísticos"):
- **T-E694 → t1455 (#3351):** visitante em `/imoveis/ube-005` (exemplo): aviso de exemplo, só "Ver imóveis reais" (→ `/buscar`), nenhuma das ações que não funcionam, nenhum "Enviar", nenhum texto de validação em vermelho; 390 e 1280 px.
- **T-E695 → t1437 (mesmo PR):** acrescentado o caso `quartos=9` (lugar com imóveis, outro filtro exclui tudo → mesma mensagem de data/filtro sem o convite de cidade). Já cobríamos "lugar com imóveis + preço" e "lugar sem imóvel".
- **T-E696 (fórmula 04/12→16/01 em ube-005): pendente.** A página não lê as datas pela URL; a spec precisa clicar o calendário entre meses (frágil sem uma semente de datas). A conta tem teste unitário (`formula-estadia`). Também pendente: o ramo do E695 sem data futura (precisa de imóvel com disponibilidade já passada) e o E704 (rótulo da cidade no mapa; o lab não carrega tiles do CARTO).

**Resíduos que a própria QA registrou, para as pistas donas (não são do lab):** D3 (E695: sem data, o título diz "nenhum para essa data" e o detalhe manda mudar a data mesmo quando o filtro é a única causa), D4 (E695: `local=Curitiba` sem filtro mostra "Nenhum imóvel com estes filtros" acima de "A Viva ainda não chegou"), R1 (E694: campos de reserva visíveis no exemplo, sem botão). Nenhum virou número L- novo porque a QA já os numerou (D3, D4, R1).

**Bloco 520** (t1456, #3352, grupo do 503: admin sem id) aberto, a 390 e 1280 px, em andamento. Aberto no produto: L-104; próximo livre: **L-107**. Sem prova ao vivo, sem merge e sem fechar PR.

## Bloco 520 verde; t1455 vermelha por erro de spec, reenviada

**Bloco 520** (t1456, #3352, grupo do 503) **verde** (run 42431341900), a 390 e 1280 px.

**#3351 (t1455 + caso extra do t1437), run 42431312771 — 3 falhas, ambas erro de spec, nenhuma de produto:**
1. **t1455 a 1280 px:** `getByText(/anúncio de exemplo/).first()` pegou o `barra-demo` (a barra fixa do celular, `hidden` no desktop). O aviso visível existe. Correção: `.filter({ visible: true })`. A 390 passou.
2. **t1437, caso `quartos=9`:** `busca-vazia-titulo` não apareceu — o filtro `quartos=9` não gera a busca vazia que eu presumi. Era palpite meu, não vem da tabela da QA (que usa `quartos=3` em Santa Mônica). Caso retirado; o t1437 volta ao que estava verde (preço que exclui tudo + lugar sem imóvel). Os demais casos da tabela do T-E695 dependem da massa de Santa Mônica e ficam pendentes.
Reenviado no head `405b56e22` (o PR ainda estava aberto, conferi antes). Sem rerun. Nenhum defeito de produto novo; aberto: L-104; próximo livre: **L-107**.

## t1455 verde; cinco merges da Pista A (C7, C9, C10, E710, E711) — t1457 (main `fc8a8e73e`)

**Verde:** t1455 / T-E694 (#3351) no head corrigido (run 42432093519), mesclada; bloco 520 já registrado verde.

**Merges de produto novos** (todos da Pista A, `tsc` limpo em `fc8a8e73e`; runs da main em `3e2435ffe` e `fc8a8e73e` pendentes ao registrar): C10 (#3341, `/seguranca` com a faixa "Desconfie…" e o botão "Fale com a Viva"), C9 (#3349, nome do local sem corte no cartão da busca), C7 (#3350, "Anunciar meu imóvel" na dobra a 390 em `/para-proprietarios`), E710 (#3325, faixa de filtros no celular) e E711 (#3323, CTA de parceiros).

**Spec nova t1457** (PR do ramo `claude-c/t1457-c10-c7`): C10 (a faixa e o botão levam a `/ajuda/fale-com-a-viva`, 390 e 1280) e C7 (390 × 844: o botão inteiro dentro da primeira tela, sem nada cobrindo o centro dele, e a frase da taxa depois do botão). Em andamento.

**Sem spec de tela ainda (item pulado):** C9, E710 e E711 (cobertos só estruturalmente pelos blocos que passam por `/buscar` e `/parceiros`, a 390 e 1280), mais a lista de antes (E506, E699, E704, E706, E696/E702, E700, E701, avaliações do parceiro/conduta cega/termos do avaliador; T-E696 e o ramo sem data futura do E695). Aberto no produto: L-104; próximo livre: **L-107**. Sem prova ao vivo, sem merge e sem fechar PR.

## t1457 verde (C10 e C7)

t1457 (#3355) **verde** (run 42432802592): `/seguranca` tem a faixa "Desconfie…" com o botão "Fale com a Viva" levando a `/ajuda/fale-com-a-viva` (390 e 1280), e em `/para-proprietarios` a 390 × 844 o botão "Anunciar meu imóvel" fica inteiro na primeira tela, sem nada cobrindo o centro, com a frase da taxa depois. Sem regressão, sem defeito novo; aberto no produto: L-104; próximo livre: **L-107**. Próximo bloco da fila: 521 (grupo do 504). Sem prova ao vivo, sem merge e sem fechar PR.

## Bloco 521 e specs de layout público C9/E709/E710/E711 (main `5bea39692`)

**Estado.** Main `5bea39692`: run verde (42433587638). Merge de produto novo desde a última foto: E709 (#3324, folga para o botão flutuante), além do meu t1457. `tsc` limpo.

**Bloco 521** (t1458, #3358, grupo do 504: avaliação do imóvel, avaliadora, página pública da avaliadora, intenção), a 390 e 1280 px, aberto, em andamento.

**Specs de tela que faltavam (t1459, #3359):** C9 (nome do local no cartão da busca pode quebrar em linhas, sem corte horizontal), E710 (ações da busca em linha própria no celular, mesma linha dos filtros do tablet para cima), E711 (`/parceiros` sem o "Seja parceiro" duplicado, com "Quero ser parceiro") e E709 (folga de pelo menos 80 px à direita na página do imóvel a 768 e 1280). Em andamento.

**Rodadas de erros/estados vazios da Pista B:** o PR do bloco de auditorias 160–187 (leitura que falha não vira "não encontrado") não entrou como merge de produto na main nesta foto; ficam como item pulado até mesclarem (as auditorias estão em PRs `claude-b/auditoria-*` e `claude-b/achado*-leitura`, quase todas ainda abertas). Pendentes de spec de tela: E506, E699, E704, E706, E696/E702, E700, E701, avaliações do parceiro/conduta cega/termos do avaliador, T-E696, ramo sem data futura do E695.

Aberto no produto: L-104; próximo livre: **L-107**. Sem prova ao vivo, sem merge e sem fechar PR.

## Bloco 521 e t1459 verdes

Bloco 521 (t1458, #3358, grupo do 504) **verde** (run 42434599430) e t1459 (#3359, C9/E709/E710/E711) **verde** (run 42434662997), a 390 e 1280 px (E709 também a 768): nome do local sem corte no cartão da busca, ações da busca em linha própria no celular, `/parceiros` sem o "Seja parceiro" duplicado e folga de 80 px à direita para o botão flutuante. Sem regressão, sem defeito novo; aberto no produto: L-104; próximo livre: **L-107**. Próximo bloco da fila: 522 (grupo do 505). Sem prova ao vivo, sem merge e sem fechar PR.

## Bloco 522 (t1460) e conferência da main

- Main `269790fdc` verde no lab crítico (run 5051); nenhuma falha a classificar, nenhum L- novo. L-107 segue livre; L-104 segue como único defeito aberto.
- Bloco 522 (PR #3361, run 42436534565): verde. Painel do proprietário sem id (agenda, carteira, ganhos, recibos, respostas rápidas, simulador, ferramentas), 390 e 1280 px.
- E530b (#3132): a spec t873 foi ajustada no próprio merge; sem spec nova.
- Próximo: bloco 523 (grupo do 506).

## Blocos 523 e 524

- Bloco 523 (t1461, PR #3366, run 42437878706): verde. Painel do morador sem id (painel, avaliações, buscas, comparar, conta, fechamento, garantias, reembolsos, solicitações, verificação).
- Bloco 524 (t1462, PR #3367, run 42437908184): verde. Públicas com parâmetro na URL (polo, como funciona, guias, pedidos/novo, proprietário, parceiro, imóveis perto de).
- Merge novo na main: #3362 (Renato, t150: faixa Comparar a 1280) já é a própria spec; sem spec nova.
- Nenhum defeito novo; L-107 segue livre. Próximo: bloco 525 (grupo do 508).

## Blocos 525 e 526

- Bloco 525 (t1463, PR #3369 em draft, run 42439205377): verde. Admin com id na URL (chamado, contrato, pedido de parceiro, refazer duas etapas).
- Bloco 526 (t1464, PR #3370 em draft, run 42439229945): verde. Compartilhadas sem id (conta/[secao], orçamentos/nova, pedidos-cidade, qualificar, parceiro, avaliação do parceiro, aviso de prova).
- Main: #3361 (run 5057), #3362, #3363 e #3368 verdes no push. #3366 em andamento no fechamento; o run do #3367 foi cancelado por ser superado pelo seguinte (conclusão cancelled, não falha). Nenhum teste permanente quebrou.
- Merges novos sem spec: nenhum (#3362 é spec; #3363 e #3368 são docs da QA).
- Nenhum defeito novo; L-107 livre. Próximo: bloco 527 (grupo do 510).

## Bloco 527

- Bloco 527 (t1465, PR #3371 em draft, run 42440171656): verde. Compartilhadas com o morador, pedido de serviço pelos dois lados, três papéis.
- Merges novos na main desde o último registro: só os blocos 523/524 (#3366, #3367); nenhuma jornada provada sem teste. Nenhum defeito novo; L-107 livre. Próximo: bloco 528 (grupo do 511).

## Bloco 528

- Bloco 528 (t1466, PR #3373 em draft, run 42440770509): verde. Proposta e visita com id na URL, 390 e 1280 px.
- Main sem merge novo desde #3366/#3367 (blocos 523/524, já spec); nenhuma jornada provada sem teste. Nenhum defeito novo; L-107 livre. Próximo: bloco 529 (grupo do 512).

## Bloco 529

- Bloco 529 (t1467, PR #3374 em draft, run 42442070795): verde. /conferir, /conferir/[codigo], /dashboard/pedidos e /admin/sistema, 390 e 1280 px.
- Main: único merge novo é #3372 (docs da QA, rodada 02:40); sem código de app novo desde `a3bae5dd`. A QA propôs o T-E686 (em /parceiros/avaliadores, nunca "Você define o seu" junto de "segue a tabela da Viva"; depois do D-E686-a, também sem "Você paga a avaliação"). A primeira parte já é a t1428 (PR #3270), que depende do #3256 ainda em draft: na main de hoje o texto ainda traz os dois trechos, então a spec não entra antes do produto. A parte "Você paga a avaliação" fica para quando o D-E686-a for corrigido (pista A).
- Nenhum defeito novo; L-107 livre. Próximo: bloco 530 (grupo do 513).

## Blocos 530, 531 e 532

- Bloco 530 (t1468, PR #3379 draft, run 42443518457): verde. Contrato, estadia, cartão, desempenho e solicitações (grupo do 513).
- Bloco 531 (t1469, PR #3380 draft, run 42443520216): verde. Início, ajuda, busca, imóvel e telas do proprietário (grupo do 514).
- Bloco 532 (t1470, PR #3381 draft, run 42443522805): verde. Admin, parceiros, visitas e serviços (grupo do 515).
- Merge novo na main durante a sequência: #3377 (docs da QA); nada a testar. Nenhum defeito novo; L-107 livre. Próximo: bloco 533 (grupo do 516).

## Blocos 533, 534 e 535

- Bloco 533 (t1471, PR #3385 draft, run 42444865371): verde. Painel do proprietário e do morador, /empresas e /para-proprietarios (grupo do 516).
- Bloco 534 (t1472, PR #3386 draft, run 42444867450): verde. Admin, busca, cidades, comparar, privacidade, segurança, termos, parceiros/buscar (grupo do 517).
- Bloco 535 (t1473, PR #3387 draft, run 42444870267): verde. /dev/emails, /dashboard/qa/emails, /avisos/desligar (grupo do 518).
- Nenhum merge novo na main durante a sequência (último: #3377, docs da QA). Nenhum defeito novo; L-107 livre; L-104 único aberto. Próximo: bloco 536 (grupo do 519).

## Correção e t1474

- Correção da seção anterior: entrou o merge #3382 (rodada 03:35 da QA) durante a sequência dos blocos 533–535, ao contrário do que está escrito ali.
- t1474 (PR #3389 draft, run 42445630077): verde. Teste proposto pela QA nessa rodada: `/conferir/{inexistente}` ("Nenhum documento com este código"), `/conferir/{código de teste}` ("Documento de teste") e 404 em `/parceiros/{inexistente}` e `/avaliadores/{inexistente}`. Não conferi no log se o caso do documento de teste rodou ou pulou (ele pula declarando o motivo quando o laboratório não tem documento de teste válido).
- Pendências de massa: `/avaliadores/{suspenso}` (precisa de avaliador suspenso) e o E702 (a QA diz que falta massa da Pista C; ainda sem pedido concreto de massa).

## Vigia pós-lote de 10 merges (04:36 UTC) — L-107

- Main: o push final do lote (run 5124, `41f87b941`) deu verde. Os runs dos merges intermediários foram cancelados por serem superados.
- t1428 (E686, PR #3270): verde com a main mesclada (run 42447678072). Passou a ser só spec (código de produto dos drafts removido; já está na main).
- t1475 (E713 e chips do /pedidos/novo, PR #3390): verde (run 42448482905) depois de eu escopar ao calendário a checagem da frase "esta solicitação não é enviada" (ela segue noutros pontos do exemplo; erro meu, não do produto).
- t1429 (E691): o PR #3271 ficou com a base antiga e o lab montou a lista de specs de todos os blocos desde então (cancelado por tempo, não falha). Substituído pelo PR #3394, limpo, saindo da main. Pede ao Daniel fechar o #3271.

### L-107 — defeito real (proposta de item para a lista-master, pelo chat principal)
- **O quê:** com um laudo ASSINADO, a tela do dono `/dashboard/imoveis/<id>/nivel` cai em "Não conseguimos abrir esta tela" (código para a equipe 1965082685), 1280 px. Sem laudo assinado, o selo não aparece e a tela não é afetada.
- **Origem:** E691 (#3296, Pista B), selo da assinatura do laudo. O mesmo componente é usado na tela do avaliador (`parceiro/avaliacao/[pedido]`).
- **Causa provável (não confirmada):** `src/components/vistoria/selo-assinatura.tsx` é componente de servidor (sem "use client") e passa `onFocus` a um `<input>`; handler de evento não atravessa o servidor.
- **Evidência:** lab run 42451630488, t1429 (PR #3394), mensagem "selo ausente; a tela mostra: Não conseguimos abrir esta tela…". Classificação: defeito real (não é teste vencido nem massa: o mesmo seed funcionava no desenho do draft).
- **Spec:** t1429 com `test.fail` ligado ao L-107; quem corrigir remove o `test.fail` no mesmo PR. A parte "laudo sem assinatura não mostra a linha" ficou sem verificação enquanto o `test.fail` vale (o teste para na primeira etapa).
- Aberto agora: L-104 e L-107. Próximo número livre: L-108.

### Sem spec ainda
E679 1/5 (painel unificado; precisa de login), E687, E689 e E682 (só têm teste de leitura de fonte).

## E708 e bloco 536

- E708 (#3313): já na main; sem referência do LinkedIn à rota antiga em `src`. Coberto pelo teste unitário `e708-rotas-de-retorno.test.ts` e pela t323 (volta em /dashboard/conta/seguranca). Item pulado por já estar mergeado e coberto.
- Merges novos: #3391, #3392, #3399 e #3400 (docs da QA); nada a testar.
- Bloco 536 (t1476, PR #3403 draft, run 42453174535): verde. Auth, sócios, modelo de negócio, ROI, simulação, contratos/locações com id, telas da estadia e do imóvel com id.
- Aberto no produto: L-104 e L-107. Próximo livre: L-108. Próximo bloco: 537 (grupo do 520).

## Blocos 537, 538, 539 e t1480

- Bloco 537 (t1477, PR #3409 draft, run 42454153217): verde. Admin (ajuda da publicação, fotos, marketing, sócios, dados de teste, serviços, solicitações, pedidos, encerramentos, retenção), grupo do 520.
- Bloco 538 (t1478, PR #3410 draft, run 42454155444): verde. Intenção, avaliação do imóvel, avaliadora, laudo, grupo do 521.
- Bloco 539 (t1479, PR #3411 draft, run 42454158246): verde. Painel do proprietário sem id, grupo do 522.
- Merges novos: #3404 (lint, sem mudança de comportamento) e #3405 (docs da QA, rodada 06:10); nenhum código de app novo.
- t1480 (PR #3413 draft, run 42456730096): verde. T-fixos e T-dinâmicas propostos pela QA na rodada 06:10 (nenhum texto do main/footer fica sob elemento fixo de baixo, 390 e 1280 px; páginas do sitemap com 1 h1 e sem imagem de largura natural 0; /imoveis-perto-de inexistente = 404).
  - Três falhas no caminho eram da minha spec, não do produto: (1) contava o cabeçalho fixo do topo (cobrir o que rola por baixo é normal); (2) a rolagem parava no meio porque a página crescia (rolagem 8839 de 9995), e o texto do rodapé aparecia sob a barra de baixo no meio do trajeto; (3) agora rola até encostar no fim de verdade. Nenhum defeito de produto: coerente com a QA (0 sobreposições).
- Pendente da QA: T-P1 (saudação do assistente sem "planos") até a Pista A corrigir a saudação.
- Aberto no produto: L-104 e L-107 (t1429 com test.fail, PR #3394). Próximo livre: L-108. Próximo bloco: 540 (grupo do 523).

## Blocos 540, 541, 542 e specs dos drafts E714/E717

- Bloco 540 (t1481, PR #3418 draft, run 42457973492): verde. Painel do morador sem id (grupo do 523).
- Bloco 541 (t1482, PR #3419 draft, run 42457976391): verde. Públicas com parâmetro na URL (grupo do 524).
- Bloco 542 (t1483, PR #3420 draft, run 42457978905): verde. Admin com id na URL (grupo do 525).
- Nenhum defeito novo; L-108 livre; abertos: L-104 e L-107 (t1429, PR #3394).

### Drafts que aguardam merge dirigido
- E714 (#3395, "o dono paga a avaliação"): spec t1484 (PR #3421, base = branch do #3395, run 42458121246, verde sobre o código do draft). A t1428 (PR #3270) passou a aceitar a frase velha e a nova (run 42458135893, verde).
- E717 (#3396, faixa de teste no avaliador): spec t1485 (PR #3422, base = branch do #3396, run 42458123885, verde).
- E713 (#3408): já coberto (o próprio PR atualiza a t59; o calendário do exemplo está na t1475, PR #3390). Sem spec nova.
- E719 (#3397 e #3398): são duas implementações do mesmo item, com textos diferentes. Spec adiada até se escolher qual vale (decisão do coordenador/Daniel); não duplico.
- Quando #3395 e #3396 mesclarem, as bases de #3421 e #3422 passam para a main.
