# E744 — pacote visual por corridas locais: julgamento proposto

Pedido do Gerente (ronda de 16/11, 05:08Z): correr o t245, o t263 e o t271 no laboratório local, montar a evidência
dos diffs e propor o julgamento, para ele julgar. **Isto não substitui o `lab-diffs` do #3852** (fica como rede) **e não
regrava nenhuma referência.** Defeito de produto que aparecer aqui vira item pelo Gerente; eu não corrijo visual por fora.

O inventário (o que cada teste cobra) e as quatro classes de julgamento estão em `docs/e744-pacote-visual.md`:
**A** mudança legítima · **B** não intencional · **C** ruído do teste · **D** mista.

## 1. O que correu

Laboratório local, banco recém-semeado, produto da main `29b54ddd` (o build é o de `49efe073`; entre os dois a main só
mudou workflow, scripts do laboratório, documentos e o t337).

```
$ npx playwright test specs/t245 specs/t263 specs/t271 --project=chromium --workers=2 --retries=0 --reporter=list --trace off
corrida 1 (04:43Z):  53 failed · 5 did not run · 5 passed (5.9m)
corrida 2 (05:16Z):  53 failed · 5 did not run · 5 passed (6.0m)
```

- **Ruído entre as duas corridas:** das 52 telas com imagem, 45 saíram idênticas pixel a pixel. Seis diferem em até
  0,15% (uma linha de texto na busca e nos favoritos). `t271-admin-contrato-id-1280` difere em 0,75%: o título traz o
  número e o nome do contrato que o teste cria a cada corrida.
- **t263 06–08 (folha "Ações desta estadia"):** não rodavam, porque a primeira falha na contagem dos itens e as outras
  rodam em cadeia. Para obter as seis imagens, corri cada uma sozinha com a contagem ajustada **só nessas corridas**
  (4/4/5 em vez de 5/6/7); o spec não foi alterado em nenhum commit.
- **Limite:** o Chromium e as fontes do laboratório local não são os do GitHub. As porcentagens levam esse ruído; a
  estrutura das diferenças, não.

**Onde estão as pranchas** (uma por tela: esperado | obtido | diferença): ramo `claude-b/e744-pacote-visual-pranchas`,
pasta `pranchas/`, com o `indice.md` das medidas. O ramo é só evidência: não tem PR e não é para mesclar.

```bash
git fetch origin claude-b/e744-pacote-visual-pranchas
```

```bash
git show FETCH_HEAD:pranchas/indice.md
```

## 2. O que explica quase tudo

As referências são de 24–25/10. Estas mudanças aparecem em muitas telas e eu consigo citar a decisão:

| Mudança | Decisão | Telas |
|---|---|---|
| Painel: sai a barra lateral verde; entram abas no topo, sino e "Conta" | MENUS-5, MORADOR-NAV, PROP-6, E176 | t245 14–20 |
| Barra de baixo do morador: Início · Buscar · Pedidos · Mensagens · Estadia (a aba Estadia aparece sempre) | MORADOR-NAV, E176 (D1) | t245 14–17 a 390; t263 02 |
| Início do proprietário: aviso, "Próximo passo", "Peça na Viva", ferramentas | PROP-6 | t245 18 |
| Conta no computador: `/dashboard/conta` leva ao Perfil, com o menu da Conta à esquerda | E492, E552, E798 | t245 17 e 20 a 1280 |
| Folha da estadia sem "Falar com…" e sem "Ver instruções de chegada" | E539 (iv) | t263 06–08 |
| Admin: menu novo da equipe, "Voltar ao site" em toda largura, selo "Equipe" com iniciais | E784, E788 | t271, todas |
| Admin no celular: sem o botão "Menu da equipe"; aviso do backup uma vez, dentro de "Precisa da sua atenção" | E176 (D3) | t271 a 390 |
| Meus imóveis: a foto de massa do laboratório (quadro de cor única) não conta como foto; fica o ícone | E787 | t245 19 |
| O flutuante saiu da `/buscar` | E95, E931 | t245 03 e 04 |

Mudanças que vejo em muitas telas e **não sei citar a decisão** (o Gerente confirma contra a lista-master):

1. **Topo público:** "Imóveis · Anunciar · Empresas · Parceiros", com "Fale com a Viva" e "Entrar". Saíram "Preços",
   "Mais" e o coração.
2. **Flutuante "Fale com a Viva":** a 1280 px virou um círculo só com o ícone; a 390 px não aparece mais nas páginas
   públicas nem no painel.
3. **Barra de baixo do visitante a 390 px:** a mesma do morador (com "Pedidos"), e "Buscar" fica marcada em `/favoritos`.
4. **Cartão do imóvel:** bairro e cidade em linha inteira, "Novo na plataforma" embaixo e a linha nova "R$ 3.200 em 1 mês
   · água, luz e gás não informados".
5. **Rodapé:** texto novo da primeira coluna, links "Publicar pedido", "Fale com a Viva" e "Sobre a Viva", sem "Preços";
   "inquilinos" virou "moradores".
6. **Abas de filtro do admin:** a aba escolhida era um botão verde cheio; agora é contorno ("Fila", "Em revisão").

## 3. O que proponho NÃO regravar ainda (4 pontos)

| # | Tela | O que vi | Proposta |
|---|---|---|---|
| 1 | t245 `17-conta-inquilino-390` | A 390 px, `/dashboard/conta` abriu o **Perfil**, e não o menu da Conta. A sessão guardada do teste traz o cookie `vn-tela=larga` (gravado numa tela larga), e o proxy redireciona por ele. É o candidato que a triagem já citava: cookie da largura desatualizado. | **D.** Parte é produto (minha área, `proxy.ts`), ainda sem item: o Gerente decide se registra. Parte é teste: a sessão guardada não devia carregar esse cookie. Regravar agora fixaria a tela errada. |
| 2 | t245 `05-favoritos-vazio-1280` (e qualquer tela com o fim do rodapé à vista) | O flutuante cobre o fim da frase do rodapé: "…não é parte do contr". | **D.** É o E949, com a correção no #3861. Regravar depois de ele entrar. |
| 3 | t271, as 11 telas | Há números e textos da base fora das máscaras: os cartões de `/admin/contratos` (7 → 3 contratos, R$ 46.200 → R$ 22.000, 8,3% → 9,4%), "10 na fila agora" em documentos, "Usuários: 12 reais · 5 de teste", "Chamados abertos: 0 reais", o título e a data do contrato criado pelo teste, o período do financeiro. | **C + A.** A casca mudou por decisão (seção 2), mas regravar sem mascarar esses campos deixa o teste dependente da base de cada rodada. Proponho corrigir as máscaras no mesmo PR da regravação. |
| 4 | t263 06–08 | A contagem do teste (5/6/7 itens) é anterior ao E539 (iv); hoje são 4/4/5. | **A**, com o teste corrigido junto: a asserção passa a 4/4/5 citando o E539 (iv). Sem isso as seis telas continuam sem rodar. |

Outros campos fora das máscaras, que cabem na tolerância mas mudam sozinhos: "Disponível a partir de <data>" na página
do imóvel (t245 08, t263 01), a contagem "23 imóveis em Uberlândia" (t245 07) e o item "Enviar o primeiro pedido"
marcado ou não no Início do morador (t245 14). Classe **C**: mascarar na regravação.

## 4. Proposta tela a tela

"Medida" é a parte dos pixels que difere (diferença maior que 24 em algum canal). "Tamanho" quando a imagem mudou de
tamanho e o Playwright não gera diferença.

### t245 (37 telas falharam; `12-para-proprietarios-390` passou)

| Tela | Medida 390 / 1280 | O que mudou | Classe proposta |
|---|---|---|---|
| 01 home | 9,3% / 2,7% | topo público; hero 24 px mais alto a 390; barra de baixo; flutuante | A, se os pontos 1–3 da seção 2 forem confirmados |
| 02 home, cartões | tamanho / tamanho | cartão mais alto (ponto 4): 589 → 709 px a 390, 348 → 380 a 1280 | A, se o ponto 4 for confirmado |
| 03 buscar | 45,9% / 11,3% | filtros em várias linhas a 390 (antes uma fileira que rolava); sem a pílula "Nível"; link "Publicar pedido"; cartão novo; os anúncios da lista são outros | **não sei explicar** a quebra dos filtros e a saída do "Nível"; o resto A |
| 04 buscar, folha de filtros | 40,5% / 10,1% | a folha começa por "Quartos" e "Estadia" (antes "Preço por mês"); grupos em outra ordem | **não sei explicar** a ordem nova |
| 05 favoritos vazio | 8,7% / 4,6% | rodapé (ponto 5); flutuante; barra de baixo | D a 1280 (E949, seção 3); A a 390 |
| 06 favoritos com 2 | 5,8% / 11,4% | cartão novo; os dois imóveis favoritados são outros; rodapé | A + C (o texto do cartão não é mascarado) |
| 07 cidade | 10,2% / 7,6% | "29 imóveis + 15 de exemplo" virou "23 imóveis"; cartão novo | A para o cartão; **não sei citar** a saída do "+ 15 de exemplo"; C para a contagem |
| 08 imóvel (topo) | 10,0% / 17,3% | anúncio de exemplo: aviso novo e "Ver imóveis reais" no lugar de "Solicitar / Agendar visita"; preço com "R$ 4.660 em 1 mês"; sem a trilha "Início › Buscar…" a 1280; galeria mais larga | **não sei citar** os itens; parece conjunto de decisões sobre anúncio de exemplo e preço |
| 09 imóveis parecidos | tamanho / tamanho | cartão novo (ponto 4) | A, se o ponto 4 for confirmado |
| 10 como funciona | 3,2% / 2,9% | topo, flutuante, barra de baixo; o conteúdo à vista é o mesmo | A |
| 12 para proprietários (1280) | 5,3% | hero mais baixo; logo abaixo vem "Pedidos de moradia da sua cidade chegam até você" (antes, "Quanto você paga", com a comparação com Airbnb e QuintoAndar) | **não sei explicar**: não sei se a comparação saiu ou só desceu |
| 13 entrar | 18,0% / 6,2% | tela nova: "Entre ou crie sua conta", código por e-mail, "Entrar com senha" | A (entrada sem senha); o #3868 (E398) ainda mexe no painel da foto a 1280 |
| 14 painel do morador | 17,4% / 27,1% | casca nova; "Olá, Ana!"; bloco "Peça na Viva" | A + C (item "primeiro pedido") |
| 15 favoritos no painel | 9,5% / 23,4% | casca nova; abas "Buscar · Favoritos · Buscas salvas"; "← Voltar"; estado vazio sem ilustração | A para a casca; **não sei citar** a saída da ilustração |
| 16 buscas salvas | 15,1% / 23,3% | casca nova; mesmas abas; "← Voltar" | A |
| 17 conta do morador | 16,9% / 31,4% | a 1280, Perfil com o menu da Conta (E492); o título "Perfil" fica na coluna da direita, sobre a prévia | **D a 390** (seção 3, ponto 1); A a 1280, mas **não sei explicar** o título na coluna da direita |
| 18 painel do proprietário | 27,3% / 34,0% | Início novo do dono (PROP-6) | A |
| 19 meus imóveis | 39,3% / 27,6% | casca nova; foto vira ícone (E787); selo "Ativo" virou menu; bloco de preço com "Total por mês" e estadia mínima; botão "Desempenho" | A |
| 20 segurança | 16,6% / 26,0% | "Segurança e verificações" dentro da Conta; bloco novo "Sair de todos os aparelhos" | A |

O #3880 (E900, pílula do modo) ainda vai mudar o cabeçalho das telas 14–20; o #3882 (078) muda o texto da taxa nas
telas 01, 10 e 12. Regravar antes deles é regravar duas vezes.

### t263 (11 telas com diferença; as barras do proprietário e do parceiro passaram)

| Tela | Medida | O que mudou | Classe proposta |
|---|---|---|---|
| 01 imóvel inteiro, 390 e 1280 | tamanho: 11.728 → 13.529 px e 6.926 → 8.299 px | blocos novos ou maiores: aviso de anúncio de exemplo, detalhe do preço (caução do 1º bloco, limpezas), comodidades por categoria ("O imóvel e o que está incluso"), "Estrutura do condomínio", "Nível Essencial", "Padrão mínimo da Viva", manutenção dentro de "Bom saber", "O que tem por perto" em grupos com distância | A provável, mas **não sei citar item por item**. Página inteira: qualquer bloco novo reprova por tamanho. Sugiro o Gerente decidir se esta tela continua de página inteira. |
| 02 barra do morador, 390 e 1280 (app) | 12,1% / 4,3% | quinta aba "Estadia" | A (E176 D1) |
| 06 folha, morador antes | tamanho: 381 → 324 px | sem "Falar com o proprietário" | A (E539 iv), com o teste corrigido (seção 3, ponto 4) |
| 07 folha, morador depois | tamanho: 438 → 324 px | sem "Falar com…" e sem "Ver instruções de chegada" | A (E539 iv), idem |
| 08 folha, proprietário | tamanho: 495 → 381 px | sem "Falar com o morador" e sem "Ver instruções de chegada" | A (E539 iv), idem |

### t271 (11 telas)

Em todas: menu novo da equipe, "Voltar ao site", selo "Equipe" (seção 2) e os campos da base fora das máscaras (seção
3, ponto 3). Por tela, o que sobra no conteúdo:

| Tela | Medida | O que mudou no conteúdo | Classe proposta |
|---|---|---|---|
| `/admin` 1280 e 390 | 32,0% / 43,7% | "Visão geral" com "Precisa da sua atenção" e "Atividade recente" no lugar da lista "Agora"; a 390 sai o aviso vermelho do backup e os 4 cartões de número (E176 D3) | A |
| `/admin/financeiro` 1280 | 19,3% | mesmo conteúdo; o período e a data "o histórico começa em…" mudam com o dia | A + C |
| `/admin/documentos` 1280 e 390 | 13,9% / 18,5% | título "Documentos", abas "Fila de conferência · Emitidos", bloco "Matrículas — conferência do dono"; a fila da referência tinha 10 documentos, a de hoje está vazia | A + C |
| `/admin/atendimento` 1280 e 390 | 21,4% / 41,0% | linha "Chamados abertos: 0 reais"; fila vazia ("Nada pendente") onde a referência tinha linhas | A + C |
| `/admin/parceiros` 1280 | 19,1% | filtro "Todos · Fotógrafos · Outros"; sem o botão "Fotógrafos"; lista pendente vazia | A + C |
| `/admin/contratos` 1280 | 21,5% | linha "Estadias ativas: 3 reais · 2 de teste"; cartões com os números da base | A + C |
| `/admin/contratos/[id]` 1280 | 16,2% | nomes completos das partes; "Entrada: a definir · Saída: a definir" | A + C |
| `/admin/usuarios` 1280 | 25,7% | linha "Usuários: 12 reais · 5 de teste"; "Inquilinos" virou "Moradores"; coluna nova "Tipo da conta"; com ela a tabela (1.021 px) não cabe mais no quadro (862 px) e rola de lado dentro dele, a 1280 px | A + C; **não sei se a rolagem lateral a 1280 px foi decidida** (a página em si não vaza) |

## 5. Resumo para o julgamento

- **Nenhuma tela me pareceu defeito novo de produto fora do que já tem dono.** Os dois pontos de produto são o E949
  (#3861) e o cookie da largura (seção 3, ponto 1), que segue sem item.
- **15 pontos em que eu não sabia citar a decisão** (6 na seção 2 e 9 na seção 4): a passagem de citação está na
  seção 6. Sobraram 7 resíduos sem número de item.
- **Antes de regravar:** corrigir as máscaras do t271 e a contagem do t263 06–08, tirar o cookie `vn-tela` da sessão
  guardada (ou decidir o item do produto) e esperar o #3861, o #3880, o #3882 e o #3868.
- **Regravação:** proponho uma só, no ambiente do GitHub (as referências têm de sair do mesmo Chromium que as confere),
  depois de a cadeia entrar e com o julgamento registrado no PR.

## 6. Passagem de citação dos 15 pontos (ordem do Gerente, ronda de 06:55Z de 16/11)

Condição do julgamento: os 15 pontos que classifiquei como atualização de base **sem citar a decisão** não estão
aprovados como base. Abaixo, a decisão que achei para cada um, com o lugar do código onde ela está escrita. O que não
tem decisão que eu ache fica listado no fim, para virar defeito registrado se o Gerente assim decidir.

**Resultado:** 9 pontos com a decisão citada por inteiro; 6 pontos com uma parte ainda sem número de item (7 resíduos).

| # | Ponto | Decisão citada | Onde está escrita |
|---|---|---|---|
| 1 | Topo público: "Imóveis · Anunciar · Empresas · Parceiros", "Fale com a Viva" e "Entrar"; sem "Preços" e "Mais" | E176 (PUBLICO-A, mockups aprovados); E450 ("Anunciar"); E458 ("Parceiros"); E555 + E563 ("Planos" suspenso com a página de preços) | `src/lib/constants.ts:37-52`; `src/components/layout/navbar.tsx:42` |
| 2 | Flutuante: some a 390 px; círculo a 1280 px | A 390 px: E246. O círculo: rótulo **"C1b"** no código, **sem número E** (resíduo a) | `src/components/ajuda/viva-chat.tsx:164` e `:73` |
| 3 | Barra de baixo do visitante igual à do morador; "Buscar" acesa em `/favoritos` | Prompt 41, item 2 (a mesma barra nas páginas públicas); MENUS-5, MORADOR-NAV e E176 D1 (os cinco itens; Favoritos é subaba de Buscar) | `src/components/layout/mobile-tab-bar.tsx:19`; `src/config/abas-painel.ts:2-7` e `:67` |
| 4 | Cartão do imóvel: bairro e cidade em uma linha, selo embaixo, linha do total com o aviso | E899 (Daniel, 13/11: ordem fixa, 1 linha); E726 (posição única do selo); E356 + E899 + E923 (total "em 1 mês" e aviso curto) | `src/components/property-card.tsx:33`, `:75`, `:91`, `:111` |
| 5 | Rodapé: texto da 1ª coluna, links novos, sem "Preços", "moradores" | Texto: E826. Links: MS-1/PUBLICO-A, E851, E555 + E563. "Moradores": regra "B1" da varredura de 01/11, **sem número E** (resíduo b). A saída da linha "Assistente Viva 24 h…": **não achei** (resíduo c) | `src/config/textos-regulados.ts:54`; `src/components/layout/footer.tsx:33`, `:39`, `:43`; `src/lib/varredura-publicas-0111.test.ts:7` |
| 6 | Abas de filtro do admin: a escolhida é contorno, não verde cheio | E351 (c), Onda 5: "sem fundo colorido"; verde cheio só no botão principal | `src/lib/admin/abas.ts:1-8` |
| 7 | `/buscar`: filtros quebram linha a 390 px; sem a pílula "Nível" | Quebra de linha: E710 + E780 reaberto (print do Daniel, 14/11). "Nível": E452 (sem nível no resultado a pílula não aparece) — no laboratório nenhum anúncio da busca tem nível, então é também ruído da base | `src/components/busca/barra-pilulas.tsx:105-111`; `src/lib/busca/filtro-nivel.ts:27` |
| 8 | Folha de filtros começa por "Quartos" e "Estadia" | E105 (regra do E50): Preço, Tipo, Nível e a data têm pílula na linha e saíram da folha | `src/components/busca/painel-filtros-celular.tsx:46` |
| 9 | Cidade: "29 imóveis + 15 de exemplo" virou "23 imóveis" | E446: a mesma base da busca; com imóvel real os exemplos saem | `src/app/(public)/cidades/[cidade]/page.tsx:92` e `:126` |
| 10 | Página do imóvel (topo): aviso de exemplo, "Ver imóveis reais", total "em 1 mês", sem a trilha | E724, E713 e E694 (anúncio de exemplo); E207 (sem migalhas visíveis); E356 + E899 (total). A galeria mais larga a 1280 px: **não achei** (resíduo d) | `src/components/property/price-card.tsx:61`; `src/app/(public)/imoveis/[id]/property-detail.tsx:472`, `:882` |
| 11 | Para proprietários: no lugar de "Quanto você paga" vem "Pedidos de moradia da sua cidade…" | E718 (mockup publico-proprietarios; Daniel, 08/11): três blocos novos antes do comparativo. **O comparativo não saiu, só desceu** | `src/app/(public)/para-proprietarios/page.tsx:84` e `:136` |
| 12 | Favoritos do painel: estado vazio sem ilustração | Prompt 43, adendo de onboarding, item 4: "uma frase + o próximo passo como botão. Sem ilustração" | `src/lib/onboarding/vazios.ts:1-4` |
| 13 | Perfil a 1280 px: título na coluna da direita | Mockups perfil-01..08 (A1, CONTA-A): "como no desenho". **Sem número E** (resíduo e) | `src/components/account/casca-conta.tsx:25`, `:43`, `:129-133` |
| 14 | Página do imóvel inteira (t263 01): blocos novos | Comodidades por categoria: E191 + E661. Estrutura do condomínio: E225-A. Padrão mínimo: Prompt 59. Nível: adendo 59.1. Avaliações: Prompts 45 e 61. Manutenção dentro de "Bom saber" e "O que tem por perto" em grupos: **não achei** (resíduo f) | `src/components/property/amenities-grid.tsx:75`; `property-detail.tsx:123`; `src/components/conforto/padrao-minimo-imovel.tsx:10` |
| 15 | Admin › Usuários: coluna "Tipo da conta"; a tabela rola de lado a 1280 px | Coluna: E224. A rolagem lateral a 1280 px: **não achei** (resíduo g) | `src/app/(dashboard)/admin/usuarios/tipo-conta.tsx:10`; `usuarios/page.tsx:226` |

### Os 7 resíduos sem número de item

Pela condição do Gerente, o que não tiver decisão vira defeito registrado. Para cada um, o que consegui apurar:

| | Resíduo | O que sei |
|---|---|---|
| a | Flutuante em círculo em todo o site | Intencional no código (rótulo "C1b": o botão com texto cobria texto de `/termos`, `/empresas`, `/parceiros`). Falta só o número do item. |
| b | "Moradores" no lugar de "inquilinos" no rodapé | Intencional: há guarda de teste ("B1: fala 'morador', nunca 'inquilino'"). Falta só o número do item. |
| c | Saiu do rodapé a linha "Assistente Viva 24 h · resposta de uma pessoa em até 24 h" | Não achei decisão. A promessa continua no chat e na página Fale com a Viva. |
| d | Galeria do imóvel mais larga a 1280 px | Não achei decisão. Não vi nada quebrado na tela. |
| e | Título do Perfil na coluna da direita a 1280 px | Intencional no código ("como no desenho", mockups perfil-01..08). Falta só o número do item. |
| f | Manutenção dentro de "Bom saber"; "O que tem por perto" em grupos com distância | Não achei decisão. Não vi nada quebrado na tela. |
| g | Tabela de usuários do admin rola de lado a 1280 px | Não achei decisão. A tabela tem 1.021 px num quadro de 862 px; a página em si não vaza. É o que mais se parece com defeito. |

**Leitura minha:** a, b e e são intencionais e só pedem o número. c, d e f não mostram nada quebrado, mas não têm
decisão que eu ache. g é o candidato mais claro a defeito.

## 7. Julgamento do Gerente dos 7 resíduos (16/11/2026, ronda de 07:04 CST)

| | Resíduo | Julgamento |
|---|---|---|
| a | Flutuante só com ícone a 1280 px | **Base nova.** Fica a nota: a mudança devia ter trazido número de item. |
| b | "Moradores" no rodapé | **Base nova.** Vocabulário decidido. |
| c | Saiu do rodapé a linha "Assistente Viva 24 h · resposta de uma pessoa em até 24 h" | **Defeito registrado: E990.** Sumiu sem decisão; vai ao coordenador decidir restaurar ou remover. |
| d | Galeria do imóvel mais larga a 1280 px | **Base nova.** |
| e | Título "Perfil" na coluna da direita | **Base nova,** conforme os mockups perfil-01 a 08. |
| f | Manutenção em "Bom saber"; "O que tem por perto" em grupos com distância | **Base nova.** |
| g | Admin › Usuários com rolagem lateral a 1280 px | **Defeito registrado: E991** (estouro horizontal). Dono: Code 2, Família 8. A tela não entra nas bases novas até a correção. |

**As telas com defeito registrado ficam fora das atualizações de base** (estado em 16/11/2026, depois das rondas de
15:30Z a 20:25Z; a execução está no PR #3908):

| Item | Telas que ficam com a referência antiga | Por quê |
|---|---|---|
| E990 | t263 `01-imovel-inteiro` (390 e 1280 px); t245 `05-favoritos-vazio` (390 e 1280 px) | São as que mostram o fim do rodapé, onde a linha "Assistente Viva 24 h" sumiu. |
| E994 | t245 `05-favoritos-vazio` e `06-favoritos`, as duas a 1280 px | A linha "Suporte: e-mail" do rodapé quebra em duas no navegador do GitHub. Com a faixa do flutuante a coluna do rodapé ficou com 264 px, e a frase precisa de 261 a 265 px conforme o navegador. Registrado pelo Gerente na ronda de 20:25Z; dono: Code 2. |
| E949 | t245 `05-favoritos-vazio` a 1280 px | O flutuante cobre o fim da frase do rodapé (seção 3, ponto 2). |

São cinco telas. Nelas a referência antiga fica e o teste é **falha esperada**: continua a correr, é estrito (se a
imagem voltar a bater, acusa) e cita o item e a data do julgamento (condições do Gerente, ronda de 15:30Z). A
`05-favoritos-vazio` a 1280 px cita os três itens. A referência nova e a saída da marca vão no PR de cada correção.

**O que esta seção dizia antes e foi corrigido:**

- **As duas telas `06-favoritos` estavam listadas sob o E990. Estava errado.** A 390 px o rodapé nem aparece na imagem;
  a 1280 px a linha do E990 fica abaixo da borda. O Gerente tirou-as dessa lista (ronda de 18:15Z). A de 390 px ganhou
  referência nova (aprovação condicional, 20:05Z: só o cartão novo e os dados da base); a de 1280 px ficou com o E994.
- **E991 (Admin › Usuários a 1280 px): corrigido na main pelo #3922.** A tela ganhou referência nova, gravada sobre a
  base já corrigida, e passa sem marca (decisão do Gerente, 20:25Z).
- **"As 7 telas continuam reprovando":** já não reprovam. Cinco são falha esperada, como acima; as outras duas têm
  referência nova. O portão do #3908 fecha verde.

**Execução:** o PR #3908 traz 57 referências novas (37 gravadas no laboratório e 20 copiadas do navegador do GitHub,
pelo ramo de evidência do #3921), a contagem do t263 (4/4/5), as máscaras do t271 e as cinco marcas de falha esperada.
