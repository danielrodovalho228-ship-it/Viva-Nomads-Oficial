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

## Bloco 543, t1480 ajustada e t1486 (C16/C17 da QA)

- Bloco 543 (t1487, PR #3425 draft, run 42460626402): verde. Compartilhadas sem id (grupo do 526).
- t1480 (PR #3413, run 42460536920): verde com o ajuste pedido pela QA (rodada 07:05): imagens dentro de `.leaflet-container` (tiles do mapa) ficam fora da contagem de imagem vazia. A falha que a QA viu a 390 em produção ("2 imagens com largura natural 0" em /imoveis/ube-001) era de tile bloqueado pela rede dela, não do site.
- t1486 (PR #3424 draft, run 42461764106): os dois testes propostos pela QA na mesma rodada.
  - **C17** (Esc em "Mais filtros" leva o foco ao começo da página): reproduz no lab → `test.fail` ligado ao item C17 da QA.
  - **C16** (estouro lateral da linha Mais filtros · Ordenar · Mapa com filtro ativo): reproduz no lab a **360 px** (5 px) → `test.fail` ligado ao C16; a **390 px** o lab NÃO reproduz (os 3 px da QA dependem da fonte real do site; passou como "Expected to fail, but passed"), então ali o teste é comum. O 390 de produção só se prova no navegador real (QA).
  - Dois erros meus no caminho (test.fail onde não reproduzia; depois só em 390): ajustados com commits novos, sem defeito de spec restante.
- Os itens C16 e C17 já têm número da QA; não abri L- novo para eles (evita duplicar). L-108 segue livre.
- Merges de código na main: nenhum desde o último registro (só #3416, docs da QA). Drafts E714/E717/E719 seguem abertos.
- Próximo bloco: 544 (grupo do 527).

## Bloco 544 e conferência com a lista-master anexa

- Bloco 544 (t1488, PR #3426 draft, run 42462584673): verde. Compartilhadas com o morador, pedido de serviço pelos dois lados, três papéis (grupo do 527).
- Lab da main: o push mais recente (`fc7061bfb`, #3416, run 42458166437) está verde; os dois anteriores (#3414, #3412) também. Nenhum merge de código novo desde o último registro.
- Lista-master anexa (snapshot até E719): sem item novo que peça spec e já esteja mergeado. Drafts ainda abertos, sem spec possível na main: E714 (#3395, spec pronta no PR #3421), E717 (#3396, spec no PR #3422), E713 (#3408, coberto pela t59 e t1475), E716 (#3356 e #3388), E719 (#3397 e #3398, duas implementações; spec adiada até se escolher). E712 e E718 seguem abertos com a Pista A/chat principal, sem comportamento fechado para testar.
- Defeitos: nenhum novo; L-108 livre; abertos L-104 e L-107 (t1429, PR #3394); C16 (360 px) e C17 da QA cobertos por `test.fail` na t1486 (PR #3424).
- Próximo bloco: 545 (grupo do 528).

## Bloco 545 e specs propostas pela QA (rodadas 06:25, 06:40, 07:05 e 08:50)

- Bloco 545 (t1490, PR #3430 draft, run 42464319493): verde. Proposta e visita com id (grupo do 528).
- t1489 (PR #3429 draft, run 42465890357): verde. T-janelas-busca: cada controle da faixa de /buscar abre a janela sem rolagem lateral, Fechar e Esc fecham, foco volta ao botão (390 e 1280 px). Caminho até o verde: (1) erro meu, o id da pílula Ordenar é `ordenar` e não `ordem`; (2) duas quedas de infraestrutura (504 no download do supabase/setup-cli, antes de qualquer teste), com um único rerun nessa run; o run verde veio de um commit legítimo (merge da main no ramo).
- t1491 (PR #3434 draft, run 42465929827): verde. T-E452-neg (tipo=loft sem botão Nível; nivel=premium mostra "Premium" e desligar tira `nivel` da URL) e T-E436 (a 1280 e 390 nada cobre o topo público).
- Ainda sem spec: T-E458-390 (menu de /empresas a 390 com o link "Parceiros"; falta o seletor do menu do celular), T-E713r (#3408, draft) e T-E660r (#3407, draft), T-0328 (leitura no banco depois do merge da migração), T-P1 (saudação do assistente, depende da Pista A).
- Defeitos: nenhum novo; L-108 livre; abertos L-104, L-107 (t1429, PR #3394) e C16 (360 px)/C17 da QA (t1486, PR #3424).
- Próximo bloco: 546 (grupo do 529).

## Bloco 546, C16 corrigido e instabilidade da infraestrutura

- Bloco 546 (t1492, PR #3436 draft, run 42467393893): verde. Conferir, pedidos do morador, admin/sistema (grupo do 529).
- **C16 (QA 07:05) corrigido na main:** o #3433 (Faixa D, `flex-wrap` na faixa de ações da busca) tirou o estouro lateral a 360 px; na t1486 o `test.fail` do C16 a 360 passou a falhar com "Expected to fail, but passed". A spec virou teste comum de regressão a 360 e 390 px (run 42468873863, verde). **C17 segue aberto** (`test.fail` ligado ao item da QA, reproduz no lab). A prova do C16 em produção no navegador real é dos trabalhadores de QA.
- **Infraestrutura (não é defeito do produto nem de spec):** vários runs caíram com `Unexpected HTTP response: 504` no download do `supabase/setup-cli`, antes de qualquer teste. Afetou: o push da main do #3433 (`53c0bcc10`, runs 42466518269 tentativas 1 e 2) e o 1º run da t1486. **A main nesse commit ficou sem veredito do lab** (esgotei o único rerun); o veredito virá do próximo push na main. As specs sobre a main foram verdes no mesmo período (blocos 545 e 546, t1489, t1491, t1486).
- #3433 (Faixa D, lab verde: t106, t113, t118, t141, t155) mexeu em `barra-pilulas.tsx` e `caminho-reserva.tsx` (texto "Ver o caminho para morar"); já traz suas specs. A t873 (E530) é a spec do texto antigo "Ver o caminho de reserva"; não confirmei se a Faixa D a ajustou, conferir quando o lab da main sair.
- Defeitos: nenhum novo; L-108 livre; abertos L-104, L-107 (t1429, PR #3394), C17.
- Próximo bloco: 547 (grupo do 530).

## Bloco 547, t1494 e a instabilidade do lab (para a lista-master)

- Specs novas, **sem veredito do lab ainda** (infraestrutura): bloco 547 (t1493, PR #3439 draft, grupo do 530) e t1494 (PR #3440 draft): T-E527 (contraste ≥ 3:1 da legenda do calendário, medido pela QA em 1,10:1 e 1,23:1) e T-E532 (i) (prévia do cartão "Segurança" repete as câmeras do bloco "Privacidade"), ambos como `test.fail` ligados aos itens da lista-master, propostos pela QA na rodada 10:00. Se o lab mostrar que algum já passa, eu troco por teste comum.
- **Proposta de item para a lista-master (achado de laboratório; não corrijo):** o job `lab-critico` falha de forma intermitente com `Unexpected HTTP response: 504` no passo `supabase/setup-cli@v1`, antes de qualquer teste. Entre 09:03 e 10:10 UTC, pelo menos estes runs foram afetados: 42465463510 (t1489), 42466518269 e 42468633690 (pushes da main `53c0bcc10` e `da24ba7f9`, as duas tentativas de cada), 42467421477 (t1486), 42470270662 e 42470322221 (as duas tentativas de cada). Outros runs no mesmo intervalo passaram (42468873863, 42468392458). Efeito: **a main ficou sem veredito do lab em 3 pushes seguidos** (`53c0bcc10`, `da24ba7f9` e o anterior de 504 no mesmo passo). Sugestão para o dono do workflow (fora do escopo da Pista C, que fica em `tests/e2e` e `scripts/lab`): fixar a versão do CLI e/ou repetir o passo com espera (ex.: `nick-fields/retry` ou `continue-on-error` + nova tentativa), ou instalar o CLI por cache.
- Reruns: usei o único permitido em cada run; não há mais reruns a pedir. Uma nova passada com a main à frente (merge da main no ramo, commit legítimo) gera run novo para estes dois PRs.
- Defeitos de produto: nenhum novo; L-108 livre; abertos L-104, L-107 (t1429, PR #3394), C17, E527 e E532 (i) (estes dois com `test.fail` na t1494, ainda não confirmados no lab).
- Próximo bloco: 548 (grupo do 531).

## Vereditos dos blocos 547 a 549 e t1494

| Spec | PR (draft) | Run | Veredito |
|---|---|---|---|
| Bloco 547 (t1493, grupo do 530) | #3439 | 42471239969 (2 tentativas) | **sem veredito, falha de infra**: passo `supabase/setup-cli@v1` falhou nas duas tentativas, antes de qualquer teste. Já tinha caído antes, em 42470270662 (2 tentativas). Rerun único esgotado em cada run; sem commit vazio. |
| Bloco 548 (t1495, grupo do 531) | #3441 | 42471228082 | verde |
| Bloco 549 (t1496, grupo do 532) | #3442 | 42471230803 | verde |
| t1494 (E527 e E532 (i)) | #3440 | 42471244137 (tentativa 2) | verde: **os dois `test.fail` reproduzem no lab** (contraste da legenda do calendário abaixo de 3:1 e prévia do cartão "Segurança" repetindo as câmeras do bloco "Privacidade"); a 1ª tentativa tinha caído por infra |

- Nenhum defeito de produto novo; L-108 livre; abertos L-104, L-107 (t1429, PR #3394), C17, E527 e E532 (i) (agora confirmados no lab pela t1494).
- Main: sem veredito do lab em `53c0bcc10` e `da24ba7f9` (infra); o push seguinte (`049469e5b`, docs da QA) não foi conferido por mim.
- Próximo bloco: 550 (grupo do 533).

## Item para o dono do workflow (achado de laboratório; não corrigido, fora do escopo `tests/e2e` e `scripts/lab`)

- **O que acontece:** o job `lab-critico` (`.github/workflows/lab-critico.yml`) falha de forma intermitente no passo `supabase/setup-cli@v1` com `Unexpected HTTP response: 504` (download do CLI), antes de qualquer teste; o passo não tem repetição e a versão do CLI não está fixada.
- **Efeito medido hoje (08/11, 09:03 a 10:40 UTC):** pelo menos 8 runs afetados (42465463510, 42466518269, 42467421477, 42468633690, 42470270662, 42470322221, 42471239969 e o 1º do 42471244137), incluindo dois pushes seguidos na main sem veredito. Outros runs no mesmo intervalo passaram (42468873863, 42468392458, 42471228082, 42471230803): é intermitente, não é queda total.
- **Custo:** a main fica sem veredito, e cada PR de spec gasta o rerun único; a regra de "no máximo um rerun por run" torna o ruído caro.
- **Sugestão:** fixar a versão do CLI (`with: version: <fixa>`) e repetir o passo com espera (ex.: `nick-fields/retry` ou duas tentativas com `continue-on-error`), ou instalar por cache. Proposta de item para a lista-master, dono: quem cuida do workflow (Faixa D/chat principal).

## Bloco 550 e veredito do bloco 547

- Bloco 550 (t1497, PR #3445 draft, run 42473481205): verde. Painéis do proprietário e do morador, /empresas e /para-proprietarios (grupo do 533).
- **Bloco 547 (t1493, PR #3439 draft, run 42473481778): verde na 2ª tentativa.** Veredito dado depois de a main avançar (#3443 e #3444, docs da QA) e de eu mesclar a main no ramo (commit legítimo, sem commit vazio). A 1ª tentativa caiu no passo `supabase/setup-cli@v1` (esse passo levou 6,5 minutos antes de falhar). Histórico do 547: 4 runs seguidos caídos nesse passo (42470270662 e 42471239969, 2 tentativas cada) antes deste.
- **Observação para o dono do workflow (repetição do item de infra):** o 504/falha do `supabase/setup-cli@v1` se repetiu mais uma vez hoje. Os runs do bloco 547 caíram nesse passo repetidamente enquanto outros PRs rodavam normalmente no mesmo intervalo; pode ser coincidência de horário, não afirmo causa. A sugestão segue a mesma: fixar a versão do CLI e repetir o passo com espera, ou instalar por cache.
- Defeitos: nenhum novo de produto; L-108 livre; abertos L-104, L-107 (t1429, PR #3394), C17, E527 e E532 (i).
- Próximo bloco: 551 (grupo do 534).

## Vigia pós-bloco 550: C19, E527 ajustado e bloco 551

- Lab da main: verde em `624a5924a` (#3443) e `a844024e7` (#3444), docs da QA. Nenhum merge de código novo; drafts E714, E717, E719, E716 e E713 seguem abertos (specs prontas ou adiadas como registrado antes).
- **t1498 (PR #3447 draft, run 42475127749): verde.** T-C19 proposto pela QA (rodada 10:30): `/auth` sem rolagem lateral e `porta-formulario` dentro da tela. A 320, 360 e 375 px o defeito **reproduz no lab** (`test.fail` ligado ao item C19 da QA); a 390 e 1280 px é teste comum e passa. Correção é da pista dona do `/auth` (a QA aponta `grid min-h-screen lg:grid-cols-2` sem `grid-cols-1`).
- **t1494 (PR #3440 draft, run 42475085864): verde** com a medida ajustada a pedido da QA (rodada 10:45): o E527 agora mede o pixel mais escuro de cada amostra da legenda (preenchimento OU contorno, captura com folga de 3 px) para Disponível, Ocupado, Bloqueado e Hoje. Na main o `test.fail` segue valendo; com o #3432 (draft, anel `forest` no "Disponível") só o Disponível passa, Ocupado, Bloqueado e Hoje continuam abaixo de 3:1 segundo a QA. E532 (i) sem mudança.
- **Bloco 551 (t1499, PR #3448 draft, run 42475153661): verde.** Admin, busca, cidades, comparar, privacidade, segurança, termos e parceiros/buscar (grupo do 534).
- QA 10:30 ainda sem spec: T-R1 (a "Nova jornada de teste" do admin não pré-seleciona um anúncio [TESTE QA] com contrato ativo): precisa de sessão de admin e massa de teste; fica como proposta, sem prova logada nesta pista.
- Defeitos: nenhum novo meu; L-108 livre; abertos L-104, L-107 (t1429, PR #3394), C17, C19, E527 e E532 (i), todos com `test.fail` no lab.
- Infra do workflow: nenhum 504 nesta passada (as 3 corridas passaram de primeira).
- Próximo bloco: 552 (grupo do 535).

## Bloco 552

- Bloco 552 (t1500, PR #3450 draft, run 42476347198): verde. /dev/emails, /dashboard/qa/emails e /avisos/desligar (grupo do 535).
- Main: lab verde em `a844024e7` e `624a5924a`; nenhum merge de código novo desde o último registro (últimos: docs da QA, #3443 e #3444). Sem spec nova a criar.
- Sem 504 de infra nesta passada. Defeitos: nenhum novo; L-108 livre; abertos L-104, L-107 (t1429), C17, C19, E527 e E532 (i), todos com `test.fail` no lab.
- Próximo bloco: 553 (grupo do 536).

## Blocos 553, 554 e 555

- Bloco 553 (t1501, PR #3451 draft, run 42477355268): verde. Auth, sócios, modelo de negócio, ROI, simulação, contratos/locações, estadia e imóvel com id (grupo do 536).
- Bloco 554 (t1502, PR #3452 draft, run 42477357440): verde. Admin: ajuda da publicação, fotos de perfil, marketing, sócios, dados de teste, serviços, solicitações, pedidos de parceiros, encerramentos, retenção (grupo do 537).
- Bloco 555 (t1503, PR #3453 draft, run 42477360913): verde. Intenção, avaliação do imóvel, avaliadora e laudo (grupo do 538).
- Merge novo na main depois do último registro: nenhum (conferido ao fim da sequência; último de código segue o #3433; só docs da QA depois). Sem spec permanente nova a criar.
- Sem 504 de infra nesta passada. Defeitos: nenhum novo; L-108 livre; abertos L-104, L-107 (t1429), C17, C19, E527 e E532 (i), todos com `test.fail` no lab.
- Próximo bloco: 556 (grupo do 539).

## Blocos 556, 557 e 558

- Bloco 556 (t1504, PR #3456 draft, run 42478838521): verde. Painel do proprietário sem id (grupo do 539).
- Bloco 557 (t1505, PR #3457 draft, run 42478840889): verde. Painel do morador sem id (grupo do 540).
- Bloco 558 (t1506, PR #3458 draft, run 42478843153): verde. Públicas com parâmetro na URL (grupo do 541).
- Merge novo na main desde o último registro: nenhum (conferido no começo e no fim da sequência; sem merge de código desde o #3433). Sem spec permanente nova a criar.
- Sem 504 de infra. Defeitos: nenhum novo; L-108 livre; abertos L-104, L-107 (t1429), C17, C19, E527 e E532 (i), todos com `test.fail` no lab.
- Próximo bloco: 559 (grupo do 542).

## Blocos 559, 560 e 561 e a suíte noturna completa

- Bloco 559 (t1507, PR #3461 draft, run 42480742592): verde. Admin com id na URL (grupo do 542).
- Bloco 560 (t1508, PR #3462 draft, run 42480746797): verde. Compartilhadas sem id: proprietário e parceiro (grupo do 543).
- Bloco 561 (t1509, PR #3463 draft, run 42480748665): verde. Compartilhadas: morador, pedido de serviço, três papéis (grupo do 544).
- Merge novo de código na main depois do #3433: nenhum (conferido no começo e no fim). Últimos merges: docs da QA (#3443, #3444). Sem spec permanente nova a criar.
- **Lab crítico (`lab-critico.yml`) na main:** verde em `624a5924a` e `a844024e7` (runs 42471821068 e 42472878384).
- **Suíte noturna completa (`laboratorio.yml`, "Rodar a suíte E2E", ~65 min):** run 42471821063 em `624a5924a` terminou **com falha** no passo "Marcar a execução como falha se algum teste falhou" (a suíte rodou até o fim; o passo de infra `setup-cli` passou, sem 504). **Não consegui abrir a lista dos testes que falharam**: ela está no resumo do job e no artefato `laboratorio-42471821063` (173 MB), e o artefato não baixa daqui sem credencial; o log do job só traz a linha final. Causa provável: não classificável por mim agora (infra × código × teste vencido). O run de `a844024e7` (42472878415) estava em andamento ao fechar este registro. **Pedido ao chat principal:** abrir o "Resumo da noite" dessa run (ou o artefato) e me passar os nomes das specs vermelhas; eu classifico cada uma (defeito real × teste vencido × massa), corrijo spec vencida e proponho L-108 em diante para defeito real. Os `test.fail` conhecidos (L-104, L-107, C17, C19, E527, E532) seguem como estão, sem forçar verde.
- Defeitos novos na varredura: nenhum; L-108 livre.
- Próximo bloco: 562 (grupo do 545).

## Suíte noturna classificada (L-108) e blocos 562 a 564

### L-108 — a suíte noturna estoura o tempo e deixa a maior parte das specs sem rodar (defeito de laboratório; proposta de item para a lista-master)
- **Fonte:** registro das execuções em `public.lab_execucoes` (só leitura), porque o log do job não traz a lista de testes e o artefato `laboratorio-42471821063` (173 MB) não baixa sem credencial.
- **Run 42471821063 (`624a5924a`) e run 42472878415 (`a844024e7`), ambos "falha":** 637 passaram / 0 falharam / 3864 sem rodar, e 664 / 0 / 3837. A falha vem do passo "Marcar a execução como falha se algum teste falhou", porque a execução bate no `--global-timeout=3900000` (65 min, o passo "Rodar a suíte E2E" dura exatamente 65 min) e o Playwright sai com erro.
- **Cobertura efetiva:** em `624a5924a`, dos 838 arquivos de spec, só **117** tiveram algum teste passando (75 de 78 das de quatro dígitos `t1xxx`, e apenas 42 das outras 760). A ordem alfabética põe `t1…`, `t10…`, `t100…`, `t1000…t1xxx` antes das `t2…t9`, e as specs de varredura de bloco (t14xx, cada tela a 390 e 1280 px) gastam o orçamento antes. **~720 specs não rodam na noturna.**
- **É crônico e piora:** 31/10 a 07/11 passavam ~1000–1180 testes (com ~2500 sem rodar, ou seja, já cortava); depois de 07/11 à noite passam ~620–770 (com ~3700–3900 sem rodar). O total sobe junto com as specs novas.
- **Falhas reais registradas (nome → classificação):** t106, t113, t118, t141, t155 (e t161 uma vez, 47dc9da78) eram as "5 falhas fixas" da main até 09:24 UTC; o #3433 (Faixa D) as consertou → **teste vencido, já corrigido**. Nos três runs completos depois (`53c0bcc10`, `624a5924a`, `a844024e7`) não há spec vermelha.
- **Remédios possíveis (decisão do coordenador/dono do workflow; não apliquei):** (a) no workflow (`.github/workflows/laboratorio.yml`, fora do escopo da Pista C): dividir a suíte em fatias paralelas (matriz/shards) ou subir o tempo; (b) nas specs (escopo da Pista C, precisa de decisão): tirar as specs de varredura de bloco do noturno (rodam só no lab crítico e em PR, p. ex. por tag ou projeto Playwright separado) e/ou aposentar ciclos antigos de varredura que se repetem; (c) fazer o noturno falhar com mensagem própria ("estourou o tempo: X de Y specs rodaram") para não parecer spec vermelha.
- **Ressalva:** cada spec de bloco mesclada piora o L-108; avisei nos PRs #3468, #3469 e #3470. Nada foi apagado. Os `test.fail` conhecidos (L-104, L-107, C17, C19, E527, E532) seguem como estão.

### Blocos
- Bloco 562 (t1510, PR #3468 draft, run 42482773616): verde. Proposta e visita com id (grupo do 545).
- Bloco 563 (t1511, PR #3469 draft, run 42482776440): verde. Conferir, pedidos do morador, admin/sistema (grupo do 546).
- Bloco 564 (t1512, PR #3470 draft, run 42482780969): verde. Contrato, estadia e imóvel com id (grupo do 547).
- Merge novo de código na main depois do #3433: nenhum. Sem spec permanente nova a criar.
- Defeitos abertos: L-104, L-107 (t1429), L-108 (novo, acima), C17, C19, E527 e E532 (i). Próximo número livre: **L-109**.
- Próximo bloco: 565 (grupo do 548), a decidir com o coordenador se a varredura continua enquanto o L-108 não for tratado.

## Blocos 565, 566 e 567 e as propostas de mitigação do L-108 (decisão do coordenador/chat principal)

- Bloco 565 (t1513, PR #3472 draft, run 42484448803): verde. Início, ajuda, busca, imóvel e telas do proprietário (grupo do 548).
- Bloco 566 (t1514, PR #3473 draft, run 42484452212): verde. Admin, parceiros e visitas (grupo do 549).
- Bloco 567 (t1515, PR #3474 draft, run 42484455873): verde. Painéis do proprietário e do morador, /empresas (grupo do 550).
- Lab da main (conferido uma vez ao fim): lab crítico verde em `a844024e7` (run 42472878384); sem merge de código novo desde o #3433. A suíte noturna segue "falha" só por tempo estourado (L-108), sem spec vermelha.
- Defeitos novos: nenhum. Abertos: L-104, L-107 (t1429), L-108, C17, C19, E527, E532 (i). Próximo livre: L-109.

### L-108 — propostas de mitigação (nenhuma aplicada; a decisão é do coordenador/chat principal)
Base: nos runs completos de 08/11 a noturna passa ~620–770 testes e deixa ~3700–3900 sem rodar; só ~117 dos 838 arquivos de spec têm algum teste que passa; as specs de varredura de bloco (t14xx, ~116 arquivos já na main, cada tela a 390 e 1280 px) e a ordem alfabética consomem os 65 min antes das `t2…t9`.

| # | Mitigação | Custo | Benefício | Risco / observação |
|---|---|---|---|---|
| 1 | **Dividir a suíte em fatias paralelas** (matriz de jobs / `--shard`), cada uma com o seu tempo | Mexe em `.github/workflows/laboratorio.yml` (fora do escopo da Pista C); cada fatia repete a subida do Supabase e o build (~8 min de setup por fatia) e gasta minutos do Actions em proporção ao número de fatias | Cobre **tudo** sem apagar nada: com 4 fatias o tempo cai para ~1/4 de ~4500 testes; falha identifica a fatia | Massa e banco por fatia (isolar o Supabase local por job); definir fatias estáveis para o relatório; a regra do banco `lab_execucoes` precisa somar fatias |
| 2 | **Tirar a varredura de bloco do noturno** (projeto Playwright/tag próprios; ela roda no lab crítico e em PR, ou num job semanal) | Pequeno nas specs (uma tag/projeto e um `--grep-invert`), mais um ajuste no workflow para o novo job | Libera a maior parte do orçamento hoje gasto (os ~116 arquivos t14xx), fazendo as `t2…t9` voltarem a rodar na noite | A varredura deixa de rodar toda noite (risco de regressão visual fora de PR); precisa de job próprio para não sumir |
| 3 | **Aposentar ciclos antigos de varredura que se repetem** (cada bloco repete o grupo de 17 blocos antes; manter só o ciclo mais recente por grupo) | Decisão editorial e trabalho de uma passada: apagar/mesclar specs e atualizar `cobertura.json` e a numeração | Reduz o tempo de todo job (noturno, PR e lab crítico) sem mexer em workflow; menos manutenção | **Perde histórico e a cobertura de telas só presentes nos ciclos antigos**; irreversível se não houver git (há); é a opção que mais mexe nas specs |
| 4 | **Noturno honesto sobre o tempo**: falhar com mensagem própria ("estourou o tempo: X de Y specs rodaram"), gravar `nao_rodaram` e ordenar as specs por risco (críticas primeiro) | Pequeno no workflow e no registrador; sem apagar nada | Para de parecer spec vermelha; deixa o problema visível (o número que importa é "quantas rodaram"); a ordem por risco garante que o crítico rode primeiro | **Não resolve a cobertura**, só a transparência; precisa de uma lista de specs críticas (já existe `scripts/lab/fluxos-criticos.mjs`) |

- **Leitura da Pista C (opinião, não decisão):** o remédio completo é 1 (cobertura) + 4 (transparência); a 2 é a mais barata e rápida para devolver as `t2…t9` à noite; a 3 só se o custo de manter a varredura continuar alto depois das outras.
- Enquanto isso, a Pista C segue abrindo blocos em PR draft (não mesclados, portanto sem efeito na noturna) e não apaga nada.
- Próximo bloco: 568 (grupo do 551).

## Bloco 568

- Bloco 568 (t1516, PR #3475 draft, run 42485637435): verde. Admin (atendimento, contratos, candidaturas), busca, cidades, comparar, privacidade, segurança, termos e parceiros/buscar (grupo do 551).
- Lab da main: lab crítico verde em `a844024e7` e `624a5924a`; nenhum merge de código novo depois do #3433 (nem docs novas da QA além da rodada 10:45). Sem spec permanente nova a criar. Suíte noturna segue "falha" só por tempo estourado (L-108), com as propostas de mitigação registradas acima, à espera do coordenador.
- Defeitos novos: nenhum. Abertos: L-104, L-107 (t1429), L-108, C17, C19, E527, E532 (i). Próximo livre: L-109.
- Próximo bloco: 569 (grupo do 552).

## Bloco 569

- Bloco 569 (t1517, PR #3476 draft, run 42486601163): verde. /dev/emails, /dashboard/qa/emails e /avisos/desligar (grupo do 552).
- Lab da main: lab crítico verde em `a844024e7` e `624a5924a`; nenhum merge de código novo depois do #3433. Sem teste permanente novo a rodar (zero merges novos de código desde a última rodada: 0 de 0). Noturna segue "falha" só por tempo estourado (L-108), sem spec vermelha.
- Defeitos novos: nenhum. Abertos: L-104, L-107 (t1429), L-108, C17, C19, E527, E532 (i). Próximo livre: L-109.
- Próximo bloco: 570 (grupo do 553).

## Bloco 570

- Bloco 570 (t1518, PR #3477 draft, run 42487399895): verde. Auth, sócios, modelo de negócio, ROI, simulação, contratos/locações, estadia e imóvel com id (grupo do 553).
- Lab da main: lab crítico verde em `a844024e7`; zero merges de código novos desde o #3433 (conferido de novo ao fim). Testes permanentes novos a rodar: 0 de 0. Noturna segue "falha" só por tempo estourado (L-108), sem spec vermelha.
- Defeitos novos: nenhum. Abertos: L-104, L-107 (t1429), L-108, C17, C19, E527, E532 (i). Próximo livre: L-109.
- Próximo bloco: 571 (grupo do 554).

## Bloco 571

- Bloco 571 (t1519, PR #3480 draft, run 42489062720): verde. Admin: ajuda da publicação, fotos de perfil, marketing, sócios, dados de teste, serviços, solicitações, pedidos de parceiros, encerramentos, retenção (grupo do 554). Sem imagem vazia/quebrada, sobreposição, estouro horizontal, texto cortado nem grade desalinhada.
- Lab da main: lab crítico verde em `a844024e7`; zero merges de código novos desde o #3433 (conferido de novo ao fim), então nenhuma spec quebrada por merge para corrigir. Noturna segue "falha" só por tempo estourado (L-108), sem spec vermelha.
- Defeitos novos: nenhum. Abertos: L-104, L-107 (t1429), L-108, C17, C19, E527, E532 (i). Próximo livre: L-109.
- Próximo bloco: 572 (grupo do 555).

## Bloco 572

- Bloco 572 (t1520, PR #3481 draft, run 42490019540): verde. Intenção, avaliação do imóvel, avaliadora e laudo (grupo do 555).
- Lab da main: lab crítico verde em `a844024e7`; zero merges de código novos desde o #3433 (conferido ao fim). Testes permanentes novos a rodar: 0 de 0. Noturna segue "falha" só por tempo estourado (L-108).
- Defeitos novos: nenhum. Abertos: L-104, L-107, L-108, C17, C19, E527, E532 (i). Próximo livre: L-109.
- Próximo bloco: 573 (grupo do 556).

## Bloco 573

- Bloco 573 (t1521, PR #3482 draft, run 42490984668): verde. Painel do proprietário sem id: agenda, carteira, ganhos, recibos, respostas rápidas, simulador, ferramentas (grupo do 556). Só no laboratório, 390 e 1280 px, sem imagem vazia/quebrada, sobreposição de fixo, cartão sem foto, estouro horizontal, texto cortado nem grade desalinhada.
- Estado da main: head `a844024e7`, lab crítico verde (run 42472878384); nenhum merge de código novo desde o #3433 (conferido no começo e no fim): testes permanentes novos 0 de 0. Noturna segue "falha" só por tempo estourado (L-108).
- Defeitos novos: nenhum. Abertos: L-104, L-107, L-108, C17, C19, E527, E532 (i). Próximo livre: L-109.
- Próximo bloco: 574 (grupo do 557).

## Bloco 574

- Bloco 574 (t1522, PR #3483 draft, run 42492178243): verde. Painel do morador sem id: painel, avaliações, buscas, comparar, conta, fechamento, garantias, reembolsos, solicitações, verificação (grupo do 557). Só no laboratório, 390 e 1280 px, sem imagem vazia/quebrada, sobreposição de fixo, cartão sem foto, estouro horizontal, texto cortado nem grade desalinhada.
- Estado da main: head `a844024e7`, lab crítico verde (run 42472878384); nenhum merge de código novo desde o #3433 (conferido no começo e no fim): testes permanentes novos 0 de 0. Noturna segue "falha" só por tempo estourado (L-108).
- Defeitos novos: nenhum. Abertos: L-104, L-107, L-108, C17, C19, E527, E532 (i). Próximo livre: L-109.
- Próximo bloco: 575 (grupo do 558).

## Blocos 575, 576 e 577

- Bloco 575 (t1523, PR #3484 draft, run 42493524991): verde. Públicas com parâmetro na URL (grupo do 558).
- Bloco 576 (t1524, PR #3485 draft, run 42493528281): verde. Admin com id na URL (grupo do 559).
- Bloco 577 (t1525, PR #3486 draft, run 42493532087): verde. Compartilhadas sem id: proprietário e parceiro (grupo do 560).
- Só no laboratório, 390 e 1280 px: sem imagem vazia/quebrada, sobreposição de fixo, cartão sem foto, estouro horizontal, texto cortado nem grade desalinhada.
- Estado da main (conferido no começo e ao fim de cada bloco): head `a844024e7`, lab crítico verde (run 42472878384); nenhum merge de código novo desde o #3433. Noturna segue "falha" só por tempo estourado (L-108).
- Defeitos novos: nenhum. Abertos: L-104, L-107, L-108, C17, C19, E527, E532 (i). Próximo livre: L-109.
- Próximo bloco: 578 (grupo do 561).

## Bloco 578

- Bloco 578 (t1526, PR #3487 draft, run 42495027113): verde. Compartilhadas: morador, pedido de serviço pelos dois lados, três papéis (grupo do 561). Só no laboratório, 390 e 1280 px, sem imagem vazia/quebrada, sobreposição de fixo, estouro horizontal, texto cortado nem grade desalinhada.
- Estado da main: head `a844024e7`, lab crítico verde (run 42472878384); nenhum merge de código novo desde o #3433 (conferido no começo e no fim): testes permanentes novos 0 de 0. Noturna segue "falha" só por tempo estourado (L-108).
- Defeitos novos: nenhum. Abertos: L-104, L-107, L-108, C17, C19, E527, E532 (i). Próximo livre: L-109.
- Próximo bloco: 579 (grupo do 562).

## Bloco 579

- Bloco 579 (t1527, PR #3490 draft, run 42497167308): verde. Propostas/[id] e visitas/[id] (grupo do 562). Só no laboratório, 390 e 1280 px, página inteira rolada, sem imagem vazia/quebrada, sobreposição de fixo, estouro horizontal, texto cortado nem grade desalinhada.
- Estado da main: head `a844024e7`, lab crítico verde (run 42472878384); nenhum merge de código novo desde o #3433 (conferido no começo e no fim): testes permanentes novos 0 de 0. Noturna segue "falha" só por tempo estourado (L-108).
- Defeitos novos: nenhum. Abertos: L-104, L-107, L-108, C17, C19, E527, E532 (i). Próximo livre: L-109.
- Próximo bloco: 580 (grupo do 563).

## Blocos 580, 581 e 582 e a t1498 para o C19 corrigido

- Bloco 580 (t1528, PR #3492 draft, run 42498428382): verde. Conferir, conferir/[codigo], pedidos do morador, admin/sistema (grupo do 563).
- Bloco 581 (t1529, PR #3493 draft, run 42498430740): verde. Contrato, estadia e imóvel com id (grupo do 564).
- Bloco 582 (t1530, PR #3494 draft, run 42498435308): verde. Início, ajuda, busca e telas do proprietário (grupo do 565).
- Só no laboratório, 390 e 1280 px, sem imagem vazia/quebrada, sobreposição de fixo, estouro horizontal, texto cortado nem grade desalinhada.
- **C19 corrigido pela Pista A no draft #3489** (branch `claude-a/c19-auth-sem-rolagem`: `src/app/auth/page.tsx`, prova de 0 px de 320 a 1280 px). **t1498 versão corrigida (PR #3495 draft, base = branch do #3489, run 42498441042): verde** sobre o código do #3489, sem `test.fail`, teste comum a 320, 360, 375, 390 e 1280 px. **Dependência:** só passa com o #3489. Enquanto o #3489 não mergear, a versão do PR #3447 (com `test.fail` abaixo de 378 px) é a que vale; após o merge do #3489 sem esta troca ela passaria a "passar inesperadamente". Quando o #3489 mergear: base do #3495 passa para a main (eu ajusto), o #3447 perde o sentido (fechamento é do Daniel) e **o C19 sai da lista de defeitos abertos**.
- Estado da main: head `a844024e7`, lab crítico verde (run 42472878384); nenhum merge de código novo desde o #3433 (conferido no começo e ao fim): testes permanentes novos 0 de 0. Noturna segue "falha" só por tempo estourado (L-108).
- Defeitos novos: nenhum. Abertos: L-104, L-107, L-108, C17, C19 (corrigido no #3489, aguardando merge), E527, E532 (i). Próximo livre: L-109.
- Próximo bloco: 583 (grupo do 566).

## Blocos 583, 584 e 585

- Bloco 583 (t1531, PR #3500 draft, run 42499632174): verde. Serviços e visitas, admin e parceiros (grupo do 566).
- Bloco 584 (t1532, PR #3501 draft, run 42499634861): verde. Painéis do morador e do proprietário, /empresas, /para-proprietarios (grupo do 567).
- Bloco 585 (t1533, PR #3502 draft, run 42499637981): verde. Cidade, institucionais, parceiros, comparar e admin (grupo do 568).
- Só no laboratório, 390 e 1280 px, sem imagem vazia/quebrada, sobreposição de fixo, estouro horizontal, texto cortado nem grade desalinhada.
- Estado da main (conferido antes dos blocos e ao fim): head `a844024e7`, lab crítico verde (run 42472878384); nenhum merge de código novo desde o #3433: testes permanentes novos 0 de 0. O #3489 (C19) segue aberto, não mergeado: a t1498 do #3447 (com `test.fail`) continua a versão válida; a corrigida (#3495) aguarda o merge do #3489. Noturna segue "falha" só por tempo estourado (L-108).
- Defeitos novos: nenhum. Abertos: L-104, L-107, L-108, C17, C19 (corrigido no #3489, aguardando merge), E527, E532 (i). Próximo livre: L-109.
- Próximo bloco: 586 (grupo do 569).

## Bloco 586

- Bloco 586 (t1534, PR #3507 draft, run 42500588866): verde. /dev/emails, /dashboard/qa/emails e /avisos/desligar (grupo do 569). Só no laboratório, 390 e 1280 px, sem imagem vazia/quebrada, sobreposição de fixo, estouro horizontal, texto cortado nem grade desalinhada.
- Estado da main (conferido no começo e ao fim): head `a844024e7`, lab crítico verde (run 42472878384); nenhum merge de código novo desde o #3433: testes permanentes novos 0 de 0. O #3489 (C19) segue aberto, sem merge. Noturna segue "falha" só por tempo estourado (L-108).
- Defeitos novos: nenhum. Abertos: L-104, L-107, L-108, C17, C19 (corrigido no #3489, aguardando merge), E527, E532 (i). Próximo livre: L-109.
- Próximo bloco: 587 (grupo do 570).

## Bloco 587

- Bloco 587 (t1535, PR #3508 draft, run 42501663406): verde. Auth, sócios, modelo de negócio, ROI, simulação, contratos/locações, estadia e imóvel com id (grupo do 570). Só no laboratório, 390 e 1280 px, sem imagem vazia/quebrada, sobreposição de fixo, estouro horizontal, texto cortado nem grade desalinhada.
- Estado da main (conferido no começo e ao fim): head `a844024e7`, lab crítico verde (run 42472878384); nenhum merge de código novo desde o #3433: testes permanentes novos 0 de 0. O #3489 (C19) segue aberto, sem merge. Noturna segue "falha" só por tempo estourado (L-108).
- Defeitos novos: nenhum. Abertos: L-104, L-107, L-108, C17, C19 (corrigido no #3489, aguardando merge), E527, E532 (i). Próximo livre: L-109.
- Próximo bloco: 588 (grupo do 571).

## Bloco 588

- Bloco 588 (t1536, PR #3511 draft, run 42504283653): verde. Admin: ajuda da publicação, fotos de perfil, marketing, sócios, dados de teste, serviços, solicitações, pedidos de parceiros, encerramentos, retenção (grupo do 571). Só no laboratório, 390 e 1280 px, sem imagem vazia/quebrada, sobreposição de fixo, estouro horizontal, texto cortado nem grade desalinhada.
- Estado da main (conferido no começo e ao fim): head `a844024e7`, lab crítico verde (run 42472878384); nenhum merge de código novo desde o #3433: testes permanentes novos 0 de 0. O #3489 (C19) segue aberto, sem merge. Noturna segue "falha" só por tempo estourado (L-108).
- Defeitos novos: nenhum. Abertos: L-104, L-107, L-108, C17, C19 (corrigido no #3489, aguardando merge), E527, E532 (i). Próximo livre: L-109.
- Próximo bloco: 589 (grupo do 572).

## Bloco 589

- Bloco 589 (t1537, PR #3512 draft, run 42505504522): verde. Intenção, avaliação do imóvel, avaliadora e laudo (grupo do 572). Só no laboratório, 390 e 1280 px, sem imagem vazia/quebrada, sobreposição de fixo, estouro horizontal, texto cortado nem grade desalinhada.
- Estado da main (conferido no começo e ao fim): head `a844024e7`, lab crítico verde (run 42472878384); nenhum merge de código novo desde o #3433: sem merge sem spec de guarda. O #3489 (C19) segue aberto, sem merge. Noturna segue "falha" só por tempo estourado (L-108).
- Defeitos novos: nenhum. Abertos: L-104, L-107, L-108, C17, C19 (corrigido no #3489, aguardando merge), E527, E532 (i). Próximo livre: L-109.
- Próximo bloco: 590 (grupo do 573).

## Bloco 590 e achado de operação (L-109, proposta)

- Bloco 590 (t1538, PR #3513 draft, run 42506644588): verde. Painel do proprietário sem id (grupo do 573). Só no laboratório, 390 e 1280 px.
- Estado da main (conferido no começo e ao fim): head `a844024e7`, lab crítico verde (run 42472878384); nenhum merge de código novo desde o #3433: sem merge sem spec de guarda. O #3489 (C19) segue aberto, sem merge. Noturna do laboratório segue "falha" só por tempo estourado (L-108).
- **L-109 (proposta ao chat principal; achado de operação, fora do escopo da Pista C):** na main (`a844024e7`) os workflows **Backup noturno** (run 42485195051, 13:29 UTC) e **Teste de restauração** (run 42497108612, 15:53 UTC) **falham no mesmo passo**, "Montar o rclone.conf temporário (600) com o remoto cifrado" (passo 5 no backup, passo 6 no drill); o passo seguinte ("Cópia (banco, arquivos, manifesto e retenção)" / "Restaurar e conferir") é **pulado**, e "Registrar no admin e alarmar" também falha. Efeito: a cópia noturna **não está sendo feita** e a restauração não está sendo provada. Causa provável, não confirmada (a mensagem do passo não aparece no log que consegui ler): segredo/remoto cifrado do rclone ausente ou mal formado, o que pode depender de dado só do Daniel. Não corrijo; item para o dono desses workflows.
- Defeitos abertos: L-104, L-107, L-108, **L-109 (novo, proposto)**, C17, C19 (corrigido no #3489, aguardando merge), E527, E532 (i). Próximo livre: **L-110**.
- Próximo bloco: 591 (grupo do 574).

## E708 reconferido e bloco 591

- **E708 (L-106) reconferido na main `a844024e7`:** `ROTA_CONTA_LINKEDIN` (`src/lib/linkedin/rotas.ts`) = `/dashboard/conta/seguranca`; nenhuma referência do LinkedIn a `/dashboard/conta/privacidade` em `src` (só o comentário do teste `e708-rotas-de-retorno.test.ts`); t323 e t351 cobrem o fluxo no lab, e a t323 está no conjunto do lab crítico, verde no head (run 42472878384). Conclusão: as rotas de retorno não apontam mais para a página antiga; prova de pé, nada a reabrir.
- Bloco 591 (t1539, PR #3514 draft, run 42507658007): verde. Painel do morador sem id: painel, avaliações, buscas, comparar, conta, fechamento, garantias, reembolsos, solicitações, verificação (grupo do 574). Só no laboratório, 390 e 1280 px.
- Estado da main (começo e fim): head `a844024e7`, lab crítico verde; nenhum merge de código novo desde o #3433. Noturna segue "falha" só por tempo estourado (L-108).
- Defeitos abertos: L-104, L-107, L-108, L-109 (backup/restauração, proposto), C17, C19 (corrigido no #3489, aguardando merge), E527, E532 (i). Próximo livre: L-110. Nenhum defeito novo nesta passada.
- Próximo bloco: 592 (grupo do 575).

## Blocos 592, 593 e 594

- Bloco 592 (t1540, PR #3517 draft, run 42509133209): verde. Públicas com parâmetro na URL (grupo do 575).
- Bloco 593 (t1541, PR #3518 draft, run 42509135851): verde. Admin com id na URL (grupo do 576).
- Bloco 594 (t1542, PR #3519 draft, run 42509140332): verde. Compartilhadas sem id: proprietário e parceiro (grupo do 577).
- Só no laboratório, 390 e 1280 px, sem imagem vazia/quebrada, sobreposição de fixo, estouro horizontal, texto cortado nem grade desalinhada.
- Estado da main (começo e fim): head `a844024e7`, lab crítico verde (run 42472878384); nenhum merge de código novo desde o #3433: testes permanentes novos 0 de 0. Noturna segue "falha" só por tempo estourado (L-108).
- Defeitos novos: nenhum. Abertos: L-104, L-107, L-108, L-109 (backup/restauração, proposto), C17, C19 (corrigido no #3489, aguardando merge), E527, E532 (i). Próximo livre: L-110.
- Próximo bloco: 595 (grupo do 578).

## Blocos 595, 596 e 597

- Bloco 595 (t1543, PR #3521 draft, run 42510498351): verde: compartilhadas: morador, pedido de serviço, três papéis (grupo do 578).
- Bloco 596 (t1544, PR #3522 draft, run 42510501099): verde: proposta e visita com id (grupo do 579).
- Bloco 597 (t1545, PR #3523 draft, run 42510504517): verde: conferir, pedidos do morador, admin/sistema (grupo do 580).
- Só no laboratório, 390 e 1280 px, sem imagem vazia/quebrada, sobreposição de fixo, estouro horizontal, texto cortado nem grade desalinhada.
- Estado da main (começo e fim): head `a844024e7`, lab crítico verde (run 42472878384); nenhum merge de código novo desde o #3433: testes permanentes novos 0 de 0. Noturna segue "falha" só por tempo estourado (L-108).
- Defeitos novos: nenhum. Abertos: L-104, L-107, L-108, L-109 (backup/restauração, proposto), C17, C19 (corrigido no #3489, aguardando merge), E527, E532 (i). Próximo livre: L-110.
- Próximo bloco: 598 (grupo do 581).

## Blocos 598, 599 e 600

- Bloco 598 (t1546, PR #3525 draft, run 42512106100): verde: contrato, estadia e imóvel com id (grupo do 581).
- Bloco 599 (t1547, PR #3526 draft, run 42512109322): verde: início, ajuda, busca e proprietário (grupo do 582).
- Bloco 600 (t1548, PR #3527 draft, run 42512112428): verde: serviços e visitas, admin, parceiros (grupo do 583).
- Só no laboratório, 390 e 1280 px, sem imagem vazia/quebrada, sobreposição de fixo, estouro horizontal, texto cortado nem grade desalinhada.
- Estado da main (começo e fim): head `a844024e7`, lab crítico verde (run 42472878384); nenhum merge de código novo desde o #3433: testes permanentes novos 0 de 0. Noturna segue "falha" só por tempo estourado (L-108).
- Defeitos novos: nenhum. Abertos: L-104, L-107, L-108, L-109 (backup/restauração, proposto), C17, C19 (corrigido no #3489, aguardando merge), E527, E532 (i). Próximo livre: L-110.
- Próximo bloco: 601 (grupo do 584).

## Parada da varredura de blocos (recomendação ao coordenador) — fila possivelmente vencida

- **Estado da main (conferido uma vez):** head `a844024e7`, lab crítico verde (run 42472878384); **nenhum merge de código novo desde o #3433**, então nada quebrou, nenhum teste permanente novo a criar e nenhuma "superfície de merge recente" a varrer. Os drafts das outras pistas seguem abertos (#3489 C19, #3395 E714, #3396 E717, #3397/#3398 E719, #3408 E713). Nenhum prova/reprova ao vivo.
- **Contagem dos meus PRs abertos:** 66 em draft, todos `mergeable: clean`: **58 blocos de varredura (543 a 600)** e 8 de specs (t1484, t1485, t1486, t1489, t1491, t1494, t1498 nas duas versões). Nenhum bloco foi mesclado desde o 522.
- **Retorno decrescente:** dos blocos 523 a 600, **zero defeito novo de produto**; todos os vermelhos foram falha de infraestrutura (504 do `setup-cli`) ou erro da própria spec, já corrigidos. Cada bloco repete um grupo de telas varrido 3 a 4 vezes na 16ª volta do ciclo.
- **Custo:** cada bloco mesclado entra na ordem alfabética `t1…` da noturna e piora o L-108 (já só ~117 de 838 specs rodam à noite); e todos os PRs editam `tests/e2e/cobertura.json`, então mesclar vários em sequência tende a gerar conflito de linhas nos seguintes.
- **Decisão pedida (coordenador/chat principal):** (a) **pausar a criação de blocos novos** até o L-108 ter remédio; (b) **consolidar** a varredura (um único job/projeto semanal de varredura, em vez de ~58 arquivos), ou mesclar só os blocos de grupos ainda não varridos; (c) priorizar o que tem valor de guarda: a t1486 (C17), a t1494 (E527/E532), a t1498 (C19) e as specs do E714/E717. A Pista C **não fecha nem apaga nenhum PR** e **não abre o bloco 601** enquanto não houver essa decisão ou um merge novo na main para guardar.
- Defeitos abertos: L-104, L-107, L-108, L-109 (backup/restauração, proposto), C17, C19 (corrigido no #3489, aguardando merge), E527, E532 (i). Próximo livre: L-110.

## Decisão do Muse (08/11) sobre a varredura — em vigor

- **Decisão:** (1) **pausar a criação de blocos novos** enquanto os 58 blocos e 8 specs em draft não drenarem pelo merge; (2) **priorizar as specs de guarda** t1486, t1494, t1498 e as do E714 e do E717; (3) manter o lab crítico verde e corrigir spec quebrada de merge novo quando houver. A consolidação da varredura em job semanal fica para depois da drenagem. Fila dirigida de merges que destravam a Pista C: #3401 → #3406 → #3402 → #3437+#3459 → #3297, além dos drafts de A e B.
- **Cumprimento:** a Pista C **não abre mais PR de bloco**. Os blocos 601, 602 e 603 já tinham sido gerados e empurrados quando a decisão chegou (ramos `claude-c/bloco601`, `claude-c/bloco602`, `claude-c/bloco603`, specs t1549, t1550 e t1551, sem PR aberto e sem rodar no lab); ficam **parados, sem PR**, e não os apago (regra de não apagar ramo remoto). Se o coordenador quiser, abro os PRs depois da drenagem.
- **Guia de merge das specs de guarda (ordem sugerida, tudo em draft e `mergeable`/`clean` no último conferido):**
  1. #3440 (t1494: E527 e E532 (i) como `test.fail`, sobre a main).
  2. #3424 (t1486: C16 comum a 360 e 390 px, C17 como `test.fail`, sobre a main).
  3. #3495 (t1498 **corrigida**, base = branch do #3489) **depois do #3489**; **não mesclar o #3447** (t1498 com `test.fail` abaixo de 378 px), que passaria a falhar com "passou quando devia falhar" depois do #3489. Se o #3489 não vier, o #3447 é o que vale.
  4. #3421 (t1484: E714) depois do #3395, e #3422 (t1485: E717) depois do #3396; ao mergear o draft de cada uma, trocar a base do PR da spec para a main.
  5. Menores e independentes, na sequência: #3429 (t1489: janelas da busca) e #3434 (t1491: E452 negativo e E436).
  - Observação: todos editam `tests/e2e/cobertura.json`; o 2º PR em diante pode precisar de uma mesclagem da main no ramo (resolvo no meu PR, sem pedir ao Daniel).
- Estado da main (conferido): head `a844024e7`, lab crítico verde (run 42472878384); nenhum merge de código novo desde o #3433. Defeitos abertos: L-104, L-107, L-108, L-109 (backup/restauração, proposto), C17, C19 (corrigido no #3489, aguardando merge), E527, E532 (i). Próximo livre: L-110.

## Atualização — main em `143ad20ad`, specs de guarda e fila de blocos

- **Specs de guarda, vereditos no lab crítico (bases já em `main`):** t1498 corrigida (#3495), t1485/E717 (#3422), t1486 (#3424), t1494 (#3440), t1489 (#3429) e t1491 (#3434) verdes. A t1484/E714 (#3421) falhou por spec desatualizada (a redação mesclada é "O dono paga a avaliação, não o resultado"), foi corrigida no commit `4e8102d99` e ficou **verde** (run 42518504034). A t1428/E686 (#3270) aceita as duas redações. Recomendação: **não mesclar o #3447** (t1498 com `test.fail(w < 378)`, vale o #3495 depois do #3489).
- **E742 (L-104) e E743 (L-107):** causa provável e evidência em `scripts/lab/evidencia-e742-e743-2026-11-08.md`; correção é das pistas donas.
- **Último bloco verde: 600** (t1548, #3527, run 42512112428), não o 591. Os blocos 601–603 estão em ramos `claude-c/bloco601|602|603`, sem PR e sem rodar. **Não abri o bloco 601:** a pausa do Muse (08/11) segue valendo e ainda há dezenas de blocos em draft sem drenar (de #1409 a #3527). Se o Daniel quiser retomar mesmo assim, é só dizer; o 601 é o próximo.
- Defeitos abertos: L-104, L-107, L-108, L-109 (proposto), C17, E527, E532(i). Próximo livre: L-110. Sem achado novo nesta atualização.

## Specs de guarda dos drafts de 08/11 (20h40) — t1560 a t1564, todas em draft sobre o ramo do draft que cobrem

| Spec | PR | Item (draft) | Lab crítico |
|---|---|---|---|
| t1560 | #3538 | E734, foco volta a `pilula-mais` (T-C17), Esc/X/fundo, 1280 e 390 (#3533) | verde (42520959748) |
| t1561 | #3539 | E732, contraste do rótulo de /empresas ≥ 4,5:1 medido em pixels (#3530) | verde (42520964513) |
| t1562 | #3540 | E742, `/api/proximidades` 200 `sem_endereco`; 400 mantido para entrada inválida e anúncio alheio (#3531) | verde (42520970241) |
| t1563 | #3541 | E743, `/nivel` com laudo assinado abre, selo e hash `select-all` (#3532) | verde no 2º run (42521874502). O 1º (42520974587) falhou por defeito de spec: marcador `laudo-assinatura` herdado da t1429 antiga; o produto usa `selo-assinatura` |
| t1564 | #3542 | E724, aviso do exemplo é o 1º elemento do cartão e fica acima do preço (#3498) | verde (42520976878) |

- Nenhum achado novo de produto (próximo livre: **L-110**).
- A t1429 do #3394 (ramo `-limpo`) já usa os marcadores certos do selo; a cópia antiga (ramo `claude-c/t1429-e691`) tem o marcador errado e não deve ser usada.
- Quando os drafts mesclarem: tirar o `test.fail` do C17 na t1486 (#3424) e do L-107 na t1429 (#3394), tirar `conhecidoL104` das specs de bloco e trocar a base destes cinco PRs para `main`.

## Sequência do Muse (21h) — limpeza pós-merge e prova do E219

- **Limpeza pós-merge: ainda não dá.** Os drafts #3533, #3530, #3531, #3532 e #3498 seguem **abertos** (main parada em `143ad20ad`). Tirar o `test.fail` do C17 (t1486/#3424) e do L-107 (t1429/#3394), tirar `conhecidoL104` das specs de bloco e trocar a base de #3538–#3542 para `main` só faz sentido depois do merge de cada draft: antes disso, as specs ficariam vermelhas na main (a correção não está lá). Fica a lista de ações por draft: #3533 → t1486 (C17); #3532 → t1429 (L-107); #3531 → `conhecidoL104` nas specs de bloco (t1418 e as que copiam o padrão); #3530, #3498 e #3533 → base de #3539, #3542 e #3538 para `main`.
- **Re-rodar as cinco specs na main atual:** a main não mudou desde os runs verdes (t1560, t1561, t1562, t1564 verdes; t1563 verde no 2º run). Nada a re-rodar; roda de novo no primeiro merge.
- **E219 (prova):** a t612 já cobre 2 cartões (360/390/1280). Nova **t1565 (#3544, draft sobre a main)**: 4 cartões, com e sem horário, nomes sem ponto de quebra, 320/360/390/1280, sem rolagem lateral e sem horário inventado. Só spec; a tela é da Pista A.

## Sequência de 21h15 — estado, varredura e specs dos merges sem guarda

1. **Lab verde:** t1565 (E219, #3544) **verde** (run 42522980194). Main parada em `143ad20ad`, sem merge novo desde as 19h50; os cinco drafts (#3533, #3530, #3531, #3532, #3498) seguem abertos. Nenhuma spec vermelha nova; nenhum item novo para a lista-master.
2. **Varredura por blocos: não retomada.** Último bloco verde: 600 (#3527). Os blocos 601–603 estão prontos em ramo, mas a pausa de blocos novos do Muse (08/11) segue valendo e a fila de drafts não drenou. Motivo registrado; o 601 abre assim que a pausa cair.
3. **Specs dos merges novos sem guarda:** **t1566 (#3546, draft sobre a main)** cobre E718, E720, E723, E726, E730 e E731 a 390 e 1280 px (E718 com imagem carregada de verdade). Os merges #3356 (bom saber), #3489 (C19, t1498), #3395 (E714, t1484) e #3396 (E717, t1485) já têm guarda. #3520 (troca CDL→ACIUB) é só texto de premissas e é coberto pela t1191.

## Sequência de 21h25 — foto do estado

- **Main** parada em `143ad20ad` (lab crítico verde). Drafts #3533, #3530, #3531, #3532 e #3498 ainda abertos. Nenhuma spec vermelha por merge novo.
- **t1566 (#3546) verde** (run 42524050023): guarda de E718, E720, E723, E726, E730 e E731 a 390 e 1280 px. Todos os merges do dia têm guarda de lab.
- **Varredura por blocos:** não avançou; a pausa do Muse segue valendo (último bloco verde: 600; 601–603 prontos em ramo, sem PR). Nenhum achado novo (próximo livre: L-110).

## Missão da noite (prazo 07:00 CST) — foto das 21h35

- **Main** em `b2934fb2a` (entrou o #3401, E689/0328); lab crítico da main **verde** (run 42525051927). Drafts #3533, #3530, #3531, #3532 e #3498 ainda abertos.
- **Specs de guarda a drenar:** #3538–#3542 (E734, E732, E742, E743, E724), #3544 (t1565, E219), #3546 (t1566) — todas verdes e em draft; a drenagem é por merge (decisão do Muse/Daniel, eu não faço merge). Prioridade por valor de guarda: t1486 (#3424), t1494 (#3440), t1498 (#3495), t1484 (#3421, E714), t1485 (#3422, E717).
- **Spec do merge novo:** E687/0326 → **t1567 (#3548)**, guarda de banco (`parceiros.dados_categoria`). E689/0328 só mexe em dados de contas de teste da produção (ids fixos), sem massa no lab; fica guardada pelo teste de unidade `massa-estadia-semente-datas-0328.test.ts`.
- **Ainda não mesclados** (specs saem quando entrarem): E699, E690, E721, E688, E722, E682, E707, E725, E727, E728, E719, E713, E724, E729 e migrações 0329–0335.
- **Varredura por blocos:** segue sem bloco novo (pausa do Muse); as superfícies recém-mergeadas do dia estão cobertas pelas specs t1560–t1567.

## Vigia das 21h55 — vereditos

- **t1567 (#3548, E687/0326): verde** (run 42526112937).
- **Bloco 602 (#3553, t1550): verde** (run 42526520335). **Bloco 603 (#3554, t1551): verde** (run 42526539684). Mesclada a main nos dois ramos antes do push; sem achado de varredura (próximo livre: **L-110**). Os dois mexem em `cobertura.json`: o segundo a mesclar precisa de merge da main no ramo (eu resolvo). O 601 segue sem PR (pausa do Muse).
- **Main** ainda em `b2934fb2a`: nenhum merge novo desde a última foto; drafts #3533, #3530, #3531, #3532 e #3498 abertos. Drafts novos de A/B em lab verde, sem merge (specs saem quando entrarem): #3543 (O4), #3547 (E748), #3549 (E746), #3550 (E747), #3551 (E749), #3552 (E750), #3479 (E722/0334).

## Vigia das 22h — merge novo

- **#3402 (E687, migração 0329, `a5d6970f8`)** entrou na main: massa do parceiro de Mudança aprovado, **só em conta de teste da produção** (sem massa no lab). Guarda: o teste de unidade `massa-parceiro-mudanca-e687.test.ts` (já no PR) + a t1567 (#3548, verde), que cobre `parceiros.dados_categoria` no banco do lab. Não cabe spec de UI nova. Lab crítico da main em `a5d6970f8`: run 42527730368, em andamento no momento do registro.
- Demais: sem merge novo; drafts #3533, #3530, #3531, #3532, #3498 abertos (limpeza pós-merge segue pendente).

## Cadeia das 22h10

- **Main em `a5d6970f8` (#3402, E687/0329): lab crítico verde** (run 42527730368). Entrou depois o **#3406 (E699, migração 0330, `911a6ebba`)**: massa de identidade pendente (CPF de teste na dona `proprietario-qa`), dados só de conta de teste da produção, sem massa no lab → guarda pelo teste de unidade do próprio PR; sem spec de UI possível. Lab da main em `911a6ebba`: a conferir.
- **t1568 (#3558, draft sobre #3555)**: E753, "Wi-Fi" fora de "Não tem" em `/imoveis/ube-003`, 390 e 1280. Lab: a conferir (na main de hoje a spec falha, como esperado; passa com o #3555).
- **Bloco 601 (#3559, t1549)**: aberto como draft por pedido expresso (main mesclada no ramo; numeração e cobertura 13/13). Lab: a conferir. Sem achado até aqui (próximo livre: L-110).

## Vigia das 22h25 — vereditos e merges novos

- **t1568 (#3558, E753) verde** sobre o ramo do #3555 (run 42528863983). **Bloco 601 (#3559, t1549) verde** (run 42528869633); sem achado (próximo livre: **L-110**).
- **Merges novos na main** (até `052e10e24`): **#3459 (E690, 0331)** — ativa o avaliador de teste UDI-002 na produção (conta `is_teste`), sem massa no lab → guarda no teste de unidade do PR; **#3466 (E721, 0332)** — índice único completo em `push_adiados (user_id, grupo)` → **t1569 (#3562)**, guarda de banco do upsert por grupo (lab: a conferir). Já antes: #3406 (E699/0330, mesma situação do E690).
- Drafts #3533, #3530, #3531, #3532, #3498 ainda abertos; limpeza pós-merge pendente.

## Cadeia das 22h35 — main em `b18c39ec3`

- **t1569 (#3562, E721/0332): verde** (run 42529968365). Lab da main: `052e10e24` verde (42529615185); `e7ca59039` (E690), `911a6ebba` (E699) e `a5d6970f8` (E687/0329) verdes. `b069fdc02` (E688) em andamento; `da35ad3be` (E759) cancelado por run mais novo; `b18c39ec3` (E745) pendente.
- **Merges novos desde `052e10e24`:** #3478 (E688, 0333), #3563 (E759, jornada da estadia) e #3560 (E745, drill de backup). **t1570 (#3564)**: E688, `plano_manutencao` e `assistencia_24h` em `em_breve` no banco do lab. E759 e E745 entraram com testes de unidade próprios (E745 é rotina de operação, sem tela; E759 pede massa de estadia que o lab não tem). Lab da t1570: a conferir.
- **Varredura por blocos:** não há bloco pendente (601, 602 e 603 verdes em draft); novo bloco segue pausado pelo Muse. Sem achado novo (próximo livre: **L-110**).

## Vigia das 22h40

- **Merge novo #3471 (E688, Pista A, `298197783`)**: retira o cartão "parceiro geral" (AquiResolve) das superfícies públicas. O próprio PR já atualizou a **t236** (`parceiro-geral` e o texto "AquiResolve" ausentes em `/parceiros/fotografos` com busca vazia, 390 e 1280, mesmo ligado pelo admin) → guarda existente; sem spec nova.
- **t1570 (#3564, E688/0333)**: lab em andamento (run 42530919517). Drafts #3533, #3530, #3531, #3532, #3498 ainda abertos. Sem achado novo (próximo livre: **L-110**).

## Vigia das 22h47

- **t1570 (#3564, E688/0333): verde** (run 42530919517). Nenhum merge novo desde `298197783`; drafts #3533, #3530, #3531, #3532, #3498 abertos. Sem achado novo (próximo livre: **L-110**).

## Continuação do Muse (22h55) — main em `10f292a83`

- **Lab da main:** `298197783` (#3471, E688/AquiResolve) **verde** (42530992233), `b18c39ec3` (E745) verde (42530715501), `b069fdc02` (E688/0333) verde. `10f292a83` (E722/0334): run 42532121103 em andamento.
- **Merge novo #3479 (E722, 0334)**, pré-aceitação de 72 h atrás da chave `PRE_ACEITACAO_72H_ATIVA` (desligada): **t1571 (#3567)** — 8 colunas `pre_aceitacao_*` em `propostas` + cron `/api/cron/pre-aceitacao` sem segredo/segredo errado (401/503). Fluxo completo fica nos testes de unidade do PR; spec de fluxo só com a chave ligada no lab (pendente de decisão). Lab da t1571: a conferir.
- **Varredura por blocos:** sem bloco pendente (601–603 verdes em draft); bloco novo segue pausado pelo Muse. Sem achado novo (próximo livre: **L-110**). Drafts #3533, #3530, #3531, #3532, #3498 ainda abertos.

## Cadeia das 23h

- **Main `10f292a83` (#3479, E722/0334): lab verde** (run 42532121103). Nenhum merge novo depois dele (E682, E707, E725, E727, E728, E719, E713, E729 e 0335 ainda não mergeados).
- **t1571 (#3567, E722):** run 42532397238 em andamento no momento do registro; veredito na próxima conferência.
- **Bloco 604 (#3570, t1552)**, 17ª volta do grupo do bloco 587 (painel com id, sócios, autenticação), a 390 e 1280 px; `cobertura.json` regenerado; numeração e cobertura 13/13, `tsc` limpo. Lab: a conferir. Sem achado até aqui (próximo livre: **L-110**). Mexe em `cobertura.json` como #3553, #3554 e #3559: ao mesclar, o seguinte precisa de merge da main no ramo.
- Drafts #3533, #3530, #3531, #3532, #3498 ainda abertos; limpeza pós-merge pendente.

## Vigia das 23h10

- **t1571 (#3567, E722/0334): verde** (run 42532397238).
- **Merge novo #3437 (E682, `137cb58fb`)**: a lista "Escolha o avaliador" mostra só a conduta publicada (sem preço nem prazo). **t1572 (#3571)**: massa própria (credenciamento ativo + pedido em `pedido`), 390 e 1280 px; lab a conferir. Risco: se a massa não fizer o avaliador aparecer em `sugeridos`, a falha é de massa, não do produto.
- **Bloco 604 (#3570, t1552):** run 42532676112 em andamento. Drafts #3533, #3530, #3531, #3532, #3498 abertos. Sem achado novo (próximo livre: **L-110**).

## Vigia das 23h15

- **Merge novo #3297 (E707, `a2d21c25e`)**, composição dos prazos da caução atrás da chave `CAUCAO_PRAZOS_ATIVA` (desligada): **t1573 (#3572)** guarda o estado desligado do simulador de reembolso (`/dashboard/reembolsos`: prazo legal de 30 dias no texto, sem o campo "Data do check-out"). O cálculo fica nos testes de unidade do PR; o ramo ligado pede decisão de ligar a chave no lab. Lab: a conferir.
- **Em andamento:** t1572 (#3571, E682, run 42533397415) e bloco 604 (#3570, run 42532676112). Nenhum achado novo (próximo livre: **L-110**). Drafts #3533, #3530, #3531, #3532, #3498 ainda abertos.
