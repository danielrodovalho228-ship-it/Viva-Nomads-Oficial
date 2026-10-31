# Matriz de conformidade — mockups aprovados × telas reais

Fonte dos mockups: branch `mockups` (`docs/mockups/<tela>-desktop.webp` e `-mobile.webp`). Padrão codificado que vale por cima do mockup: fundo clean (E166, sem bege), cartões uniformes, grade par, ícone por comodidade, um botão cheio por tela, vocabulário da casa. Decisões posteriores ao mockup (E-números) prevalecem.

Estados: **Conforme** · **Corrigido** (PR mesclado) · **Corrigido — PR aberto** · **Parcial** · **Decisão pendente** · **Congelado** · **A conferir**.

Criada pela Pista A em 31/10 (não havia matriz no repositório); atualizar linha a linha a cada passada.

| Tela (mockup) | Rota real | Estado | Prova / observação |
|---|---|---|---|
| `admin-agentes` | /admin/agentes | A conferir | Telas do admin — confirmar a pista responsável antes de conferir. |
| `admin-anuncios` | /admin/anuncios | A conferir | Telas do admin — confirmar a pista responsável antes de conferir. |
| `admin-atendimento` | /admin/atendimento | A conferir | Telas do admin — confirmar a pista responsável antes de conferir. |
| `admin-avaliadores` | /admin/avaliadores | A conferir | Telas do admin — confirmar a pista responsável antes de conferir. |
| `admin-destinos` | /admin/destinos | A conferir | Telas do admin — confirmar a pista responsável antes de conferir. |
| `admin-documentos` | /admin/documentos | A conferir | Telas do admin — confirmar a pista responsável antes de conferir. |
| `admin-manutencao` | /admin/manutencao | A conferir | Telas do admin — confirmar a pista responsável antes de conferir. |
| `admin-moderar` | /admin/moderar | A conferir | Telas do admin — confirmar a pista responsável antes de conferir. |
| `admin-pendencias` | /admin/pendencias | A conferir | Telas do admin — confirmar a pista responsável antes de conferir. |
| `admin-publicamos` | /admin/publicamos | A conferir | Telas do admin — confirmar a pista responsável antes de conferir. |
| `admin-servicos` | /admin/servicos | A conferir | Telas do admin — confirmar a pista responsável antes de conferir. |
| `admin-usuarios` | /admin/usuarios | A conferir | Telas do admin — confirmar a pista responsável antes de conferir. |
| `admin-visao-geral` | /admin/visao-geral | A conferir | Telas do admin — confirmar a pista responsável antes de conferir. |
| `ajuda-central` | /ajuda | Conforme | #1699 (vocabulário), E84; #1711 (FAQPage em português). |
| `ajuda-privacidade` | /privacidade | Congelado | Texto aprovado — não mexer até o parecer jurídico. |
| `ajuda-termos` | /termos | Congelado | Texto aprovado — não mexer até o parecer jurídico. |
| `busca-card` | /buscar | Conforme | #1698 (bairro não espremido pelo selo). |
| `cabecalho-agenda` | cabeçalho de /dashboard/agenda | A conferir |  |
| `cabecalho-ajuda` | cabeçalho de /dashboard/conta/ajuda | A conferir |  |
| `cabecalho-anuncios` | cabeçalho de /dashboard/imoveis | A conferir |  |
| `cabecalho-caucao` | cabeçalho de /dashboard/caucao | A conferir |  |
| `cabecalho-conferencia` | cabeçalho de /dashboard/conferencia | A conferir |  |
| `cabecalho-contratos` | cabeçalho de /dashboard/contratos | A conferir |  |
| `cabecalho-fechamento` | cabeçalho de /dashboard/fechamento | A conferir |  |
| `cabecalho-ferramentas` | cabeçalho de /dashboard/ferramentas | A conferir |  |
| `cabecalho-interessados` | cabeçalho de /dashboard/leads | A conferir |  |
| `cabecalho-orcamentos` | cabeçalho de /dashboard/orcamentos | A conferir |  |
| `cabecalho-pedidos` | cabeçalho de /dashboard/pedidos | A conferir |  |
| `cabecalho-recibos` | cabeçalho de /dashboard/recibos | A conferir |  |
| `cabecalho-roi` | cabeçalho de /dashboard/roi-imovel | A conferir |  |
| `cabecalho-simulador` | cabeçalho de /dashboard/simulador | A conferir |  |
| `cabecalho-tributacao` | cabeçalho de /dashboard/tributacao | A conferir |  |
| `cadastro-imovel-01-tipo` | /dashboard/imoveis/novo?etapa=tipo | Conforme | Segue E87 (9 tipos em carrossel). |
| `cadastro-imovel-02-fotos` | /dashboard/imoveis/novo?etapa=fotos | Conforme | Exige 8 fotos (MIN_FOTOS); vídeo e IA além do mockup. |
| `cadastro-imovel-03-endereco` | /dashboard/imoveis/novo?etapa=endereco | Conforme | Mapa do bairro aparece com o endereço preenchido. |
| `cadastro-imovel-04-detalhes` | /dashboard/imoveis/novo?etapa=detalhes | Decisão pendente | Mockup tem "Comodidades principais" (atalho para o Passo 5) e ícone por contador no celular — não implementados; esperar decisão. |
| `cadastro-imovel-05-comodidades` | /dashboard/imoveis/novo?etapa=comodidades | Corrigido | #1717 (ícone nos cartões do Pronto para trabalhar). |
| `cadastro-imovel-06-regras` | /dashboard/imoveis/novo?etapa=regras | Corrigido | #1716 (silêncio, visitas, festas e outras regras no passo). |
| `cadastro-imovel-07-descricao` | /dashboard/imoveis/novo?etapa=descricao | Conforme |  |
| `cadastro-imovel-08-preco` | /dashboard/imoveis/novo?etapa=preco | Conforme | Total do mês aparece com valor (calcularTudoIncluido). |
| `cadastro-imovel-09-disponibilidade` | /dashboard/imoveis/novo?etapa=disponibilidade | Conforme | Calendário aparece com o rascunho salvo. |
| `cadastro-imovel-10-revisao` | /dashboard/imoveis/novo?etapa=revisao | Corrigido | #1718 (motivo do Publicar inteiro). |
| `conta-seguranca` | /dashboard/conta/seguranca | Conferido sem achado | Varredura 31/10 (1280). |
| `conta-verificacao` | /dashboard/verificacao | A conferir |  |
| `imovel-cta` | /imoveis/[id] | Conforme, com observação | #1668/#1688. Observação para decisão: a 1280, logado, o flutuante "Fale com a Viva" fica à esquerda e passa sobre o texto da coluna ao rolar (regra do CSS para não cobrir o cartão de preço). |
| `menu-publico` | topo público (todas) | Conforme | MS-1/PUBLICO-A (#1550, #1637); guarda topo-publico-ms1.test.ts. |
| `morador-estadia` | /dashboard/estadia/[id] | A conferir |  |
| `morador-favoritos` | /dashboard/favoritos | A conferir |  |
| `morador-home` | /dashboard (morador) | A conferir |  |
| `morador-inicio` | /dashboard (morador) | Parcial | #1726 (títulos dos recomendados). Comparação completa com o mockup a fazer. |
| `morador-mensagens` | /dashboard/mensagens | A conferir |  |
| `morador-pedidos` | /dashboard/pedidos | A conferir |  |
| `morador-pedir` | /pedidos/novo | A conferir |  |
| `morador-servico` | /dashboard/servicos | Conferido sem achado | Serviços com foto por categoria, grade de 6. |
| `pagina-fale-com-a-viva` | /ajuda/fale-com-a-viva | A conferir |  |
| `painel-proprietario` | /dashboard (dono) | Parcial | #1724 (Meus anúncios uniformes). Comparação completa com o mockup a fazer. |
| `parceiro-cadastro` | /dashboard/parceiro | Parcial | #1733 (grade par das categorias). Comparação completa com o mockup a fazer. |
| `parceiro-ordens` | /dashboard/parceiro (ordens) | A conferir |  |
| `parceiro-painel` | /dashboard/parceiro (ativo) | A conferir |  |
| `perfil-01-topo-espelho` | /dashboard/conta/perfil | A conferir |  |
| `perfil-02-avaliacoes` | /dashboard/conta/avaliacoes | A conferir |  |
| `perfil-03-papeis-com-fotos` | /dashboard/conta (papéis) | A conferir |  |
| `perfil-03-papeis-intencao` | /dashboard/conta (papéis) | A conferir |  |
| `perfil-04-dados` | /dashboard/conta/dados | A conferir |  |
| `perfil-05-privacidade` | /dashboard/conta/privacidade | A conferir |  |
| `perfil-06-notificacoes` | /dashboard/notificacoes | Corrigido | #1734 (rótulo do cartão de número inteiro). |
| `perfil-07-pagamentos` | /dashboard/conta/pagamentos | A conferir |  |
| `perfil-08-ajuda-sair` | /dashboard/conta/ajuda | Conferido sem achado | Ajuda logada (1280); "Sair" uma vez (#1648). |
| `publico-como-funciona` | /como-funciona | Conforme | Varredura 31/10; #1669 (grades). |
| `publico-empresas` | /empresas | Conforme | Varredura 31/10; #1687 (FAQ em blocos). |
| `publico-home` | / | Conforme | Varredura 31/10 (390/1280): achados corrigidos em #1698 (bairro do cartão) e #1701 (canto do vídeo); celular #1725/#1731. |
| `publico-parceiros` | /parceiros | Conforme | Banner com foto e tipos de parceria (E276/E277). |
| `publico-precos` | /precos | Conforme | Banner com foto, regra única; conteúdo maior que o mockup (tabela, simulador, comparativo) por decisões posteriores. |
| `publico-proprietarios` | /para-proprietarios | Conforme | Banner com foto; conteúdo posterior ao mockup. |
| `publico-seguranca` | /seguranca | Corrigido — PR aberto | #1736: banner das institucionais. Os 3 cartões do mockup não entram (verificação do morador ainda "em breve"). |
| `qualificacao-01-perguntas` | /dashboard/imoveis/[id]/qualificar | A conferir |  |
| `qualificacao-02-resultado` | /dashboard/imoveis/[id]/qualificar | A conferir |  |
| `toggle-01-estados` | — | A conferir |  |
| `toggle-02-perfil` | — | A conferir |  |
| `toggle-03-imovel` | — | A conferir |  |
| `toggle-04-pedido` | — | A conferir |  |
