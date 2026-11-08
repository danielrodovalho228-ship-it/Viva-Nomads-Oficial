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
