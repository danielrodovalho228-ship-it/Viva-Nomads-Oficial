# Matriz de conformidade — mockups aprovados × telas reais

Fonte dos mockups: branch `mockups` (`docs/mockups/<tela>-desktop.webp` e `-mobile.webp`). Padrão codificado que vale por cima do mockup: fundo clean (E166, sem bege), cartões uniformes, grade par, ícone por comodidade, um botão cheio por tela, vocabulário da casa. Decisões posteriores ao mockup (E-números) prevalecem.

Estados: **Conforme** · **Corrigido** (PR mesclado) · **Corrigido — PR aberto** · **Parcial** · **Decisão pendente** · **Congelado** · **A conferir**.

Criada pela Pista A em 31/10 (não havia matriz no repositório); atualizar linha a linha a cada passada. Passada 2 (31/10, noite): cabeçalhos do painel, morador, perfil, conta, toggles e qualificação. Passada 3 (01/11–02/11, 390 e 1280): as 10 telas do cadastro elemento por elemento, as telas recentes (Meus anúncios, rascunho reaberto, página do proprietário, Agenda, Meus imóveis — #2146) e varredura de fundo bege, grade ímpar e cartões desiguais em 45 rotas públicas e do painel (sem achado novo; /buscar com 3 colunas ao lado do mapa fica para decisão de desenho). Onda 5 (02/11): E458 — menu público e /parceiros confrontados com `menu-publico` e `publico-parceiros` (sem desvio no escopo do E458; o que fica está anotado nas linhas). Passada 6 (04/11): os dois conceitos gerados que faltavam na matriz (`pouso-morador`, `setup-imovel`) confrontados com o real; o terceiro (`espelho-perfil`) é a linha `perfil-01-topo-espelho`. Passada 7 (04/11): as 13 linhas do admin conferidas em conteúdo (mockup × código, com o estilo do admin aprovado) — correções em #2501 (abas) e #2504 (capa nos anúncios); Serviços do morador fica para decisão (a tela lê uma tabela obsoleta desde a 0197). Passada 4 (02/11): área de toque de 44 px e largura de tablet (768) — home e /como-funciona (#2189), fim dos guias (#2191), lista de Visitas em grade par (#2193), 404 e perfil do proprietário (#2204), bairros da cidade no tablet (#2207) e cinco controles do cadastro (#2218); menus do painel (dono e morador, 390 e 1280) e as 26 rotas do painel a 768 sem achado.

| Tela (mockup) | Rota real | Estado | Prova / observação |
|---|---|---|---|
| `admin-agentes` | /admin/agentes | Conforme | Pista A (definido pela vigia em 01/11). Bloqueio (02/11): a tela real só abre com sessão de admin — o modo demonstração não tem admin e os prints do CI não são lidos pela Pista A (o link do artefato carrega credencial). O mockup é anterior ao estilo do admin aprovado depois (barra lateral verde; vocabulário fora da casa: "Reservas", "Hóspedes", "Check-in") — conferir por ele só o conteúdo, com o estilo do admin aprovado (pílula branca com texto colorido, sem fundos coloridos). Precisa de uma sessão de admin de teste ou de prints do laboratório entregues à Pista A. Passada 5 (04/11): a tela entra na varredura com sessão do laboratório — T838 (`t838-varredura-matriz-bloqueadas.spec.ts`: as seis classes da varredura, vocabulário da casa e um botão cheio por tela, 390 e 1280; relatório e prints em `tests/laboratorio/saida/varredura-matriz/`). O estado muda conforme o resultado do lab-critico deste PR. Resultado do lab-critico do #2435: passou (sem achado nas seis classes, no vocabulário nem no botão cheio). Passada 7 (04/11, conteúdo × mockup pelo código, estilo do admin aprovado): Rede ao vivo, Aprovações (a fila de tarefas) e Diário de bordo (as entregas) como abas, com os três contadores do Prompt 29 — cobre e amplia o mockup; aba ativa já sem fundo colorido. |
| `admin-anuncios` | /admin/anuncios | Corrigido | Pista A (definido pela vigia em 01/11). Bloqueio (02/11): a tela real só abre com sessão de admin — o modo demonstração não tem admin e os prints do CI não são lidos pela Pista A (o link do artefato carrega credencial). O mockup é anterior ao estilo do admin aprovado depois (barra lateral verde; vocabulário fora da casa: "Reservas", "Hóspedes", "Check-in") — conferir por ele só o conteúdo, com o estilo do admin aprovado (pílula branca com texto colorido, sem fundos coloridos). Precisa de uma sessão de admin de teste ou de prints do laboratório entregues à Pista A. Passada 5 (04/11): a tela entra na varredura com sessão do laboratório — T838 (`t838-varredura-matriz-bloqueadas.spec.ts`: as seis classes da varredura, vocabulário da casa e um botão cheio por tela, 390 e 1280; relatório e prints em `tests/laboratorio/saida/varredura-matriz/`). O estado muda conforme o resultado do lab-critico deste PR. Resultado do lab-critico do #2435: passou (sem achado nas seis classes, no vocabulário nem no botão cheio). Passada 7 (04/11, conteúdo × mockup pelo código, estilo do admin aprovado): a lista não tinha a foto de capa do mockup → #2504 mesclado, com o complemento #2515 (capa real em cada linha, ou o espaço sem foto; só a ordem 0, em lotes). "Novo anúncio", busca livre e paginação não entram: o admin não cria anúncio e os filtros reais cobrem a busca. |
| `admin-atendimento` | /admin/atendimento | Corrigido | Pista A (definido pela vigia em 01/11). Bloqueio (02/11): a tela real só abre com sessão de admin — o modo demonstração não tem admin e os prints do CI não são lidos pela Pista A (o link do artefato carrega credencial). O mockup é anterior ao estilo do admin aprovado depois (barra lateral verde; vocabulário fora da casa: "Reservas", "Hóspedes", "Check-in") — conferir por ele só o conteúdo, com o estilo do admin aprovado (pílula branca com texto colorido, sem fundos coloridos). Precisa de uma sessão de admin de teste ou de prints do laboratório entregues à Pista A. Passada 5 (04/11): a tela entra na varredura com sessão do laboratório — T838 (`t838-varredura-matriz-bloqueadas.spec.ts`: as seis classes da varredura, vocabulário da casa e um botão cheio por tela, 390 e 1280; relatório e prints em `tests/laboratorio/saida/varredura-matriz/`). O estado muda conforme o resultado do lab-critico deste PR. Resultado do lab-critico do #2435: passou (sem achado nas seis classes, no vocabulário nem no botão cheio). Passada 7 (04/11, conteúdo × mockup pelo código, estilo do admin aprovado): chamados por prioridade e prazo, com a ação de cada um — conteúdo conforme; a aba ativa pintada de verde cheio → pílula branca (#2501). Foto de capa e "hóspedes" do mockup ficam fora (estilo do admin; vocabulário da casa). |
| `admin-avaliadores` | /admin/avaliadores | Corrigido | Pista A (definido pela vigia em 01/11). Bloqueio (02/11): a tela real só abre com sessão de admin — o modo demonstração não tem admin e os prints do CI não são lidos pela Pista A (o link do artefato carrega credencial). O mockup é anterior ao estilo do admin aprovado depois (barra lateral verde; vocabulário fora da casa: "Reservas", "Hóspedes", "Check-in") — conferir por ele só o conteúdo, com o estilo do admin aprovado (pílula branca com texto colorido, sem fundos coloridos). Precisa de uma sessão de admin de teste ou de prints do laboratório entregues à Pista A. Passada 5 (04/11): a tela entra na varredura com sessão do laboratório — T838 (`t838-varredura-matriz-bloqueadas.spec.ts`: as seis classes da varredura, vocabulário da casa e um botão cheio por tela, 390 e 1280; relatório e prints em `tests/laboratorio/saida/varredura-matriz/`). O estado muda conforme o resultado do lab-critico deste PR. Resultado do T838 no lab-critico do #2435: dois botões cheios ("Abrir verificação" e "Salvar valor") a 390 e 1280; "Salvar valor" passa ao contorno (guarda admin-avaliadores-um-primario.test.ts). Sem outro achado nas seis classes nem no vocabulário. Passada 7 (04/11, conteúdo × mockup pelo código, estilo do admin aprovado): #2439 mesclado (um botão cheio por tela). |
| `admin-destinos` | /admin/destinos | Conforme | Pista A (definido pela vigia em 01/11). Bloqueio (02/11): a tela real só abre com sessão de admin — o modo demonstração não tem admin e os prints do CI não são lidos pela Pista A (o link do artefato carrega credencial). O mockup é anterior ao estilo do admin aprovado depois (barra lateral verde; vocabulário fora da casa: "Reservas", "Hóspedes", "Check-in") — conferir por ele só o conteúdo, com o estilo do admin aprovado (pílula branca com texto colorido, sem fundos coloridos). Precisa de uma sessão de admin de teste ou de prints do laboratório entregues à Pista A. Passada 5 (04/11): a tela entra na varredura com sessão do laboratório — T838 (`t838-varredura-matriz-bloqueadas.spec.ts`: as seis classes da varredura, vocabulário da casa e um botão cheio por tela, 390 e 1280; relatório e prints em `tests/laboratorio/saida/varredura-matriz/`). O estado muda conforme o resultado do lab-critico deste PR. Resultado do lab-critico do #2435: passou (sem achado nas seis classes, no vocabulário nem no botão cheio). Passada 7 (04/11, conteúdo × mockup pelo código, estilo do admin aprovado): lista com nome, local e estado, cadastro e a fila de locais pedidos (cobre a nota do mockup sobre endereços pessoais). |
| `admin-documentos` | /admin/documentos | Corrigido | Pista A (definido pela vigia em 01/11). Bloqueio (02/11): a tela real só abre com sessão de admin — o modo demonstração não tem admin e os prints do CI não são lidos pela Pista A (o link do artefato carrega credencial). O mockup é anterior ao estilo do admin aprovado depois (barra lateral verde; vocabulário fora da casa: "Reservas", "Hóspedes", "Check-in") — conferir por ele só o conteúdo, com o estilo do admin aprovado (pílula branca com texto colorido, sem fundos coloridos). Precisa de uma sessão de admin de teste ou de prints do laboratório entregues à Pista A. Passada 5 (04/11): a tela entra na varredura com sessão do laboratório — T838 (`t838-varredura-matriz-bloqueadas.spec.ts`: as seis classes da varredura, vocabulário da casa e um botão cheio por tela, 390 e 1280; relatório e prints em `tests/laboratorio/saida/varredura-matriz/`). O estado muda conforme o resultado do lab-critico deste PR. Resultado do lab-critico do #2435: passou (sem achado nas seis classes, no vocabulário nem no botão cheio). Passada 7 (04/11, conteúdo × mockup pelo código, estilo do admin aprovado): fila de conferência com tipo, imóvel, estado e a ação de revisar — conforme; as abas (Fila · Emitidos e as da fila) tinham ativo verde e inativo sage → pílula branca (#2501). "Exportar" não entra (dado sensível: decisão). |
| `admin-manutencao` | /admin/manutencao | Conforme | Pista A (definido pela vigia em 01/11). Bloqueio (02/11): a tela real só abre com sessão de admin — o modo demonstração não tem admin e os prints do CI não são lidos pela Pista A (o link do artefato carrega credencial). O mockup é anterior ao estilo do admin aprovado depois (barra lateral verde; vocabulário fora da casa: "Reservas", "Hóspedes", "Check-in") — conferir por ele só o conteúdo, com o estilo do admin aprovado (pílula branca com texto colorido, sem fundos coloridos). Precisa de uma sessão de admin de teste ou de prints do laboratório entregues à Pista A. Passada 5 (04/11): a tela entra na varredura com sessão do laboratório — T838 (`t838-varredura-matriz-bloqueadas.spec.ts`: as seis classes da varredura, vocabulário da casa e um botão cheio por tela, 390 e 1280; relatório e prints em `tests/laboratorio/saida/varredura-matriz/`). O estado muda conforme o resultado do lab-critico deste PR. Resultado do lab-critico do #2435: passou (sem achado nas seis classes, no vocabulário nem no botão cheio). Passada 7 (04/11, conteúdo × mockup pelo código, estilo do admin aprovado): imóvel, categoria, prioridade, estado e prazo de solução por solicitação. O "Ver detalhes" do mockup pediria uma página de detalhe do chamado no admin, que não existe (funcionalidade, não ajuste visual). |
| `admin-moderar` | /admin/pedidos (e /admin/moderacao/ofensas) | Conforme | Pista A (definido pela vigia em 01/11). Bloqueio (02/11): a tela real só abre com sessão de admin — o modo demonstração não tem admin e os prints do CI não são lidos pela Pista A (o link do artefato carrega credencial). O mockup é anterior ao estilo do admin aprovado depois (barra lateral verde; vocabulário fora da casa: "Reservas", "Hóspedes", "Check-in") — conferir por ele só o conteúdo, com o estilo do admin aprovado (pílula branca com texto colorido, sem fundos coloridos). Precisa de uma sessão de admin de teste ou de prints do laboratório entregues à Pista A. Passada 5 (04/11): a tela entra na varredura com sessão do laboratório — T838 (`t838-varredura-matriz-bloqueadas.spec.ts`: as seis classes da varredura, vocabulário da casa e um botão cheio por tela, 390 e 1280; relatório e prints em `tests/laboratorio/saida/varredura-matriz/`). O estado muda conforme o resultado do lab-critico deste PR. Resultado do lab-critico do #2435: passou (sem achado nas seis classes, no vocabulário nem no botão cheio). Passada 7 (04/11, conteúdo × mockup pelo código, estilo do admin aprovado): a rota real é /admin/pedidos (moderação dos pedidos de moradia; /admin/moderacao/ofensas é a fila de mensagens ofensivas). Morador, entrada, faixa e selos presentes; o modelo é moderação depois (ocultar com motivo), não o "Aprovar antes" do mockup — decisão de produto. Abas e selo "ok" com fundo sage → pílula branca (#2501). |
| `admin-pendencias` | /admin/pendencias | Conforme | Pista A (definido pela vigia em 01/11). Bloqueio (02/11): a tela real só abre com sessão de admin — o modo demonstração não tem admin e os prints do CI não são lidos pela Pista A (o link do artefato carrega credencial). O mockup é anterior ao estilo do admin aprovado depois (barra lateral verde; vocabulário fora da casa: "Reservas", "Hóspedes", "Check-in") — conferir por ele só o conteúdo, com o estilo do admin aprovado (pílula branca com texto colorido, sem fundos coloridos). Precisa de uma sessão de admin de teste ou de prints do laboratório entregues à Pista A. Passada 5 (04/11): a tela entra na varredura com sessão do laboratório — T838 (`t838-varredura-matriz-bloqueadas.spec.ts`: as seis classes da varredura, vocabulário da casa e um botão cheio por tela, 390 e 1280; relatório e prints em `tests/laboratorio/saida/varredura-matriz/`). O estado muda conforme o resultado do lab-critico deste PR. Resultado do lab-critico do #2435: passou (sem achado nas seis classes, no vocabulário nem no botão cheio). Passada 7 (04/11, conteúdo × mockup pelo código, estilo do admin aprovado): a fila única do Adendo 59.1 / E330 (gravidade, prazo, idade e a ação em um toque) substitui os quatro cartões e a foto do mockup — decisão posterior. |
| `admin-publicamos` | /admin/publicamos | Conforme | Pista A (definido pela vigia em 01/11). Bloqueio (02/11): a tela real só abre com sessão de admin — o modo demonstração não tem admin e os prints do CI não são lidos pela Pista A (o link do artefato carrega credencial). O mockup é anterior ao estilo do admin aprovado depois (barra lateral verde; vocabulário fora da casa: "Reservas", "Hóspedes", "Check-in") — conferir por ele só o conteúdo, com o estilo do admin aprovado (pílula branca com texto colorido, sem fundos coloridos). Precisa de uma sessão de admin de teste ou de prints do laboratório entregues à Pista A. Passada 5 (04/11): a tela entra na varredura com sessão do laboratório — T838 (`t838-varredura-matriz-bloqueadas.spec.ts`: as seis classes da varredura, vocabulário da casa e um botão cheio por tela, 390 e 1280; relatório e prints em `tests/laboratorio/saida/varredura-matriz/`). O estado muda conforme o resultado do lab-critico deste PR. Resultado do lab-critico do #2435: passou (sem achado nas seis classes, no vocabulário nem no botão cheio). Passada 7 (04/11, conteúdo × mockup pelo código, estilo do admin aprovado): fila com dono, fotos enviadas, estado (selo branco) e a próxima etapa. |
| `admin-servicos` | /admin/servicos | Decisão pendente | Pista A (definido pela vigia em 01/11). Bloqueio (02/11): a tela real só abre com sessão de admin — o modo demonstração não tem admin e os prints do CI não são lidos pela Pista A (o link do artefato carrega credencial). O mockup é anterior ao estilo do admin aprovado depois (barra lateral verde; vocabulário fora da casa: "Reservas", "Hóspedes", "Check-in") — conferir por ele só o conteúdo, com o estilo do admin aprovado (pílula branca com texto colorido, sem fundos coloridos). Precisa de uma sessão de admin de teste ou de prints do laboratório entregues à Pista A. Passada 5 (04/11): a tela entra na varredura com sessão do laboratório — T838 (`t838-varredura-matriz-bloqueadas.spec.ts`: as seis classes da varredura, vocabulário da casa e um botão cheio por tela, 390 e 1280; relatório e prints em `tests/laboratorio/saida/varredura-matriz/`). O estado muda conforme o resultado do lab-critico deste PR. Resultado do lab-critico do #2435: passou (sem achado nas seis classes, no vocabulário nem no botão cheio). Passada 7 (04/11, conteúdo × mockup pelo código, estilo do admin aprovado): faltava o imóvel de cada pedido, mas a tela lê `servicos_pedidos`, OBSOLETA desde a 0197 (substituída por `parceiro_pedidos`; "nada novo lê ou grava") — o lab-critico do #2507 mostrou que o pedido nem aparece. O #2507 entrou na main antes de ser fechado e foi revertido pelo PR de reversão de 05/11 (a leitura do imóvel em `servicos_pedidos` e o t852 saem): o ajuste certo é apontar Serviços do morador para `parceiro_pedidos` (fonte de dados, não conformidade visual). |
| `admin-usuarios` | /admin/usuarios | Conforme | Pista A (definido pela vigia em 01/11). Bloqueio (02/11): a tela real só abre com sessão de admin — o modo demonstração não tem admin e os prints do CI não são lidos pela Pista A (o link do artefato carrega credencial). O mockup é anterior ao estilo do admin aprovado depois (barra lateral verde; vocabulário fora da casa: "Reservas", "Hóspedes", "Check-in") — conferir por ele só o conteúdo, com o estilo do admin aprovado (pílula branca com texto colorido, sem fundos coloridos). Precisa de uma sessão de admin de teste ou de prints do laboratório entregues à Pista A. Passada 5 (04/11): a tela entra na varredura com sessão do laboratório — T838 (`t838-varredura-matriz-bloqueadas.spec.ts`: as seis classes da varredura, vocabulário da casa e um botão cheio por tela, 390 e 1280; relatório e prints em `tests/laboratorio/saida/varredura-matriz/`). O estado muda conforme o resultado do lab-critico deste PR. Resultado do lab-critico do #2435: passou (sem achado nas seis classes, no vocabulário nem no botão cheio). Passada 7 (04/11, conteúdo × mockup pelo código, estilo do admin aprovado): busca por nome, papel, identidade e contas de teste à parte. "Exportar" e "Novo usuário" não entram (dado pessoal e criação de conta pelo admin: decisão). |
| `admin-visao-geral` | /admin/visao-geral | Conforme | Pista A (definido pela vigia em 01/11). Bloqueio (02/11): a tela real só abre com sessão de admin — o modo demonstração não tem admin e os prints do CI não são lidos pela Pista A (o link do artefato carrega credencial). O mockup é anterior ao estilo do admin aprovado depois (barra lateral verde; vocabulário fora da casa: "Reservas", "Hóspedes", "Check-in") — conferir por ele só o conteúdo, com o estilo do admin aprovado (pílula branca com texto colorido, sem fundos coloridos). Precisa de uma sessão de admin de teste ou de prints do laboratório entregues à Pista A. Passada 5 (04/11): a tela entra na varredura com sessão do laboratório — T838 (`t838-varredura-matriz-bloqueadas.spec.ts`: as seis classes da varredura, vocabulário da casa e um botão cheio por tela, 390 e 1280; relatório e prints em `tests/laboratorio/saida/varredura-matriz/`). O estado muda conforme o resultado do lab-critico deste PR. Resultado do lab-critico do #2435: passou (sem achado nas seis classes, no vocabulário nem no botão cheio). Passada 7 (04/11, conteúdo × mockup pelo código, estilo do admin aprovado): os quatro números (rótulos mais precisos de decisões posteriores), Precisa da sua atenção, Atividade recente e a nota das contas de teste. |
| `ajuda-central` | /ajuda | Conforme | #1699 (vocabulário), E84; #1711 (FAQPage em português). Passada fina 01/11: títulos dos temas e das seções em verde (mockup). Passada 9 (05/11, modo demonstração, 390 e 1280): sem rolagem lateral, um botão cheio ("Falar com a Viva"), um h1, sem fundo bege. |
| `ajuda-privacidade` | /privacidade | Congelado | Texto aprovado — não mexer até o parecer jurídico. Passada 9 (05/11, modo demonstração, 390 e 1280): "inquilino(s)" aparece no texto jurídico; fica como está: tela congelada, texto jurídico. |
| `ajuda-termos` | /termos | Congelado | Texto aprovado — não mexer até o parecer jurídico. Passada 9 (05/11, modo demonstração, 390 e 1280): "inquilinos" aparece no texto jurídico ("Verificação de inquilinos (em breve)"); fica como está: tela congelada, texto jurídico. |
| `busca-card` | /buscar | Conforme | #1698 (bairro não espremido pelo selo). Passada fina 01/11: o lugar da contagem em verde. Fica: chip selecionado em tinta (regra do Prompt 40, com teste) e o cartão sem caixa (PropertyCard único). Passada 9 (05/11, modo demonstração, 390 e 1280): sem rolagem lateral, nenhum botão cheio na página; a 1280 a lista ao lado do mapa tem 3 colunas e a última linha pode ficar incompleta (16 resultados no demo) — a mesma decisão de desenho já anotada na passada 3. Passada 21 (06/11): selos do cartão pelo E626 (#2829) — nível em palavra e cor, pílula de símbolos; conferido nos 10 cartões da busca e da cidade, 390 e 1280. |
| `cabecalho-agenda` | cabeçalho de /dashboard/agenda | Decisão pendente | Passada 2 (31/10, 1280): o mockup tem barra lateral verde, fundo bege e foto grande no topo de cada tela do painel; o real segue o painel aprovado depois (topo com abas, fundo clean, sem foto). Pôr foto no topo de todas as telas do painel é decisão de desenho — com o Muse. Conteúdo de cada tela conferido sem defeito visual. |
| `cabecalho-ajuda` | cabeçalho de /dashboard/conta/ajuda | Decisão pendente | Passada 2 (31/10, 1280): o mockup tem barra lateral verde, fundo bege e foto grande no topo de cada tela do painel; o real segue o painel aprovado depois (topo com abas, fundo clean, sem foto). Pôr foto no topo de todas as telas do painel é decisão de desenho — com o Muse. Conteúdo de cada tela conferido sem defeito visual. |
| `cabecalho-anuncios` | cabeçalho de /dashboard/imoveis | Decisão pendente | Mockup antigo (barra lateral, foto no topo, grade de 3); real é a lista aprovada depois, cartões uniformes em #1724. Mesma decisão dos demais cabeçalhos. |
| `cabecalho-caucao` | cabeçalho de /dashboard/caucao | Decisão pendente | Passada 2 (31/10, 1280): o mockup tem barra lateral verde, fundo bege e foto grande no topo de cada tela do painel; o real segue o painel aprovado depois (topo com abas, fundo clean, sem foto). Pôr foto no topo de todas as telas do painel é decisão de desenho — com o Muse. Conteúdo de cada tela conferido sem defeito visual. |
| `cabecalho-conferencia` | cabeçalho de /dashboard/conferencia | Decisão pendente | Passada 2 (31/10, 1280): o mockup tem barra lateral verde, fundo bege e foto grande no topo de cada tela do painel; o real segue o painel aprovado depois (topo com abas, fundo clean, sem foto). Pôr foto no topo de todas as telas do painel é decisão de desenho — com o Muse. Conteúdo de cada tela conferido sem defeito visual. |
| `cabecalho-contratos` | cabeçalho de /dashboard/contratos | Decisão pendente | Passada 2 (31/10, 1280): o mockup tem barra lateral verde, fundo bege e foto grande no topo de cada tela do painel; o real segue o painel aprovado depois (topo com abas, fundo clean, sem foto). Pôr foto no topo de todas as telas do painel é decisão de desenho — com o Muse. Conteúdo de cada tela conferido sem defeito visual. |
| `cabecalho-fechamento` | cabeçalho de /dashboard/fechamento | Decisão pendente | Passada 2 (31/10, 1280): o mockup tem barra lateral verde, fundo bege e foto grande no topo de cada tela do painel; o real segue o painel aprovado depois (topo com abas, fundo clean, sem foto). Pôr foto no topo de todas as telas do painel é decisão de desenho — com o Muse. Conteúdo de cada tela conferido sem defeito visual. |
| `cabecalho-ferramentas` | cabeçalho de /dashboard/ferramentas | Decisão pendente | Passada 2 (31/10, 1280): o mockup tem barra lateral verde, fundo bege e foto grande no topo de cada tela do painel; o real segue o painel aprovado depois (topo com abas, fundo clean, sem foto). Pôr foto no topo de todas as telas do painel é decisão de desenho — com o Muse. Conteúdo de cada tela conferido sem defeito visual. |
| `cabecalho-interessados` | cabeçalho de /dashboard/leads | Decisão pendente | Passada 2 (31/10, 1280): o mockup tem barra lateral verde, fundo bege e foto grande no topo de cada tela do painel; o real segue o painel aprovado depois (topo com abas, fundo clean, sem foto). Pôr foto no topo de todas as telas do painel é decisão de desenho — com o Muse. Conteúdo de cada tela conferido sem defeito visual. |
| `cabecalho-orcamentos` | cabeçalho de /dashboard/orcamentos | Decisão pendente | Passada 2 (31/10, 1280): o mockup tem barra lateral verde, fundo bege e foto grande no topo de cada tela do painel; o real segue o painel aprovado depois (topo com abas, fundo clean, sem foto). Pôr foto no topo de todas as telas do painel é decisão de desenho — com o Muse. Conteúdo de cada tela conferido sem defeito visual. |
| `cabecalho-pedidos` | cabeçalho de /dashboard/pedidos | Decisão pendente | Passada 2 (31/10, 1280): o mockup tem barra lateral verde, fundo bege e foto grande no topo de cada tela do painel; o real segue o painel aprovado depois (topo com abas, fundo clean, sem foto). Pôr foto no topo de todas as telas do painel é decisão de desenho — com o Muse. Conteúdo de cada tela conferido sem defeito visual. |
| `cabecalho-recibos` | cabeçalho de /dashboard/recibos | Decisão pendente | Passada 2 (31/10, 1280): o mockup tem barra lateral verde, fundo bege e foto grande no topo de cada tela do painel; o real segue o painel aprovado depois (topo com abas, fundo clean, sem foto). Pôr foto no topo de todas as telas do painel é decisão de desenho — com o Muse. Conteúdo de cada tela conferido sem defeito visual. |
| `cabecalho-roi` | cabeçalho de /dashboard/roi-imovel | Decisão pendente | Como os demais cabeçalhos; além disso, /dashboard/roi-imovel leva ao Simulador do imóvel (E294 juntou simulador e ROI num cálculo só, #1715). |
| `cabecalho-simulador` | cabeçalho de /dashboard/simulador | Decisão pendente | Passada 2 (31/10, 1280): o mockup tem barra lateral verde, fundo bege e foto grande no topo de cada tela do painel; o real segue o painel aprovado depois (topo com abas, fundo clean, sem foto). Pôr foto no topo de todas as telas do painel é decisão de desenho — com o Muse. Conteúdo de cada tela conferido sem defeito visual. |
| `cabecalho-tributacao` | cabeçalho de /dashboard/tributacao | Decisão pendente | Passada 2 (31/10, 1280): o mockup tem barra lateral verde, fundo bege e foto grande no topo de cada tela do painel; o real segue o painel aprovado depois (topo com abas, fundo clean, sem foto). Pôr foto no topo de todas as telas do painel é decisão de desenho — com o Muse. Conteúdo de cada tela conferido sem defeito visual. |
| `cadastro-imovel-01-tipo` | /dashboard/imoveis/novo?etapa=tipo | Conforme | Segue E87 (9 tipos em carrossel). Passada 3 (01/11, 390 e 1280): subtítulo nos cartões de tipo (mockup do celular) fica de fora — o mockup traz 2 de 9 e escrever os outros seria texto inventado; decisão de texto com o Muse. |
| `cadastro-imovel-02-fotos` | /dashboard/imoveis/novo?etapa=fotos | Conforme | Exige 8 fotos (MIN_FOTOS); vídeo e IA além do mockup. |
| `cadastro-imovel-03-endereco` | /dashboard/imoveis/novo?etapa=endereco | Corrigido | Mapa do bairro aparece com o endereço preenchido. E429 (#2147, 02/11): bairro com nome de estado ("Minas Gerais", bairro oficial de Uberlândia) não é erro; o bairro do CEP é autoritativo. Fica como está: endereço em campos (CEP, rua, número, bairro) em vez do campo único do mockup — preenchido pelo CEP, decisão anterior. Mesclado no #2147. |
| `cadastro-imovel-04-detalhes` | /dashboard/imoveis/novo?etapa=detalhes | Corrigido; resto em decisão | #2118 (título "Características do imóvel" e o lembrete "Você pode revisar e editar depois"). Segue em decisão: "Comodidades principais" (atalho para o Passo 5) e ícone por contador no celular. |
| `cadastro-imovel-05-comodidades` | /dashboard/imoveis/novo?etapa=comodidades | Corrigido | #1717 (ícone nos cartões do Pronto para trabalhar); #2115 (um ícone por comodidade — 3 pares repetidos). Fica como está: grade par da casa (o ímpar ocupa a linha) e lista de 1 coluna no celular. |
| `cadastro-imovel-06-regras` | /dashboard/imoveis/novo?etapa=regras | Corrigido | #1716 (silêncio, visitas, festas e outras regras no passo); #2116 (ícone em cada regra, como no mockup); #2123/#2126 (contador "N/280" igual aos outros). |
| `cadastro-imovel-07-descricao` | /dashboard/imoveis/novo?etapa=descricao | Decisão pendente | Passada 3 (01/11): o mockup tem a linha de chips "Destaques" abaixo da descrição — funcionalidade nova, decisão com o Muse. Resto conforme. |
| `cadastro-imovel-08-preco` | /dashboard/imoveis/novo?etapa=preco | Conforme | Total do mês aparece com valor (calcularTudoIncluido). Passada 3 (01/11): chips selecionados em verde cheio ficam (padrão E193 do assistente inteiro; não são botão de ação). |
| `cadastro-imovel-09-disponibilidade` | /dashboard/imoveis/novo?etapa=disponibilidade | Corrigido; resto em decisão | Calendário aparece com o rascunho salvo. #2121 ("Resumo: Disponível … · Mínimo N dias" na prévia). Em decisão: estadia mínima em +/− (o real usa chips 30/60/90/180 dias). |
| `cadastro-imovel-10-revisao` | /dashboard/imoveis/novo?etapa=revisao | Corrigido | #1718 (motivo do Publicar inteiro); #2114 ("proprietário", nunca "anfitrião", no convite de foto). Em decisão: no celular, o mockup põe a prévia do anúncio acima do checklist. |
| `conta-seguranca` | /dashboard/conta/seguranca | Conferido sem achado | Varredura 31/10 (1280). |
| `conta-verificacao` | /dashboard/verificacao | Conforme | Passada 2 (390): título, frase e o fluxo de verificação. |
| `imovel-cta` | /imoveis/[id] | Conforme, com observação | #1668/#1688. Observação para decisão: a 1280, logado, o flutuante "Fale com a Viva" fica à esquerda e passa sobre o texto da coluna ao rolar (regra do CSS para não cobrir o cartão de preço). Passada 9 (05/11, modo demonstração, 390 e 1280): um botão cheio ("Pedir para morar"); regras da estadia com 7 cartões em 2 colunas: o último ocupa a linha inteira (sem buraco); comodidades e trabalho são listas com ícone (E313), não cartões. |
| `menu-publico` | topo público (todas) | Conforme | MS-1/PUBLICO-A (#1550, #1637); guarda topo-publico-ms1.test.ts. Onda 5 (02/11, E458 #2377): o mockup é anterior ao E176 e ao E458 ("Para proprietários" no lugar de "Anunciar", sem "Parceiros"); vale a lista aprovada — Imóveis · Anunciar · Empresas · Parceiros · Fale com a Viva. No computador, conforme ao mockup: links à esquerda, "Fale com a Viva" em texto e "Entrar" como único botão cheio à direita, numa linha só em 1024/1280/1536 (logado, deslogado e com o seletor de idioma; folga mínima de 130 px). Guarda: e458-parceiros-menu.test.ts e T831. Fica (fora do E458): no celular o mockup mostra "Entrar" ao lado do ☰; no real ele fica dentro do menu aberto, como fixado pelo E176/MS-1 (T489/T669). E555 (04/11, pacote Planos): "Planos" (→ /planos, que leva a /precos) entra entre Parceiros e Fale com a Viva — 6 destinos, numa linha só em 1024/1280/1536 (T831/T837); guarda e555-planos-portas.test.ts. Passada 8 (05/11, 390 e 1280, chave PRECOS_VISIVEL desligada): topo com os 5 destinos do E458 — Imóveis · Anunciar · Empresas · Parceiros · Fale com a Viva (+ Entrar); "Planos" fora (E563, #2524); rodapé sem "Preços". T669 verde. |
| `morador-estadia` | /dashboard/estadia/[id] | Conforme, com observação | Abas Estadia · Contrato · Solicitações · Serviços como no mockup; foto do imóvel no topo da estadia só com estadia real (demonstração sem estadia). |
| `morador-favoritos` | /dashboard/favoritos | Conforme, com observação | Passada 2 (390): abas Buscar · Favoritos · Buscas salvas no padrão do painel; o mockup tem foto grande no topo (mesma decisão dos cabeçalhos). |
| `morador-home` | /dashboard (morador) | Conforme, com observação | Comparado em 01/11: é a variante com estadia ativa (estadia + checklist de entrada + mensagens). O real cobre com o cartão da estadia (CartaoEstadias) e a tela /dashboard/estadia; fundo bege, barra verde e o vocabulário do mockup ("reserva", "anfitrião") são anteriores ao padrão da casa e não entram. |
| `morador-inicio` | /dashboard (morador) | Corrigido | Comparado em 01/11 (390 e 1280): entra o "Peça na Viva" (Publicar pedido de moradia · Pedir um serviço, textos aprovados do Início do dono); os recomendados viram o cartão com foto da busca em grade par (2/4) com "Ver todos"; "Salve seus favoritos" só sem favoritos. Não entram: "Olá, Lucas" no lugar do título de decisões (decisão do Prompt 43/E167) e "Continue sua busca · últimos bairros vistos" (não há histórico de bairros vistos para mostrar). Lab t761. Mesclado no #1794. |
| `morador-mensagens` | /dashboard/mensagens | Conforme | Passada 2 (390): lista com filtros e aviso de segurança; a conversa aberta segue o mesmo cabeçalho do mockup. |
| `morador-pedidos` | /dashboard/pedidos | Conforme, com observação | Passada 2 (390): "Meus pedidos de moradia" com abas; foto no topo do mockup = mesma decisão dos cabeçalhos. |
| `morador-pedir` | /pedidos/novo | Conforme | /pedidos/novo (formulário em cartões, um botão cheio). Passada 9 (05/11, modo demonstração, 390 e 1280): um botão cheio ("Publicar pedido"); "Precisa de" com 5 opções em 2 colunas: a última ocupa a linha inteira. |
| `morador-servico` | /dashboard/servicos | Conferido sem achado | Serviços com foto por categoria, grade de 6. |
| `pagina-fale-com-a-viva` | /ajuda/fale-com-a-viva | Conforme | Banner com foto e título (padrão das institucionais). Passada 9 (05/11, modo demonstração, 390 e 1280): sem rolagem lateral, um botão cheio ("Abrir chamado"), um h1. |
| `painel-proprietario` | /dashboard (dono) | Corrigido | Comparado em 01/11 (código do Início do dono, PROP-6, e lab t645): faixa de alerta, bloco principal com % e barra, "Continuar de onde parou", Próximos passos com ícone por estado, "Peça na Viva" e os três atalhos (lista no celular, cartões no computador) conferem. Achado: o passo atual dizia "Pendente" — agora "Em andamento" como no mockup. Fica como está: sem foto do anúncio, o bloco principal não mostra foto (regra do PROP-6, nada de foto inventada); os botões do "Peça na Viva" contornados (um botão cheio por tela). Mesclado no #1812. |
| `parceiro-cadastro` | /parceiros ("Quero ser parceiro") e /dashboard/parceiro | Corrigido | Comparado em 01/11 (390 e 1280): as categorias viram cartões com foto e marca no canto, como no mockup (grade par 2/3 com as 6 fotos de categoria; "Outro serviço", sem foto, numa linha inteira); os botões Pessoa física/Empresa e "emite nota" saíram do azul para o verde da marca. Fica como está: o formulário pede mais que o mockup (documento, tipo de pessoa, cidades, termos) por regra já aprovada; "Vistoria" não é categoria do catálogo (credenciamento à parte, Prompt 62). Mesclado no #1813. |
| `parceiro-ordens` | /dashboard/parceiro (ordens) | A conferir com sessão de parceiro | Só aparece com parceiro aprovado (não alcançável no modo demonstração); fica para o laboratório. Passada 5 (04/11): a tela entra na varredura com sessão do laboratório — T838 (`t838-varredura-matriz-bloqueadas.spec.ts`: as seis classes da varredura, vocabulário da casa e um botão cheio por tela, 390 e 1280; relatório e prints em `tests/laboratorio/saida/varredura-matriz/`). O estado muda conforme o resultado do lab-critico deste PR. Resultado do lab-critico do #2435: passou (sem achado nas seis classes, no vocabulário nem no botão cheio). |
| `parceiro-painel` | /dashboard/parceiro (ativo) | Conforme | /dashboard/parceiro: formulário "Quero ser parceiro" sem conta de parceiro ativa; grade par em #1733. |
| `perfil-01-topo-espelho` | /dashboard/conta/perfil | A conferir com sessão real | No modo demonstração o Perfil não carrega dados; a varredura do CI (t757, sessão real) não achou defeito. Passada 5 (04/11): a tela entra na varredura com sessão do laboratório — T838 (`t838-varredura-matriz-bloqueadas.spec.ts`: as seis classes da varredura, vocabulário da casa e um botão cheio por tela, 390 e 1280; relatório e prints em `tests/laboratorio/saida/varredura-matriz/`). O estado muda conforme o resultado do lab-critico deste PR. Resultado do lab-critico do #2435: passou (sem achado nas seis classes, no vocabulário nem no botão cheio). |
| `perfil-02-avaliacoes` | /dashboard/conta/avaliacoes | A conferir com sessão real | Sem sessão real a tela redireciona ao login (avaliacoesRecebidas() exige usuário); fica para o laboratório. Passada 5 (04/11): a tela entra na varredura com sessão do laboratório — T838 (`t838-varredura-matriz-bloqueadas.spec.ts`: as seis classes da varredura, vocabulário da casa e um botão cheio por tela, 390 e 1280; relatório e prints em `tests/laboratorio/saida/varredura-matriz/`). O estado muda conforme o resultado do lab-critico deste PR. Resultado do lab-critico do #2435: passou (sem achado nas seis classes, no vocabulário nem no botão cheio). |
| `perfil-03-papeis-com-fotos` | /dashboard/conta (papéis) | Conforme | "Como você usa a Viva" no menu da Conta (descrições inteiras em #1732). |
| `perfil-03-papeis-intencao` | /dashboard/conta (papéis) | Conforme | Idem. |
| `perfil-04-dados` | /dashboard/conta/dados | Conforme | Passada 2 (390): "Meus dados" com voltar e campos em cartão. |
| `perfil-05-privacidade` | /dashboard/conta/privacidade | Conforme | Passada 2 (390): toggle no padrão. |
| `perfil-06-notificacoes` | /dashboard/notificacoes | Corrigido | #1734 (rótulo do cartão de número inteiro). |
| `perfil-07-pagamentos` | /dashboard/conta/pagamentos | Conforme | Passada 2 (390): cartões por papel (morador/proprietário) com foto. |
| `perfil-08-ajuda-sair` | /dashboard/conta/ajuda | Conferido sem achado | Ajuda logada (1280); "Sair" uma vez (#1648). |
| `pouso-morador` | /dashboard (morador, Início) | Decisão pendente | Passada 6 (04/11): conceito gerado (`media-generation-mockup-pouso-morador`, desktop e celular), anterior ao Início aprovado do morador — a linha `morador-inicio` (#1794, lab t761) é a referência. Barra lateral verde e fundo bege não entram (topo com abas; E166). Duas peças do conceito não existem no real e são funcionalidade nova, não defeito: (1) a faixa de busca no topo do Início ("Vamos achar sua casa perto da UFU" com destino, bairro e período) e (2) o anel "Seu perfil · 40%" ao lado dos recomendados. A grade de recomendados com foto já segue a grade par do `morador-inicio`. Decisão de desenho com o Muse. |
| `publico-como-funciona` | /como-funciona | Conforme | Varredura 31/10; #1669 (grades). Passada 9 (05/11, modo demonstração, 390 e 1280): um botão cheio ("Buscar imóveis"), sem rolagem lateral. |
| `publico-empresas` | /empresas | Conforme | Varredura 31/10; #1687 (FAQ em blocos). Passada 9 (05/11, modo demonstração, 390 e 1280): um botão cheio ("Fale com a gente"), sem rolagem lateral. |
| `publico-home` | / | Conforme | Varredura 31/10 (390/1280): achados corrigidos em #1698 (bairro do cartão) e #1701 (canto do vídeo); celular #1725/#1731. Passada 8 (05/11): o cartão "Planos e taxas" (E555) sai com a chave desligada (E563); o bloco Para proprietários fica com um só botão cheio ("Quero anunciar meu imóvel"), sem buraco no layout. Sem rolagem lateral a 390. |
| `publico-parceiros` | /parceiros | Conforme | Banner com foto e tipos de parceria (E276/E277). Onda 5 (02/11, E458 #2377): a porta com dois caminhos é posterior ao mockup; "Quero ser parceiro" usa o rótulo do mockup e, no celular, ocupa a largura toda como o botão do mockup; "Encontrar um parceiro" leva a /parceiros/buscar. Diferença registrada: no mockup "Quero ser parceiro" é o botão cheio; no real os dois da porta são de contorno porque a tela já tem o "Seja parceiro" do banner e o envio do formulário (um botão cheio por tela) — decisão de peso fica com o Daniel (Dúvidas do #2377). /parceiros/buscar não tem mockup próprio; a linha "É profissional? Seja parceiro da Viva" segue o estilo de link da casa. Passada 8 (05/11): cartão "Gestores e administradoras" com o texto do E564 (#2536): "Plano Gestor: 4% para carteiras de 20 ou mais imóveis, com cadastro assistido da carteira e contato direto na Viva". Sem rolagem lateral a 390 (visitante); E430 (commit 32b0199) segue na main. |
| `publico-precos` | /precos | Conforme | Banner com foto, regra única; conteúdo maior que o mockup (tabela, simulador, comparativo) por decisões posteriores. Passada 8 (05/11): página SUSPENSA pelo E563 (#2524) — /precos e /planos levam à home com a chave desligada; a seção do Gestor do E564 (#2536) foi conferida só com a chave ligada (T861). |
| `publico-proprietarios` | /para-proprietarios | Conforme | Banner com foto; conteúdo posterior ao mockup. Passada 8 (05/11): sem o botão para a página de preços (E563); texto da taxa "(de 12% a 6%). Plano Gestor: 4% para carteiras de 20 ou mais imóveis…" (E564, #2536); um botão cheio por tela ("Anunciar meu imóvel"); sem rolagem lateral a 390. |
| `publico-seguranca` | /seguranca | Corrigido | #1736: banner das institucionais. Os 3 cartões do mockup não entram (verificação do morador ainda "em breve"). #1736 mesclado. Passada 9 (05/11, modo demonstração, 390 e 1280): sem rolagem lateral, um h1, nenhum botão cheio. |
| `qualificacao-01-perguntas` | /dashboard/imoveis/[id]/qualificar | Conforme | Segue E132/E196 (qualificação única, cartões grandes com ícone, #1683/E196). |
| `qualificacao-02-resultado` | /dashboard/imoveis/[id]/qualificar | Conforme | Idem. |
| `setup-imovel` | /dashboard/imoveis/novo?etapa=detalhes | Conforme | Passada 6 (04/11, 390 e 1280): conceito gerado (`media-generation-mockup-setup-imovel`), uma pergunta por tela ("Quantas pessoas o imóvel recebe?", "Passo 3 de 8"). O real cobre o mesmo: contador − / + de "Pessoas", "Visualização do anúncio" ao vivo à direita, "Continuar" como único botão cheio e o lembrete de editar depois — dentro do passo "Detalhes do imóvel" aprovado depois (linha `cadastro-imovel-04-detalhes`, 10 passos). Fundo bege do conceito não entra (E166). Sem defeito. |
| `toggle-01-estados` | — | Conforme | Padrão BlocoOpcional (E56): fechado, aberto, com dados salvos e confirmação ao desligar com dados. |
| `toggle-02-perfil` | — | Conforme | Mesmo padrão nos blocos do perfil. |
| `toggle-03-imovel` | — | Conforme | Mesmo padrão; o mockup é o Passo 7 antigo (antes da nova ordem dos passos). |
| `toggle-04-pedido` | — | Conforme | Mesmo padrão no pedido de moradia. |

## Telas sem mockup — passada 9 (05/11, modo demonstração, 390 e 1280)

Sem mockup no branch `mockups`: conferidas pelo padrão codificado (fundo clean, grade par, um botão cheio, vocabulário da casa, sem rolagem lateral, um h1). Varredura por script local nas 25 rotas e recortes de tela.

| Tela | Rota real | Estado | Prova / observação |
|---|---|---|---|
| entrada (e-mail) | /auth | Conforme | Foto à esquerda a 1280 (só o cartão a 390); um botão cheio ("Continuar"); "Entrar com senha" em texto; aviso do modo demonstração. `?modo=cadastro` mostra a mesma tela (entrar e criar conta são o mesmo passo). |
| entrada (senha) | /auth?senha=1 | Conforme | Um botão cheio ("Entrar"); "Esqueci minha senha" em texto. |
| nova senha | /auth/reset | Conforme | Um botão cheio ("Salvar nova senha"); "Voltar ao login" em texto. |
| intenção | /auth/intencao | Conforme, com observação | Três cartões de escolha em uma coluna, um botão cheio ("Continuar") e "Agora não" em texto. Observação para decisão: "Continuar" fica desabilitado até marcar uma opção, sem frase que diga o motivo (o texto acima diz "Pode marcar mais de um"). Não mudei: seria texto novo. |
| e-mail confirmado | /auth/pronto | Conforme | Ícone, título e "Continuar no site" (botão secundário; nenhum cheio). |
| duas etapas (equipe) | /auth/verificar-codigo | A conferir com sessão real | No modo demonstração não há Supabase: o formulário fica no esqueleto de carregamento (listFactors não roda). Só a equipe usa; fica para o laboratório. |
| guias | /guias | Conforme | 7 cartões em 2 colunas: o último ocupa a linha inteira (`sm:odd:last:col-span-2`). |
| cidade | /cidades/uberlandia | Conforme, com observação | Sem rolagem lateral. A 1280 a lista tem 4 colunas e a última linha pode ficar incompleta (15 imóveis no demo) — mesma decisão de desenho da lista da /buscar. |
| favoritos (visitante) | /favoritos | Conforme | Vazio com um botão cheio ("Explorar imóveis"). |
| avaliadores | /avaliadores → /parceiros/avaliadores | Conforme | Redireciona; sem rolagem lateral. |
| conferir, guia de fotos, excluir conta, comparar | /conferir, /guia-fotos, /excluir-conta, /comparar | Conforme | Sem rolagem lateral, um h1, nenhum botão cheio a mais, sem vocabulário fora da casa. |

## Painel sem linha na matriz — passada 10 (05/11, modo demonstração, 390 e 1280)

Rotas do painel que ainda não tinham linha, conferidas pelo padrão codificado (fundo clean, grade par, cartões uniformes, um botão cheio, vocabulário da casa, sem rolagem lateral, um h1), com sessão de demonstração. Varredura por script local e recortes de tela.

| Tela | Rota real | Estado | Prova / observação |
|---|---|---|---|
| análise da carteira | /dashboard/carteira | Corrigido — PR aberto | Os 6 indicadores dividiam a linha com alturas diferentes ("Reservados", com dica, 108 px × "Vagos", sem dica, 74 px a 390; 115 × 94 a 1280): o StatCard dentro do invólucro da grade não ocupava a célula. Agora `h-full` no StatCard (vale para todas as telas que o usam). Medido depois: mesma altura em cada linha, nos dois tamanhos. T869 (laboratório). |
| buscas salvas | /dashboard/buscas | Conforme | Sem rolagem lateral, um h1, nenhum botão cheio a mais. |
| candidaturas | /dashboard/candidaturas | Conforme | Vazio com um botão cheio ("Explorar imóveis"). |
| comparar (painel) | /dashboard/comparar | Conforme | Vazio com um botão cheio ("Buscar imóveis"). |
| excluir conta | /dashboard/conta/excluir | Conforme | Sem botão cheio; sem rolagem lateral. |
| ganhos | /dashboard/ganhos | Conforme | Fileira de subabas com a seta do E248 a 390 (desenho aprovado; ver o comentário do t591 na #2548). |
| garantias, indicações, locações, visitas | /dashboard/garantias, /indicacoes, /locacoes, /visitas | Conforme | Sem rolagem lateral; no máximo um botão cheio por tela. |
| novo orçamento | /dashboard/orcamentos/nova | Conforme | Sem botão cheio a mais; sem rolagem lateral. |
| pedidos da cidade | /dashboard/pedidos-cidade | Conforme | Sem rolagem lateral, um h1. |
| propostas | /dashboard/propostas | Conforme | Vazio com link "Ver minhas candidaturas" (texto), nas abas de Pedidos. |
| reembolso da caução | /dashboard/reembolsos | Conforme | Um botão cheio ("Gerar comprovante (exemplo)" no demo); cartões uniformes. |
| respostas rápidas, solicitações | /dashboard/respostas-rapidas, /dashboard/solicitacoes | Conforme | Sem rolagem lateral, um h1. |
| redirecionamentos | /dashboard/assinatura → /dashboard (E563), /dashboard/viabilidade → /dashboard/simulador, /dashboard/parceiro/avaliacao → /dashboard (sem parceiro no demo) | Conforme | Destinos já conferidos nas suas linhas. |
| avaliações (painel) | /dashboard/avaliacoes | A conferir com sessão real | No demo leva ao login (precisa de sessão real), como `perfil-02-avaliacoes`. |

### E550 (parte visual) — sino: lido × não lido

Conferido em 05/11 (modo demonstração, painel do sino com 2 avisos não lidos e 2 lidos simulados, 390 e 1280): a distinção do E502 está de pé e é clara. Não lido: fundo sage-100 (rgb 238, 246, 239), barra verde de 4 px à esquerda (rgb 28, 107, 58), ponto verde, título em negrito (600) e "Não lido" para leitor de tela. Lido: fundo branco, sem barra (transparente), sem ponto, título em peso normal (400). Mesmos valores nos dois tamanhos. Guarda: `src/components/painel/e502-avisos-lidos.test.ts`. Sem mudança de código.


## Assistente de cadastro e telas que mudaram em 05/11 — passada 11 (05/11, modo demonstração, 390 e 1280)

Reconferência das linhas `cadastro-imovel-*` (a última era a passada 3, de 01/11) e das telas mexidas hoje pelos PRs da Pista A
(#2651 E196, #2658 E450, #2667 E584, #2675 E503). Varredura por script local em 15 rotas × 2 larguras, com as verificações da
casa: rolagem lateral, um h1, no máximo um botão cheio (`data-cta="primary"`), vocabulário da casa, imagem quebrada e grade com
buraco (último item que não ocupa a linha numa grade de cartões). Recortes de tela de cada rota.

Achados (numerados):

1. **Assistente, 10 passos** (`/dashboard/imoveis/novo?etapa=tipo` … `revisao`): sem rolagem lateral, um h1, um botão cheio no
   máximo, nenhuma palavra fora do vocabulário, nos dois tamanhos. A 1280 o formulário e a prévia ficam em duas colunas de
   alturas diferentes — é o desenho (`lg:items-start`), não defeito. **Conforme.**
2. **Comodidades e Regras** (passos 5 e 6): as grades `grade-par` fecham sem buraco (a última opção ímpar ocupa a linha). **Conforme.**
3. **Revisão (Passo 10)**: "Antes de publicar" com a lista de conferência e o acordeão (quem opera, identidade, documento,
   declarações); "Publicar anúncio" é o único botão cheio e fica desabilitado com o motivo escrito embaixo. **Conforme.**
4. **`/qualificar`** (sem imóvel): leva ao cadastro novo, sem página própria no caminho. Com imóvel, o #2651 (E196) leva à Revisão
   do rascunho. **Conforme.**
5. **Página do anúncio** (`/imoveis/ube-001`): as listas "Comodidades" (19 itens) e "Trabalho" (3) têm a última linha com um item
   só — são listas com ícone (E313), não cartões, então não é buraco. Galeria em mosaico (1 grande + 4) é o desenho. Os calendários
   de 7 colunas terminam onde o mês termina. **Conforme.**
6. **Início do painel, Meus imóveis e Para proprietários**: sem rolagem lateral, um h1, um botão cheio no máximo. **Conforme.**

Nenhum defeito novo nesta passada. As linhas que seguem pendentes dependem de sessão real (laboratório, T838) ou de decisão de
desenho com o Muse (`cabecalho-*`, `pouso-morador`, `cadastro-imovel-07-descricao`).

## Páginas públicas e painel depois dos PRs de 05/11 — passada 12 (05/11, modo demonstração, 390 e 1280)

Reconferência depois dos merges da tarde (#2697 E496, #2706 E510, #2710 E511, #2713 E597). Varredura por script local em
8 rotas públicas (home, /buscar, página do anúncio, /empresas, /como-funciona, /ajuda, /para-proprietarios, /parceiros) e 8 do
painel (Início, Meus imóveis, Conta, Notificações, Mensagens, Favoritos, edição do anúncio), nos dois tamanhos, com as verificações
da casa: rolagem lateral, um h1, um botão cheio dentro do `main`, imagem quebrada, elemento fora da tela e fundo (todas em branco).
Recortes de tela de cada rota.

Achados (numerados):

1. **Rolagem lateral**: nenhuma página rola de lado, nos dois tamanhos. **Conforme.**
2. **Elementos além da borda**: todos dentro de faixas roláveis de propósito — tabela comparativa da home, filtros da /buscar,
   galeria do anúncio, abas do /como-funciona, carrossel de fotos do Início e abas de Mensagens. O campo "Não preencha" do
   /parceiros fica fora da tela de propósito (armadilha de robô). **Conforme.**
3. **Botão cheio**: o "Entrar" do cabeçalho (1280) é do mockup `PUBLICO-A` e fica fora do `main`; dentro do `main`, no máximo um
   por tela. **Conforme.**
4. **Imagem quebrada**: nenhuma. **Conforme.**
5. **Meus imóveis** (E510/E511): com 3 imóveis no demo a barra (abas, busca, ordem) não aparece — o limite é 4; foto e título
   levam ao destino do cartão. **Conforme.**
6. **Conta › Perfil a 1280**: no demo a coluna fica vazia (o título mora na coluna da direita, `xl`, e o Perfil não tem dados
   sem Supabase) — é a linha `perfil-01-topo-espelho`, já conferida com sessão real (T838, #2435). **Sem mudança.**
7. **Observação para decisão** (texto, não mudei): o rodapé público diz "Anunciar imóvel (com login)"; no resto do site o verbo é
   "Entrar". Uma linha em `src/components/layout/footer.tsx` se o Daniel quiser trocar por "(é preciso entrar)".

Nenhum defeito novo nesta passada. /socios e /decisao (E597) foram conferidas pelo T908 no lab-critico do #2713 (390 e 1280).

## Varredura geral por blocos — passada 13 (05/11, modo demonstração, 390 e 1280)

16 rotas públicas e 19 do painel (incluindo assistente de cadastro no passo 1 e na Revisão, Conta, Agenda, Simulador, Pedidos,
Locações e Visitas), medidas no topo e no fim da rolagem, nas classes pedidas pela vigia: imagem vazia/quebrada, elemento fixo
sobrepondo conteúdo, estouro horizontal e texto cortado. Recortes de tela de cada rota.

Achados (numerados):

1. **Imagem vazia ou quebrada**: nenhuma. **Conforme.**
2. **Estouro horizontal**: nenhum. **Conforme.**
3. **Texto cortado**: os únicos cortes medidos são textos só para leitor de tela (`sr-only`, 1 px de propósito — "Aceita pets",
   "Imóveis encontrados", "— falta"). Nenhum texto visível cortado. **Conforme.**
4. **Elemento fixo sobre o conteúdo**: a 390, a barra de navegação de baixo e o rodapé do assistente cobrem controles enquanto a
   página rola (é o normal de uma barra fixa); no fim da rolagem, nenhum controle, título ou parágrafo fica por baixo deles nas
   10 rotas apontadas (busca, ajuda, para proprietários, privacidade, Início, Meus imóveis, Revisão, Meus dados, Simulador, Pedidos),
   nos dois tamanhos. **Conforme.**
5. **E526** (diálogos de filtro da busca): reconferido na main de hoje com o T841 local — passa a 390 e 1280 (correção do #2457 de pé).

Nenhum defeito novo nesta passada.

## Rotas que nenhuma passada tinha medido — passada 14 (05/11, modo demonstração, 390 e 1280)

14 rotas públicas (fale com a Viva, cidades, parceiros: ativar, buscar e fotógrafos, pedidos e novo pedido, preços, segurança,
conferir, desligar alerta de busca e avisos, guia de fotos, excluir conta) e 18 do painel (contratos, fechamento, leads, recibos,
ROI, serviços, tributação, verificação, painel do parceiro, orçamentos, Conta › avaliações, segurança, papéis e pagamentos,
agenda, buscas, candidaturas, propostas), com as verificações da casa (um h1, um botão cheio no `main`, rolagem lateral) e as da
passada 13 (imagem vazia/quebrada, fixo sobre conteúdo no fim da rolagem, texto cortado). Recortes de tela de cada rota.

Achados (numerados):

1. **Rolagem lateral, imagem quebrada, h1**: nenhuma rolagem lateral, nenhuma imagem quebrada, um h1 em cada tela. **Conforme.**
2. **Texto cortado**: só textos para leitor de tela (`sr-only`: "Conversa com a assistente", "Sua mensagem para a Viva",
   "Outro local: nome do lugar ou endereço"). **Conforme.**
3. **Fixo sobre conteúdo**: a barra de baixo (390) e o botão "Fale com a Viva" (1280, /parceiros/buscar) cobrem itens só no meio
   da rolagem; no fim, nada fica por baixo deles nas 6 rotas apontadas. **Conforme.**
4. **Dois botões cheios em Conta › Como você usa a Viva** ("Começar um anúncio" e "Cadastrar meu serviço"): é o desenho do
   mockup aprovado `perfil-03-papeis-com-fotos` (os dois cartões com botão verde cheio). Exceção do desenho à regra de um botão
   cheio por tela; **não mudei** — fica para decisão do Muse se a regra deve vencer o mockup.
5. **Redirecionamentos**: /precos → home, /dashboard/roi-imovel → Simulador, /dashboard/tributacao → Ferramentas, /cidades →
   a cidade do demo. /pedidos e Conta › avaliações pedem sessão real (levam ao login no demo; ficam para o laboratório).

Nenhum defeito novo nesta passada.

## Tablet (768) depois das mudanças de 05/11 — passada 15 (05/11, modo demonstração)

A largura de tablet não era medida desde a passada 4 (02/11). 24 rotas públicas e 37 do painel a 768 × 1024, com as
verificações das passadas 13 e 14 (um h1, um botão cheio no `main`, rolagem lateral, imagem vazia/quebrada, fixo sobre conteúdo
no fim da rolagem, texto cortado). Recortes de tela de cada rota.

Achados (numerados):

1. **Reembolso da caução** (`/dashboard/reembolsos`): a linha "Motivo · Valor · Evidência · Adicionar" tinha 4 colunas já a 640 px;
   a 768 os campos se sobrepunham, o "Adicionar" saía da tela e a página rolava 101 px de lado (a 1280, o exemplo do Motivo
   aparecia cortado). **Corrigido — PR #2742**: 1 coluna no celular, 2 a partir do tablet, campos que encolhem e com a altura do
   botão. Guardas: teste de unidade e T909 (laboratório, 390/768/1280).
2. **Assistente, passo 2 (Fotos)**: a varredura apontou "Dicas rápidas" sob o rodapé fixo — é o conteúdo do "Ver dicas de foto"
   fechado (`<details>`), que não aparece na tela. Falso positivo. **Conforme.**
3. **Demais rotas**: nenhuma rolagem lateral, nenhuma imagem quebrada, um h1 por tela; textos cortados só nos de leitor de tela.
   Conta › Como você usa a Viva segue com os dois botões cheios do mockup `perfil-03` (passada 14, item 4). **Conforme.**
4. **Modo morador do painel**: no demo o Início sempre mostra a visão combinada (o demo vence o modo); a medição do modo morador
   fica para o laboratório.

## E99 (PUBLICO-A) — páginas públicas no padrão aprovado, reconferência de 05/11 (modo demonstração, 1280 e 390)

O E99 de 31/10 (#1669) conferiu /parceiros e /empresas (conformes) e corrigiu /como-funciona. Faltavam a home e as demais públicas.
Critério do #1669: menu público novo, fundo clean (branco e `#f7f7f7`, nada de bege; camada escura só sobre foto), um botão cheio
por tela no `main`, grades pares (sem buraco na última linha), fotos carregadas e sem rolagem lateral. Medido rolando cada página
até o fim (para carregar as fotos), com recorte da página inteira.

| Página | Fotos | Resultado |
|---|---|---|
| `/` (home; tabela comparativa intacta) | 26/26 | **Conforme, sem PR** |
| `/para-proprietarios` | 11/11 | **Conforme, sem PR** |
| `/ajuda` | 7/7 | **Conforme, sem PR** |
| `/guias` | 2/2 | **Conforme, sem PR** (7 cartões: o último ocupa a linha, passada 9) |
| `/seguranca` | 3/3 | **Conforme, sem PR** |
| `/parceiros/buscar` | 12/12 | **Conforme, sem PR** — a "grade" apontada a 1280 é o formulário de busca (campos + "Buscar" numa linha, "Emite nota fiscal" na de baixo); categorias 6 numa linha |
| `/parceiros/fotografos` | 2/2 | **Conforme, sem PR** — idem: formulário CEP/cidade + "Buscar" |
| `/cidades/uberlandia` | 32/32 | **Conforme** — a última linha da lista de anúncios incompleta é a decisão de desenho da /buscar (passada 9) |
| `/parceiros`, `/empresas`, `/como-funciona` | 21, 10, 18 | **Conformes** (reconferidas depois do #1669) |

Nenhuma página pública precisou de correção nesta reconferência.

## Telas que mudaram depois da passada 15 — passada 16 (05/11, modo demonstração, 390 toque, 768 e 1280)

Rotas mexidas pelos PRs mesclados depois da passada 15 (E416 selos, E595/E596, E602 índice do assistente, E607 Passo 1,
E610, E613, E621 /comparar, E136 calendário no toque, E521 tabela do /comparar): `/`, `/buscar`, `/comparar`,
`/imoveis/ube-001`, `/socios`, `/decisao`, `/favoritos`, painel (Início, Meus imóveis, os 10 passos do cadastro, Propostas,
Comparar, Pedidos, Favoritos). 390 em iPhone 13 emulado (toque). Medido: rolagem lateral, imagem quebrada, texto cortado,
botões cheios no `main`, controle coberto por barra fixa e — rolando com a roda até a página parar — se o último controle
fica acima da barra fixa de baixo.

1. **`/comparar` a 768 e 1280: colunas de larguras diferentes** — a tabela em layout automático dava a cada coluna a
   largura do título; as fotos 4:3 do E621 saíam com 143/132/119 px de altura e os títulos desalinhados. **Corrigido no
   #2800** (cada coluna com a mesma fração; t914 mede 768 e a altura).
2. **Fim da página atrás da barra fixa** (390 /buscar, /dashboard e Passo 5; 768 /dashboard e Passo 5): a primeira sonda
   (`scrollTo` direto) mediu durante a acomodação da página. Rolando de verdade até parar, o último controle fica acima da
   barra em todas. **Conforme, sem PR.**
3. **Textos "cortados"** (índice do assistente "1. Tipo do imóvel", "— passo atual", "— feito", "Imóveis encontrados"): são
   textos só para leitor de tela (1 px). **Conforme.**
4. **`/socios` e `/decisao`**: redirecionam para `/modelodenegocio`, que pede o código de acesso (`/acesso-socios`), nas três
   larguras. **Conforme** (E595/E596).
5. **Demais rotas**: nenhuma rolagem lateral, nenhuma imagem quebrada, no máximo um botão cheio no `main`. Selos empilhados
   nos cartões (E416), grade do Passo 1 (E607) e índice do assistente (E602) conferidos na tela a 390 e 768. **Conformes.**

## `/buscar` sem resultado e limpeza dos filtros — passada 18 (05/11, modo demonstração, 390 toque, 768 e 1280)

1. **"Nenhum imóvel encontrado"** (filtros que zeram a busca: `pet=1&porte=G&nota=1&gestor=1&negocia=1&precojusto=1&homeoffice=1`,
   e `local=Manaus`): título "Nenhum imóvel com estes filtros", um botão cheio ("Publicar um pedido de moradia"), nenhum
   botão fora do bloco, sem rolagem lateral nas três larguras. **Conforme** (fecha o item 7 da passada 17).
2. **E451 — "Limpar tudo" com a folha aberta**: barra, título e URL já ficam limpos na hora (corrigido no E589, #2698).
   **Guarda do caso do relato no #2806** (t917: pílulas Tipo e Preço vindas da URL).
3. **E453 — título do cartão do mapa**: títulos longos ainda saíam cortados na 2ª linha. **Corrigido no #2807**.

## Rotas ainda não medidas e fechamento da matriz — passada 19 (05/11, modo demonstração, 390 toque e 1280)

Páginas públicas que nenhuma passada tinha medido (`/precos`, `/avaliadores`, `/conferir`, `/excluir-conta`, `/guia-fotos`,
`/alerta-busca/desligar`, `/pedidos/novo`, `/termos`, `/privacidade`, `/seguranca`, `/ajuda`, os 7 guias, `/proprietario/exemplo-1`
e `-2`, `/parceiros/avaliadores`, `/fotografos`, `/buscar`) e 28 telas do painel (Interessados, Avaliações, Ganhos, Carteira,
Agenda, Ferramentas, Simulador, Tributação, Fechamento, Verificação, Respostas rápidas, Serviços, Solicitações, Visitas,
Locações, Notificações, Conta e suas seções, Propostas, Mensagens, Indicações…). Medido: imagem quebrada ou vazia, rolagem
lateral, texto cortado, controle coberto por elemento fixo (no topo e rolando até o fim da página), botões cheios no `main` e
fundo bege.

1. **Imagem quebrada ou vazia, rolagem lateral, fundo bege, botão cheio a mais**: nenhum caso nas 46 rotas, nas duas larguras.
   **Conforme.**
2. **Controle coberto por elemento fixo**: a sonda acusou `/excluir-conta`, `/privacidade`, `/ajuda`, `/guias/o-que-e-a-caucao`,
   `/parceiros/buscar` e `/dashboard/simulador`/`conta/seguranca` a 390 — são controles abaixo da dobra, atrás da barra de
   baixo na primeira tela. Rolando até a página parar, o último controle de cada uma fica acima da barra. **Conforme, sem PR.**
3. **Textos "cortados"** (`/pedidos/novo` "Outro local: nome do lugar ou endereço"): rótulo só para leitor de tela (1 px).
   **Conforme.**
4. **404 esperados** de endereços que não existem (`/avisos`, `/imoveis-perto-de/uberlandia`, `/dashboard/estadia`,
   `/dashboard/qa`…): a página "Página não encontrada" aparece (passada 17). **Conformes.**
5. **Matriz × mockups**: os 87 mockups do ramo `mockups` têm linha na matriz. O que resta sem fechar é só o que depende de
   decisão do Daniel (`cabecalho-*`, `cadastro-imovel-07-descricao`, `admin-servicos`, `pouso-morador`) ou de sessão real
   (`parceiro-ordens`, `perfil-01`, `perfil-02`, `/auth/verificar-codigo`, `/dashboard/avaliacoes`), cada uma com a guarda do
   laboratório que a cobre. **Nada novo a conferir no modo demonstração.**

## Anúncios, painel do dono e grades — passada 20 (06/11, modo demonstração, 390 toque e 1280)

Os 15 anúncios (`/imoveis/ube-001` a `-015`), as telas de edição, desempenho e cartão de 6 anúncios no painel, 35 telas do
painel medidas para grade com buraco e fundo bege, e as públicas ainda não medidas (`/precos`, `/avaliadores`, `/conferir`,
`/guia-fotos`, guias, `/proprietario/exemplo-1`, parceiros). Medido: imagem quebrada ou vazia (rolando devagar até o fim,
porque a rolagem rápida deixa foto "cinza" só no print), rolagem lateral, texto cortado, controle coberto, botões cheios,
fundo bege e grade com última linha incompleta.

1. **`/proprietario/[id]`: grade de imóveis com buraco a 1280** — 5 imóveis em 4 colunas deixavam o quinto sozinho na 2ª
   linha. **Corrigido no #2826** (colunas pela quantidade: 5 → uma linha de 5; t919).
2. **Imagem quebrada ou vazia, rolagem lateral, fundo bege, botão cheio a mais**: nenhum caso. As fotos "cinza" do print de
   página inteira da home eram só a rolagem rápida do script (todas carregam rolando devagar). **Conforme.**
3. **Texto "cortado"** nos anúncios ("Padrão mínimo"): título só para leitor de tela. **Conforme.**
4. **Grades com última linha incompleta** que são desenho aprovado: mosaico da galeria do anúncio (1 grande + 4), listas de
   comodidades e o calendário de disponibilidade (7 colunas), e a lista da cidade (decisão B2, passada 9). **Conformes.**
5. **`/dashboard/recibos`**: o filtro (Imóvel · Mês · Ver) é uma linha só; a sonda acusou por alinhar o botão pela base.
   **Conforme.**

## Telas mexidas pelos PRs de 06/11 — passada 21 (06/11, modo demonstração, 390 toque e 1280)

E626 (selos do cartão, #2829), E452 (pílula Nível, #2815), E453, E403, E603/E624/E625/E513 (Pista B), /comparar e a grade do
proprietário. Medido em 33 rotas (públicas e do painel): imagem quebrada ou vazia, rolagem lateral, texto cortado, controle
coberto (no topo e rolando até o fim), botões cheios, fundo bege — e, nos cartões, o que o E626 prometeu.

1. **E626 nos cartões reais** (`/buscar`, `/`, `/cidades/uberlandia`, `/imoveis/ube-001` — parecidos —, `/proprietario/exemplo-1`),
   390 e 1280: no máximo 2 pílulas em todos os cartões com selo (10 na busca, 10 na cidade, 2 na home, 4 no proprietário),
   nenhuma sobre o coração, nenhuma fora da foto, nenhuma com texto cortado. **Conforme.**
2. **Imagem quebrada ou vazia, rolagem lateral, fundo bege, botão cheio a mais**: nenhum caso. **Conforme.**
3. **Controle "coberto"** (`/para-proprietarios`, `/ajuda`, `/dashboard`, `/dashboard/pedidos` a 390): abaixo da dobra, atrás da barra
   de baixo na primeira tela; rolando até o fim ficam acima dela. **Conforme.**
4. **Textos "cortados"** ("Imóveis encontrados", "Padrão mínimo", índice do assistente): só para leitor de tela. **Conforme.**
5. **Matriz × mockups**: sem tela nova que o modo demonstração alcance; o que resta aberto segue sendo decisão do Daniel ou
   sessão real (passada 19, item 5). Nada a corrigir.

## Cadastro, anúncios e painel depois dos merges de 06/11 — passada 22 (06/11, modo demonstração, 390 toque e 1280)

Merges da noite: os 10 passos do assistente (E604, E606, E608, E609, E611, E612, E614, E616, E618, E619), E603, E624, E625, E627–E629
e o Início do painel. Medido em 30 rotas (11 públicas e 19 do painel, com os 10 passos e a qualificação): imagem quebrada ou vazia,
rolagem lateral, texto cortado, controle coberto (no topo e rolando até o fim), botões cheios, fundo bege, grade com buraco
(35 telas do painel) e, nos cartões reais, o que o E626 prometeu.

1. **Passos 1 a 10 do cadastro e qualificação**: nenhum controle atrás do rodapé fixo ao rolar até o fim, a 390 e 1280; sem rolagem
   lateral, sem imagem quebrada, sem fundo bege. **Conforme.**
2. **E626 nos cartões reais** (busca, home, cidade, anúncio — parecidos —, proprietário), 390 e 1280: no máximo 2 pílulas (10, 2, 10, 2
   e 4 cartões), nenhuma sobre o coração, nenhuma fora da foto, nenhuma com texto cortado. **Conforme.**
3. **Grades e fundo** no painel (35 telas): nenhuma grade com buraco (o filtro do `/dashboard/recibos` é uma linha só; a sonda acusa
   por alinhar o botão pela base) e nenhum fundo bege. **Conforme.**
4. **Textos "cortados"** e **controles "cobertos"** acusados pela sonda: títulos só para leitor de tela e controles abaixo da dobra,
   atrás da barra de baixo na primeira tela — rolando até o fim ficam acima dela. **Conformes.**
5. **Lab-crítico do #2767 (E457) falhava**: o `t912` abria a pílula "Nível" sempre, e depois do E452 ela some quando o resultado não
   tem nível (o caso do laboratório). **Corrigido no próprio #2767** (a spec pula o Nível sem a pílula; commit 16481760b).
6. **Matriz × mockups**: sem tela nova que o demo alcance; o que resta é decisão do Daniel ou sessão real (passada 19, item 5).

### Estado dos PRs da Pista A e do gate (06/11, ~01h10 UTC)
- **main**: CI verde no último push (`020350e95`, #2836) e nos 18 anteriores.
- **#2767 (E457, rascunho)**: conflito com a main resolvido; spec do laboratório corrigida; aguardando o lab-crítico rodar de novo.
- **#2765 (E455, rascunho)**: verify, e2e e lab-crítico verdes; sem conflito com a main. Aguardando QA.

## Rotas ainda não medidas nesta volta, com o carregamento real de cada imagem — passada 23 (06/11, modo demonstração, 390 toque e 1280)

80 rotas (29 públicas e 51 do painel: Orçamentos, Parceiro, Pedidos da cidade, Conta e suas seções, Leads, Respostas rápidas,
Verificação, Ferramentas, Simulador, Tributação, Fechamento, Visitas, Locações, Contratos, Garantias, Recibos, Carteira, Ganhos,
Agenda, Mensagens, edição, desempenho, cartão e nível de anúncios, `/qualificar`, `/roi`, `/simulacao`, `/tributario`, `/auth/*`…).
Sonda nova: rola devagar até o fim, espera `decode()` de cada imagem (com limite de 4 s) e confere também o `background-image`.
Além de rolagem lateral, texto cortado, controle coberto, fundo bege e grade com última linha incompleta.

1. **`/cidades/[cidade]`: 13 bairros em 3 colunas a 1280 deixavam "Martins" sozinho na última linha.** **Corrigido no #2851**
   (grade de 6 colunas de 2: o que sobra preenche a linha; t921).
2. **Carregamento das imagens**: nas 160 medições (80 rotas × 2 larguras), toda imagem visível carrega. As que aparecem "não
   carregadas" logo depois de abrir são `loading="lazy"` fora da vista (passos do carrossel e cartões abaixo da dobra): levadas à vista,
   carregam todas (medido em `/dashboard` a 1280 e `/imoveis/ube-002` a 390). O `src` de reserva dessas imagens aponta para `w=3840`,
   mas o navegador escolhe o tamanho pelo `sizes` (`33vw`/`100vw`), não esse. **Conforme.**
3. **Rolagem lateral, fundo bege, texto cortado, controle coberto**: nenhum caso. **Conforme.**
4. **Grades com última linha incompleta que são desenho aprovado**: mosaico da galeria do anúncio, listas de comodidades e "regras da
   estadia" de 3 itens (2 colunas, como em passadas anteriores). **Conformes.**
5. **Rotas que redirecionam** no demo (`/dashboard/parceiro/avaliacao`, `/dashboard/assinatura` → `/dashboard`; `/qualificar` → login;
   `/precos` → `/`): medidas na tela de destino. **Conformes.**
6. **Matriz × mockups**: o que resta é decisão do Daniel (`cabecalho-*`, `cadastro-imovel-07-descricao`, `admin-servicos`,
   `pouso-morador`), texto jurídico congelado (`/privacidade`, `/termos`) ou sessão real (`parceiro-ordens`, `perfil-01`, `perfil-02`,
   `/auth/verificar-codigo`, `/dashboard/avaliacoes`). Nenhuma é alcançável pelo demo. Nada a corrigir.

## Telas mexidas pelos merges de 06/11 de madrugada — passada 24 (06/11, modo demonstração, 390 toque e 1280)

E640a (fotos públicas leves), E503 (esqueleto da home), E476 (prévia da foto de perfil), E630 (prévia do título), E631 (contagem dos
imóveis do dono), E634 (ficha-resumo do contrato), E637 (prazos da caução), E443 (logo do cabeçalho logado) e a grade dos bairros.
36 rotas (18 públicas e 18 do painel, incluindo os Passos 2, 5 e 10 do cadastro), com a sonda da passada 23 (rola devagar, espera o
`decode()` de cada imagem, confere `background-image`, rolagem lateral, texto cortado, fundo bege e grade).

1. **Imagem quebrada ou vazia, rolagem lateral, texto cortado, fundo bege, botão cheio a mais, elemento fixo sobre conteúdo**:
   nenhum caso nas 72 medições. **Conforme.**
2. **Imagens "não carregadas" logo depois de abrir** — 4 fotos de exemplo do Passo 2 (`/guia-fotos/*.webp`, "Ver dicas de foto") e
   cartões `loading="lazy"` abaixo da dobra de `/dashboard`: as fotos do Passo 2 estão dentro de um `<details>` recolhido (os 4
   arquivos existem e respondem 200; abertos, carregam a 390 e a 1280), e as do `/dashboard` carregam ao chegar à vista. **Conforme.**
3. **Logo do cabeçalho logado** (E443, #2858): a 1280 e a 390, em `/dashboard`, `/mensagens`, `/conta` e `/imoveis`, o logo visível
   aponta para `/`. **Conforme.**
4. **Grade com última linha incompleta** que sobra: a lista de imóveis da cidade a 1280 (decisão B2, passada 9). **Conforme.**
5. **Matriz × mockups**: sem tela nova que o demo alcance (passada 23, item 6). Nada a corrigir.

## Sobreposições, painéis, menus e folhas — passada 25 (06/11, modo demonstração, 390 toque e 1280)

Estados abertos (não só a página parada): menu do site público (390), painéis da barra de busca (Datas, Local, Tipo, Preço,
Ordenar) e a folha "Mais filtros", calendário do cadastro (Passo 9), sino de avisos, menu "Conta" do painel e painel do chat.

1. **Painel ou folha maior que a tela, cortado pela borda, rolagem lateral, texto cortado, fundo bege**: nenhum caso. **Conforme.**
2. **Painel Local a 390**: passa da dobra, mas está no fluxo da página e rola com ela (E526, desenho aprovado). **Conforme.**
3. **Chat flutuante ausente a 390**: some abaixo de 768 px por desenho (E246). **Conforme.**
4. **Calendário do cadastro** (E136): abre o `CalendarioBR` no toque e no computador, dentro da tela. **Conforme.**
5. **Matriz × mockups**: sem tela nova que o demo alcance (passada 23, item 6). Nada a corrigir.

## Estados abertos a 768 (tablet) — passada 26 (06/11, modo demonstração)

Nada foi mesclado na `main` desde a passada 25 (a ponta é o merge da passada 24), então não há tela nova para medir. A passada repete os
estados abertos da 25 no eixo que faltava, **768 px** (toque): painéis da busca (Datas, Local, Tipo, Preço, Ordenar), folha "Mais
filtros", chat "Fale com a Viva" (aparece a partir de 768, E246), sino, menu Conta e calendário do cadastro.

1. **Painel, folha, menu ou chat cortado, maior que a tela, com rolagem lateral, texto cortado ou fundo bege**: nenhum caso nas 10
   medições (as duas "ausente" da primeira rodada eram seletor da sonda; refeitas com o seletor certo, conformes). **Conforme.**
2. **Chat a 768**: painel de 380 px de largura, dentro da tela e sem rolagem lateral; o fechar fora/Esc está no #2765 (rascunho, aguarda QA). **Conforme.**
3. **Painel Local a 768**: 520 px de altura, dentro da tela (E526). **Conforme.**
4. **Matriz × mockups**: sem tela nova. Nada a corrigir.

## Estados de erro, vazio e sem sessão — passada 27 (06/11, modo demonstração, 390 toque, 768 toque e 1280)

Entraram na `main` desde a passada 26: E633 (matrícula opcional), E641 (cobrança mensal, atrás de chave desligada, sem tela), E624 (contagem
das cópias em "Meus imóveis") e o registro da passada 26 (#2868). **Leitura 3S**: E641 não tem tela (chave desligada); E633 só troca regra
de prontidão e o texto do bloco de documento do Passo 10; E624 só nomeia as cópias na frase de contagem. Nenhum acrescenta elemento novo
ao desenho. A passada mede os estados que ainda não tinham sido vistos nesta volta: 404, "sem resultados", "sem sessão" e página
inexistente do painel (28 rotas × 3 larguras, com a sonda da passada 23: imagens com `decode()`, `background-image`, rolagem lateral,
texto cortado, fundo bege, grade).

1. **404 públicos** (`/rota-que-nao-existe`, `/imoveis/…`, `/cidades/…`, `/proprietario/…`, `/guias/…`, `/parceiros/…`): respondem 404 com a
   página de "não encontrada" do site, sem rolagem lateral, sem imagem quebrada, texto cortado ou fundo bege. **Conforme.**
2. **Sem sessão** (`/dashboard`, `/dashboard/imoveis`, `/dashboard/mensagens`, `/dashboard/conta`, `/dashboard/avaliacoes`): vão para `/auth`.
   **Conforme.**
3. **Sem resultados da busca** (`/buscar?local=Atlantida`): "Nenhum imóvel com estes filtros", cartão "Ainda não temos imóvel para essa busca",
   botões "Publicar um pedido de moradia" e "Ampliar a busca", sem rolagem lateral a 390, 768 e 1280; painel Datas aberto nesse estado cabe
   na tela. A fileira de pílulas rola de lado de propósito (carrossel). Filtros que a busca não conhece (`cidade=`, `tipo=castelo`) são
   descartados e mostram a lista inteira, por desenho. **Conforme.**
4. **Painel, imóvel inexistente** (`/dashboard/imoveis/…` e `/mensagens/…` → 404; `/dashboard/contratos/…` → "Página não encontrada" dentro da
   estadia, com o menu da estadia): sem defeito visual. Observação: o contrato inexistente responde HTTP 200 com a mensagem; é página
   privada, fora de índice, sem efeito visível. **Conforme.**
5. **Estados vazios do painel** (notificações, interessados, contratos, garantias, orçamentos) e Passos 10 e Revisão do cadastro: sem
   defeito nas 3 larguras. **Conforme.**
6. **Comparar vazio ou com código inexistente, Favoritos sem sessão, `/conferir/<código inexistente>`**: respondem na própria tela, sem
   defeito. **Conforme.**
7. **Matriz × mockups**: sem tela nova alcançável pelo demo. Nada a corrigir.

## Varredura geral por blocos — passada 29 (06/11, modo demonstração, 390 toque e 1280)

Sequência da vigia: E442, E382 e E383 já estão mesclados (E442: #2613 + #2625, hover do mapa, spec `t1156`; E382: #1978; E383: #2171 junto com o E418),
então não foram refeitos. Conferi o E442 na `main` de hoje: no mapa da busca a 1280, o mouse sobre o preço abre o cartão do **mesmo imóvel**
(foto, título, valor, link do anúncio) e o pino não tem `title` nativo. Depois, varredura de 28 rotas (16 públicas e 12 do painel) com a sonda das
passadas 23/24 mais duas classes novas: **cartão sem foto** e **texto de foto ausente** ("A foto principal aparece aqui", "sem foto").

1. **Cartão sem foto, texto de foto ausente, imagem vazia ou quebrada, elemento fixo sobre conteúdo, rolagem lateral, texto cortado, fundo
   bege**: nenhum caso real. **Conforme.**
2. **"Imagem não carregada" logo depois de abrir** em `/dashboard` (4 cartões recomendados), no carrossel de `/imoveis/ube-001` a 390
   (fotos 6 a 8) e nos exemplos do Passo 2: são `loading="lazy"` fora da vista ou dentro de bloco recolhido, e o otimizador de imagem do servidor
   de desenvolvimento demora na primeira vez (variante de 3840 px). Medido de novo, as fotos do `/dashboard` completam e aparecem. **Conforme.**
3. **Grades com última linha incompleta**: lista da cidade a 1280 (decisão B2), mosaico da galeria, comodidades principais. **Conformes** (como nas passadas 9, 23 e 24).
4. **`/dashboard/buscas-salvas`** responde 404: a lista de buscas salvas mora em `/buscar` (aba), não há rota própria. **Conforme.**
5. **Matriz × mockups**: sem tela nova alcançável pelo demo (E640b e E640c pedem dado que o demo não tem; E513 é massa de teste). Nada a corrigir.

## Varredura geral a 768 (tablet) — passada 30 (06/11, modo demonstração, 768 toque)

Nada novo na `main` desde a passada 29 (nenhuma tela nova para medir). A passada repete as 28 rotas da 29 no tamanho que ainda não tinha
a varredura de página inteira, **768 px**, com a mesma sonda (imagem com `decode()`, `background-image`, cartão sem foto, texto de foto ausente,
rolagem lateral, texto cortado, fundo bege, grade).

1. **Imagem vazia ou quebrada, cartão sem foto, elemento fixo sobre conteúdo, rolagem lateral, texto cortado, fundo bege**: nenhum caso real. **Conforme.**
2. **"Imagem não carregada" logo depois de abrir**: `/dashboard` (cartões recomendados, `loading="lazy"`) e os 4 exemplos do Passo 2 (dentro do bloco
   recolhido "Ver dicas de foto"), como a 390 e a 1280. **Conforme.**
3. **Grades com última linha incompleta**: lista da cidade (decisão B2), mosaico da galeria e comodidades. Desenho aprovado. **Conformes.**
4. **E193** (#2874 + #2876, mesclados): nenhuma ação; a prova ao vivo é do chat principal. O ajuste de specs do #2883 segue aberto.
5. **Matriz × mockups**: sem tela nova alcançável pelo demo. Nada a corrigir.

## /comparar e telas vizinhas de busca e cartões — passada 31 (06/11, modo demonstração, 390 toque e 1280)

**E621** (colunas do /comparar sem foto) já está mesclado (#2789, 4:3 como os cartões; mais a largura igual das colunas do #2800), então não foi refeito.
Conferi o resultado na `main` de hoje e varri /comparar (2, 3 e 4 imóveis na URL, código inexistente, vazio), /buscar (5 variações), /favoritos,
/cidades, a home e os favoritos e o início do painel.

1. **Colunas do /comparar**: cada coluna abre com a foto principal e todas as imagens completam o carregamento (2 e 3 colunas; a 390 e a 1280).
   Com 4 códigos na URL aparecem 3 colunas: o limite é 3 imóveis por desenho (`MAX_COMPARAR`, com aviso). **Conforme.**
2. **Imagem vazia ou quebrada, cartão sem foto, rolagem lateral, texto cortado, fundo bege, elemento fixo sobre conteúdo**: nenhum caso real. **Conforme.**
3. **Grade desalinhada**: só a lista da cidade a 1280 (15 imóveis em 4 colunas, decisão B2). **Conforme.**
4. **`/dashboard` a 1280**: "imagens não carregadas" são os cartões recomendados com `loading="lazy"` (completam ao chegar à vista). **Conforme.**
5. **Matriz × mockups**: nada novo. Nada a corrigir, sem PR de correção.

## Telas de administração mexidas pelo E477 — passada 32 (06/11, modo demonstração, 390 toque e 1280)

Mesclados desde a passada 31: E477 (telas do admin somente leitura para o observador: #2885 e #2888) e E642 (garantia única na caução, sem tela).
**Leitura 3S**: o E477 só acrescenta o estado somente leitura (aviso e controles desligados) às telas de agentes, ajuda de publicação, avaliadores,
moderação de ofensas e solicitações; o E642 é regra de servidor. Nenhum elemento novo no desenho comum. O demo entra como administrador, não como
observador, então o estado somente leitura em si exige a conta de observação (sessão real). Medi as 6 telas tocadas a 390 e 1280.

1. **Imagem quebrada, rolagem lateral, texto cortado, fundo bege, elemento fixo sobre conteúdo, grade desalinhada** em `/admin`, `/admin/agentes`,
   `/admin/ajuda-publicacao`, `/admin/avaliadores`, `/admin/moderacao/ofensas` e `/admin/solicitacoes`: nenhum caso (12 medições). **Conforme.**
2. **Estado somente leitura (observador)**: não alcançável no demo; cobertura é dos testes de unidade e laboratório do E477. Fica para a QA com a conta de observação.
3. **E442** (hover do mapa, #2613) e **E443** (logo do cabeçalho logado, #2858): já mesclados, não refeitos.
4. **Matriz × mockups**: sem tela nova de morador, dono ou parceiro. Nada a corrigir.

## Cartões, comodidades e cabeçalho do anúncio depois dos merges de 06/11 — passada 33 (06/11, modo demonstração, 390 toque e 1280)

Mesclados desde a passada 32 e medidos aqui: E643 (#2894, estado do cartão fora da foto), E454 (#2899, fotos da primeira fileira com prioridade),
E427 resíduo (#2897, nome no cartão do cabeçalho), E356 (#2903, "Total por mês" e linha da estadia em todo cartão) e E357 (#2904, comodidades
agrupadas por categoria). **Leitura 3S**: nenhum elemento novo fora do que cada PR disse; o E394 (#2905) mexe só em texto de e-mail.
Sonda das passadas 23/24/29 com duas classes novas: **cartão sem o rótulo "Total por mês"** e **categoria de comodidades sem ícone**.
15 rotas × 2 larguras.

1. **Imagem quebrada ou vazia, cartão sem foto, rolagem lateral, texto cortado, fundo bege, elemento fixo sobre conteúdo**: nenhum caso real. **Conforme.**
2. **Cartões da busca, home, cidade, favoritos e vitrine do dono**: todos com o rótulo "Total por mês, tudo incluído" e a linha do total da estadia; a foto
   guarda no máximo as 2 pílulas do E626. **Conforme.**
3. **Comodidades do anúncio** (4 anúncios): categorias com ícone e itens com ícone em grade de 2 colunas. As categorias de número ímpar de itens
   (Cozinha com 5, por exemplo) deixam o último item na primeira coluna, à esquerda: é a regra do E313, não um buraco. **Conforme.**
4. **"Imagens não carregadas"**: carrossel do anúncio (fotos 6 a 8, fora da vista) e cartões lazy do `/dashboard`; completam ao chegar à vista. **Conforme.**
5. **Estado "Visto" / "Você já contatou" no texto do cartão** e **nome completo no cabeçalho depois do aceite**: exigem usuário com marca e visita confirmada (sessão real);
   cobertos pelas specs `t166` e `t923`. Ficam para a QA.
6. **Matriz × mockups**: nada novo. Nada a corrigir.

## Qualificação na moldura do assistente (E194) e o que mesclou depois da passada 33 — passada 34 (06/11, modo demonstração, 390 toque e 1280)

Depois da passada 33 mesclou só o #2905 (E394: texto de e-mail e ligação do id nos crons), sem nenhuma tela. **Leitura 3S**: nada visual para medir.
A passada confere o **E194** (🔴 na lista-master) na `main`: já está implementado (#1532, spec `t565`; reconferido no #1660, "nada a corrigir").

1. **Qualificação na moldura do assistente**, em `/dashboard/imoveis/novo` a 390 e a 1280: aparece o selo "Anunciar imóvel", o rodapé fixo do assistente
   ("Antes do Passo 1 · Qualificação 1 de 5", com "Pular") e a barra de progresso contínua; sem rolagem lateral. A Qualificação não abre mais como um
   segundo cadastro. **Conforme.**
2. **E-mails com título + código** (#2905 e #2908): sem tela; coberto por `e394-imovel-nos-emails.test.ts`. Nada a medir.
3. **Matriz × mockups**: nada novo. Nada a corrigir.

## Merges depois da passada 34 — passada 35 (06/11)

Mesclou depois da passada 34 só o #2908 (E394: o `id` do imóvel passado aos e-mails restantes) e o registro da passada 34 (#2910). Os dois são texto de
e-mail, consulta de cron e documentação: **nenhuma tela mudou** (`git diff` de `src/app` e `src/components` desde a passada 34 vazio). **Leitura 3S**:
nada a medir no desenho.

1. **E455**: (i) a barra "Comparar" sobre a 2ª fileira, já mesclada (#2463, E529, guarda `t844`); (ii) o chat "Fale com a Viva" que fecha ao tocar fora e com Esc
   está no rascunho #2765, aguardando QA. Mesclável sem conflito com a `main` atual (simulação de merge limpa). Nada refeito.
2. **E454**: fotos da primeira fileira com prioridade, já mesclado (#2899; os 4 primeiros cartões com `loading="eager"` e `fetchpriority="high"`). Nada refeito.
3. **E457**: rascunho #2767, aguardando QA; também mescla sem conflito com a `main` atual. Nada refeito.
4. **Matriz × mockups**: nada novo. Nenhum defeito novo para registrar.

## Merges depois da passada 35 — passada 36 (06/11; 390, 768 e 1280)

Mesclou depois da passada 35 só o #2913 (E645, Pista B: spec `t1250` que visita `/qualificar` a 390 e 1280 com a régua de console) e o registro da passada 35 (#2912).
`git diff` desde a passada 35: só `docs/matriz-conformidade-mockups.md`, `tests/e2e/cobertura.json` e a spec nova; **`src/` sem diferença**. **Leitura 3S**: nenhuma tela nova
ou alterada para medir a 390, 768 ou 1280.

1. **Telas novas ou alteradas**: nenhuma. Nenhum defeito novo para registrar.
2. **Rascunhos aguardando QA**: #2765 (E455-ii) e #2767 (E457), checks verdes e mescláveis sem conflito com a `main` atual (simulação de merge limpa). Nada refeito.
3. **Matriz × mockups**: nada novo.

## Merges depois da passada 36 — passada 37 (06/11; 390 e 1280)

Mesclou depois da passada 36 só o #2914 (E477, Pista B): auditoria nas ações de servidor (`lib/saida/acoes.ts`, `lib/vistoria/actions.ts`) e **uma página alterada,
`/admin/qualidade`** (+8 linhas, o estado de ausência do E477). Medi `/admin/qualidade` (e `/admin` como controle) a 390, 768 e 1280 no demo: sem imagem quebrada, rolagem lateral, texto
cortado, fundo bege, elemento fixo ou grade desalinhada (6 medições). O estado de ausência em si exige a conta do observador (sessão real): fica para a QA.
Sequência da reativação conferida na `main`: **E194** (#1532 + #1660; evidência na passada 34), **E106** (#1661, `/buscar` com "Publicar pedido" na contagem e o tempo no painel Local, spec `t453`)
e **E52** (#1710, topo da página de avaliadores no padrão das institucionais) já estão mesclados. Nenhum defeito novo.

## Telas mexidas pelos merges de 06/11 de manhã — passada 38 (06/11, modo demonstração, 390, 768 e 1280)

Mesclados depois da passada 37 e medidos aqui: E370 (#2924, validade do pedido desde o início), E371 (#2925, cartão do pedido com internet, destino, transporte e tempo),
E372 (#2926, Meus dados: telefone e CPF), E360 (#2919, local da estadia no Início), E362 (#2920, texto de /parceiros), mais #2922 (E477, telas do admin
somente leitura, Pista B) e #2916 (E283-B, sem tela). **Leitura 3S**: nenhum elemento novo fora do que cada PR descreveu.
Sonda das passadas 23/24/29/33. 14 rotas × 3 larguras (42 medições): `/pedidos/novo` (sem data e com data), `/parceiros`, `/parceiros/buscar`, `/buscar`, home,
`/dashboard`, `/dashboard/pedidos`, `/dashboard/conta/dados`, `/dashboard/conta`, `/admin/contratos/encerramentos`, `/admin/imoveis`, `/admin/servicos`.

1. **Imagem quebrada ou vazia, cartão sem foto, rolagem lateral, texto cortado, fundo bege, elemento fixo sobre conteúdo**: nenhum caso real. **Conforme.**
2. **`/pedidos/novo` (E370)**: a validade aparece sem data de entrada e ganha a data exata com ela, sem rolagem lateral nas três larguras. **Conforme.**
3. **`/dashboard/conta/dados` (E372)**: o formulário carrega, sem rolagem lateral. O "Carregando…" do telefone dura o instante da leitura (não dá para fotografar no demo). **Conforme.**
4. **`/parceiros/buscar` a 768 e 1280**: a sonda marca "grade de 6 itens, última linha com 1": é o formulário de filtros (quatro campos, "Buscar" e a linha inteira do filtro
   de nota fiscal), desenho de formulário e não de cartões. **Conforme (falso positivo).**
5. **`/dashboard` a 768 e 1280**: "imagens não carregadas" nos cartões recomendados `loading="lazy"`; completam ao chegar à vista (como nas passadas 24, 29 e 33). **Conforme.**
6. **Estados que o demo não alcança**: local da estadia no Início (E360, sem estadia ativa), cartão do pedido com destino (E371, sem pedido publicado) e o estado somente leitura do admin
   (E477, conta de observação). Cobertos por testes de unidade; ficam para a QA. Nenhum defeito novo.
7. **Matriz × mockups**: nada novo.

## Varredura geral por blocos — passada 39 (06/11; modo demonstração, 390 e 1280)

Sequência da reserva das 04:00. **E357** (comodidades agrupadas) já está mesclado (#2904): pulado, sem refazer. Sem merges na `main` depois da passada 38 (#2940).
Sonda das passadas 23/24/29/33/38/39 em 55 rotas × 2 larguras (17 públicas, 38 do painel).

1. **Imagem quebrada, rolagem lateral, texto cortado, fundo bege, elemento fixo sobre conteúdo**: nenhum caso real. **Conforme.**
2. **Falsos positivos conhecidos, conferidos um a um**: fotos `loading="lazy"` fora da vista (carrossel de `/imoveis/ube-001..003` a 390, cartões recomendados de `/dashboard` a 1280);
   fundo `data:` SVG lido como imagem; grades de comodidades e mosaico da galeria com última linha ímpar em `/imoveis/*` (desenho); `/cidades/uberlandia` (15 em 4, B2);
   filtros de `/parceiros/buscar` (formulário); "cartão sem foto" em `/privacidade` e `/guias/*` (texto de artigo e JSON-LD, não cartão). **Conforme.**
3. **Matriz × mockups**: nada novo. Nenhum defeito novo a registrar; nenhuma PR de correção aberta por esta passada.

## Cardápio A em ordem — passada 41 (06/11; modo demonstração, 390 e 1280)

1. **Públicas (home, /buscar, imóvel, /empresas, /como-funciona, /ajuda)**: varridas nas passadas 29, 33 e 39 (55 rotas × 2 larguras). Depois da 39 a `main` só trouxe o simulador dos sócios (E646, tela com código de acesso, fora da Pista A) e os títulos de SEO das páginas de polo (#2953, sem tela): nada a repetir. **Conforme.**
2. **Logadas alcançáveis**: passadas 38 a 40 cobrem o painel e o admin estáticos. Esta passada mediu as telas com id que o demo alcança, descobertas pelos links das listas (uma por forma): `/dashboard/imoveis/:id` (+ `/editar`, `/cartao`, `/desempenho`, `/parceiros`, `/conforto`, `/nivel`; `/publicar` redireciona para a lista),
   `/dashboard/avaliacao-imovel/:id`, `/dashboard/visitas/:id`, `/dashboard/locacoes/:id` (vai ao contrato da estadia). 12 medições com a sonda das passadas anteriores (imagem com carregamento real, rolagem lateral, texto cortado, fundo bege, elemento fixo, cartão sem foto, grade): **nenhum defeito.**
3. **Painéis × padrão codificado** (fundo clean, cartões uniformes, grade par, ícone por comodidade): a trava `estilo-padrao` e as de grade passam na suíte (6493 testes); a única grade ímpar real achada na volta (`/admin/financeiro`, passada 40) está na #2954.
4. **Sem medir** (precisam de dados reais, ficam para a QA): `/dashboard/estadia/:id/*` (alteração, confirmada, convidado, encerrar, mensagens, ocupantes), `/dashboard/contratos/:id/ficha`, `/dashboard/servicos/pedidos/:id`, `/admin/parceiros/pedidos/:id`, `/admin/2fa/refazer`.
Nenhum achado novo; nenhuma correção nesta passada.

## Assistente de cadastro × mockups, elemento por elemento — passada 42 (06/11; modo demonstração, 390 e 1280)

Sequência da vigia: **E193** segue no rascunho #2956 (aguarda a QA; não há outro PR dele nem merge); **E194** já está na `main` (#1532 e #1660, spec t565; medido de novo em 390 e 1280: a qualificação traz o selo "Anunciar imóvel" e o rodapé
"Antes do Passo 1 · Qualificação 1 de 5" com a mesma barra do "Passo X de 10"). Mockups da branch `mockups` comparados lado a lado com a tela real nos passos da reprova (6, 8 e 9), a 1280 (e a 390 nos mesmos passos).
Inventário dos 10 passos (blocos abertos): nenhuma caixa quadrada, lista suspensa, pílula nem interruptor fora de cartão (com a #2956).

Diferenças listadas (mockup → real), todas já conhecidas e dentro do padrão codificado:
1. **Fundo**: mockup bege; real fundo clean (E166, o bege foi retirado de propósito). Cartão branco com sombra: igual.
2. **Cabeçalho**: mockup com marca e "60% · Passo 6 de 10" no topo; real tem a marca com "Precisa de ajuda?" e "Sair" no topo e o progresso no rodapé fixo ("Passo 6 de 10 · 7% pronto", barra verde contínua). Botão "Continuar" verde-escuro cheio, igual (rótulo com seta no real).
3. **Passo 6 (Regras)**: o mockup traz **interruptores** (Permite visitas, Visitas podem pernoitar, Aceita fumantes, Permite festas) e os horários do silêncio já abertos; o real traz **cartões grandes** (Mobiliado, Pets, Crianças, Fumar) e os blocos de Convivência (Silêncio, Festas, Visitas) como cartão que abre o grupo. **Conflito a decidir**: o mockup desenha toggle; a reprova do E193 (06/11) e a decisão de "padrão único de cartões" mandam cartão. Segui o E193; se o Daniel preferir o toggle do mockup nesse passo, é decisão de desenho (e voltaria o terceiro estilo).
4. **Passo 8 (Preço)**: título e subtítulo iguais ("Quanto custa por mês?"); mockup tem Aluguel, Condomínio, Contas e Caução em linhas e o "Total por mês" num cartão verde-claro com o botão dentro; real tem Valor mensal, Condomínio, Despesas de consumo (escolha em cartão), "O que vai para o seu bolso" e o botão no rodapé fixo. Mais campos que o mockup (consumo e bolso), mantidos.
5. **Passo 9 (Disponibilidade)**: datas em campo de digitar com calendário do site e escolha em cartão; o mockup também desenha campos de data.
6. **Prévia do anúncio**: igual em posição (coluna à direita); no demo o cartão sai sem foto ("A foto principal aparece aqui") porque o rascunho de demonstração não tem fotos; com foto, mostra a capa.
7. **Índice dos passos** (1 a 10, com estado): existe no real, não no mockup (E602).

Nenhum defeito novo; nenhuma correção nesta passada. Varredura geral (imagem, elemento fixo, estouro lateral) nos 10 passos a 390 e 1280: sem rolagem lateral; o "N" no canto é o indicador do servidor de desenvolvimento, não da tela.

## Assistente × mockups, continuação (passos 1–5, 7 e 10) — passada 43 (06/11; modo demonstração, 1280 × 720 e 390)

Continua a passada 42 nos passos que ela não comparou. Telas reais a 1080 × 720 (a medida dos mockups) e 390, sonda de imagem/estouro/elemento fixo: sem rolagem lateral e sem imagem quebrada nos 10 passos (o "N" no canto é o indicador do servidor de desenvolvimento).
**E193 (#2956)**, retomado: os Passos 6, 8 e 9 hoje só têm cartão grande para escolher (Convivência, negociação, garantias, consumo, faixas, duração) e campo para digitar (valor, condomínio, datas, horários); nenhum interruptor, caixa, lista ou pílula. Os testes de unidade passam; os specs de laboratório (t620, t677, t680) rodam no CI `lab-critico`, não aqui.

Diferenças (mockup → real), todas dentro do padrão codificado:
1. **Passo 5 (Comodidades)**: o mockup é uma grade 2 × 4 de cartões com ícone; o real agrupa em "Pronto para trabalhar de casa" (essenciais e extras, com contador "0 de 4 itens essenciais") e traz o aviso "Campos com * são obrigatórios". Mesmos cartões com ícone e ✓; o agrupamento é o do E357/E416.
2. **Passo 10 (Revisão)**: o mockup tem "Lista de conferência" com ✓ verdes e, ao lado, o cartão do anúncio com preço e o botão "Publicar anúncio" dentro dele; o real tem "Antes de publicar" com a contagem do que falta, cada item com "Resolver", e o botão fica no rodapé fixo (liberado com a lista completa). No demo a lista sai incompleta (rascunho sem fotos/endereço), por isso os círculos vazios.
3. **Rótulos do progresso**: o mockup mostra "Passo X de 10" em pílula no topo; o real tem o índice dos 10 passos (E602) e o "Passo X de 10 · N% pronto" no rodapé.
4. **Tipografia e cor**: título grande em preto-tinta e subtítulo cinza, como o mockup; verde do botão e da seleção (`forest`) igual; cartão de escolha selecionado em verde-claro com borda verde e ✓ redondo, como o mockup.
Pendentes de desenho (já na matriz): `cadastro-imovel-07-descricao` (linha de "Destaques") e a pergunta sobre toggle × cartão no Passo 6 (passada 42, ponto 3). Nenhum defeito novo.

## Passada 44 (06/11; modo demonstração, 1080 × 720 e 390) — só o que mudou desde a 43

A `main` não teve tela nova depois da passada 43 (só a matriz); nada a repetir no E193 (#2956, rascunho) nem no E194 (já na `main`: #1532, #1660, t565).
`cadastro-imovel-07-descricao` reconferido contra o mockup: título "Título e descrição do anúncio", subtítulo, campos Título e Descrição e a prévia à direita **iguais**; o mockup ainda traz uma linha de "Destaques" (Mobiliado, Wifi incluído, Permitido pets) abaixo da descrição, que o real não tem. São pílulas — o oposto do padrão único de cartões do E193 — e uma função nova (destaques escolhidos à mão, além das comodidades e regras que o anúncio já mostra): **continua decisão do Daniel**, sem mudança.
E446 (páginas): o #2971 agora consome a fonte única da Pista B (#2970, `baseDaVitrine`); no demo a cidade diz "15 imóveis em Uberlândia" a 390 e 1280, igual à busca. Nenhum defeito novo.

## Passada 90 — /seguranca × mockup `publico-seguranca` (Pista A)

- **C10-1 — faixa "Avise a Viva" (corrigido neste PR):** o mockup mostra uma linha só: ícone de informação num círculo com contorno verde, a frase "Desconfie de quem pede pagamento fora da plataforma e avise a Viva." e o botão "Fale com a Viva" à direita, dentro de caixa com contorno verde. A página real usava outro arranjo; alinhada. Capturas em `docs/capturas/c10b/` (1280 e 390 px, sem rolagem horizontal).
- **C10-2 — três cartões de valor ausentes (aberto, decisão do coordenador):** o mockup traz "Identidade verificada…", "Contrato digital com registro e número único" e "O dinheiro vai direto entre as partes…". A página real não os tem. Não implementado: o texto dos cartões afirma garantias (identidade, registro) que dependem de decisão de conteúdo/produto.
