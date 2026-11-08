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
