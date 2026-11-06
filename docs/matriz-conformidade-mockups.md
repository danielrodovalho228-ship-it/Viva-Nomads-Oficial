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
