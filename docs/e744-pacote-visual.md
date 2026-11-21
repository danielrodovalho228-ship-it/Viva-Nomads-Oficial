# E744 — pacote visual: inventário, critério de julgamento e roteiro

Preparado em 16/11/2026, antes de o #3852 (`lab-diffs`) entrar na main. Serve para executar o pacote "na hora": quando a
primeira rodada do laboratório publicar o ramo `lab-diffs`, é só seguir a seção 5.

**Atualização de 16/11, 05:08Z:** o Gerente pediu o pacote por corridas locais, sem esperar o #3852. O julgamento
proposto, tela a tela, está em `docs/e744-pacote-visual-julgamento.md`; as pranchas, no ramo
`claude-b/e744-pacote-visual-pranchas`. O `lab-diffs` continua como rede.

**Regra que vale para tudo aqui:** referência visual só muda com o julgamento do Gerente registrado no PR, tela a
tela. Este documento não regrava nada.

## 1. O que cada teste cobra

Os três usam `toHaveScreenshot` do Playwright, a 390 e a 1280 px, com as referências versionadas em
`tests/e2e/visual/<spec>.spec.ts/`. Padrão da casa (`playwright.config.ts`): até 1% de pixels diferentes, animações
paradas, cursor escondido, escala CSS.

### t245 — regressão visual geral (40 referências: 20 telas × 2 larguras)

Só a área visível (sem página inteira). Mascarados: fotos, vídeo, mapa, datas, contagens, nomes e códigos.

| Nº | Tela | Quem | Tolerância | Observação |
|---|---|---|---|---|
| 01 | `/` (hero e busca) | visitante | 1% | |
| 02 | `/`, bloco dos cartões em destaque | visitante | 1% | compara só o bloco; pula se a base não tem destaques |
| 03 | `/buscar` | visitante | 1% | |
| 04 | `/buscar` com a folha de filtros aberta | visitante | 1% | o botão "aplicar" (contagem) vai mascarado |
| 05 | `/favoritos` vazio | visitante | 1% | |
| 06 | `/favoritos` com 2 imóveis | visitante | 1% | pula com menos de 2 anúncios no ar |
| 07 | `/cidades/uberlandia` | visitante | 1% | |
| 08 | página do imóvel (topo), `ube-001` | visitante | 1% | |
| 09 | "imóveis parecidos": só o 1º cartão | visitante | 1% | o texto do cartão é trocado por um texto fixo: compara a FORMA do cartão |
| 10 | `/como-funciona` | visitante | 1% | |
| 11 | `/precos` | visitante | 1% | só roda com a página de preços ligada (hoje suspensa: não roda) |
| 12 | `/para-proprietarios` | visitante | 1% | |
| 13 | `/auth` (entrar) | visitante | 1% | |
| 14 | `/dashboard` | inquilino | 2% | |
| 15 | `/dashboard/favoritos` | inquilino | 2% | |
| 16 | `/dashboard/buscas` | inquilino | 2% | |
| 17 | `/dashboard/conta` | inquilino | 2% | |
| 18 | `/dashboard` | proprietário | 2% | |
| 19 | `/dashboard/imoveis` | proprietário | 2% | |
| 20 | `/dashboard/conta/seguranca` | proprietário | 2% | |

### t263 — visuais do Prompt 41 (14 referências)

| Nº | Tela | Quem | Tolerância | Observação |
|---|---|---|---|---|
| 01 | página do imóvel INTEIRA (`ube-001`) | visitante | 2% | página inteira: qualquer bloco novo muda a altura e reprova por tamanho |
| 02 | barra de baixo do morador | inquilino | 1% | 390 no site; 1280 no app (a barra do site some no computador) |
| 03 | barra de baixo do proprietário | proprietário | 1% | idem |
| 04 | barra de baixo do parceiro | conta criada pelo teste | 1% | só no laboratório |
| 06 | folha "Ações desta estadia", morador antes das instruções de chegada | conta criada pelo teste | 1% | só no laboratório |
| 07 | a mesma folha, morador depois | conta criada pelo teste | 1% | só no laboratório |
| 08 | a mesma folha, proprietário | conta criada pelo teste | 1% | só no laboratório |

As telas 06–08 rodam em cadeia: se uma falha no preparo, as seguintes nem começam ("não rodou").

### t271 — visuais do admin (11 referências)

Só no laboratório, com a conta de admin. Tolerância de 3%. Mascarados: números, datas, nomes e as linhas das tabelas —
a imagem guarda a anatomia da tela (título, decisões, listas, filtros, cabeçalhos), não os dados.

| Largura | Telas |
|---|---|
| 1280 px | `/admin`, `/admin/financeiro`, `/admin/documentos`, `/admin/atendimento`, `/admin/parceiros`, `/admin/contratos`, `/admin/contratos/[id]`, `/admin/usuarios` |
| 390 px | `/admin`, `/admin/documentos`, `/admin/atendimento` |

## 2. Estado de hoje

Idade das referências: t245 e t271 são de **24/10**, t263 de **25/10** (três semanas). Nenhum dos três specs tem
registro de rodada verde.

| Spec | Noturna de 15/11 | Ensaio local de 16/11 (main `49efe073`, banco recém-semeado) |
|---|---|---|
| t245 | 37 falhas | 37 falhas, 1 passou (12 `/para-proprietarios` a 390 px) |
| t263 | 6 falhas, 7 não rodaram | 5 falhas, 4 passaram (barras do proprietário e do parceiro), 5 não rodaram |
| t271 | 11 falhas | 11 falhas |

O ensaio local serve para ver a ESTRUTURA das diferenças e para validar o roteiro; não substitui o `lab-diffs`. O
laboratório local tem outro Chromium e outras fontes que o do GitHub, então as porcentagens abaixo levam um ruído que a
rodada oficial não terá.

### O que as pranchas do ensaio mostram

As referências retratam o site de antes de redesenhos que foram decididos e entregues. Nas telas que abri:

- **Painel (14–20):** a referência ainda tem a **barra lateral verde**; hoje o painel usa abas no topo, sino e "Conta"
  (MENUS-5, MORADOR-NAV, PROP-6, E176). Por isso todas as telas logadas diferem de alto a baixo (de 17% a 34% dos pixels).
- **Topo público (01, 03–13):** a referência tem o menu antigo ("Buscar imóveis · Publicar pedido · Para proprietários ·
  Para empresas · Preços · Mais", com "Entrar para anunciar"); hoje é "Imóveis · Anunciar · Empresas · Parceiros" com
  "Fale com a Viva" e "Entrar". O botão flutuante também mudou de forma.
- **Tamanho diferente (6 telas):** os cartões (02, 09) e a página do imóvel inteira (t263-01, de 11.728 para 13.529 px
  de altura a 390 px) cresceram: blocos e linhas novos no cartão e na página.

Ou seja: a maior parte do pacote deve cair em "referência velha por decisão já tomada", não em defeito. O julgamento
ainda é tela a tela, porque uma mudança não intencional pode estar escondida atrás de uma mudança legítima.

### Medida por tela (ensaio local)

"Pixels diferentes" é a minha medida (diferença maior que 24 em algum canal de cor); "onde" é a faixa de linhas da
imagem em que há diferença. Quando o tamanho muda, o Playwright não gera imagem de diferença.

| Spec | Tela | Tamanho (esperado → obtido) | Pixels diferentes | Onde (linhas) |
|---|---|---|---|---|
| t245 | 02-home-cartoes-1280 | 1200×348 → 1160×380 **(mudou)** | — | — |
| t245 | 15-favoritos-painel-390 | 390×844 → 390×844 | 9.5% | 16–834 px de 844 |
| t245 | 13-entrar-390 | 390×844 → 390×844 | 18.0% | 150–693 px de 844 |
| t245 | 16-buscas-salvas-1280 | 1280×900 → 1280×900 | 23.3% | 0–899 px de 900 |
| t245 | 04-buscar-folha-390 | 390×844 → 390×844 | 40.5% | 59–843 px de 844 |
| t245 | 03-buscar-1280 | 1280×900 → 1280×900 | 11.3% | 52–899 px de 900 |
| t245 | 10-como-funciona-390 | 390×844 → 390×844 | 3.2% | 59–834 px de 844 |
| t245 | 03-buscar-390 | 390×844 → 390×844 | 45.9% | 59–843 px de 844 |
| t245 | 02-home-cartoes-390 | 350×589 → 350×709 **(mudou)** | — | — |
| t245 | 18-painel-proprietario-1280 | 1280×900 → 1280×900 | 34.0% | 0–899 px de 900 |
| t245 | 05-favoritos-vazio-1280 | 1280×900 → 1280×900 | 4.6% | 52–877 px de 900 |
| t245 | 19-imoveis-proprietario-390 | 390×844 → 390×844 | 39.3% | 16–834 px de 844 |
| t245 | 14-painel-inquilino-1280 | 1280×900 → 1280×900 | 27.1% | 0–899 px de 900 |
| t245 | 04-buscar-folha-1280 | 1280×900 → 1280×900 | 10.1% | 36–899 px de 900 |
| t245 | 20-seguranca-proprietario-1280 | 1280×900 → 1280×900 | 26.0% | 0–899 px de 900 |
| t245 | 15-favoritos-painel-1280 | 1280×900 → 1280×900 | 23.4% | 0–899 px de 900 |
| t245 | 05-favoritos-vazio-390 | 390×844 → 390×844 | 8.7% | 59–834 px de 844 |
| t245 | 19-imoveis-proprietario-1280 | 1280×900 → 1280×900 | 27.6% | 0–899 px de 900 |
| t245 | 06-favoritos-1280 | 1280×900 → 1280×900 | 11.4% | 52–894 px de 900 |
| t245 | 13-entrar-1280 | 1280×900 → 1280×900 | 6.2% | 222–692 px de 900 |
| t245 | 20-seguranca-proprietario-390 | 390×844 → 390×844 | 16.6% | 16–834 px de 844 |
| t245 | 07-cidade-uberlandia-1280 | 1280×900 → 1280×900 | 7.6% | 52–899 px de 900 |
| t245 | 09-imoveis-parecidos-1280 | 286×330 → 262×372 **(mudou)** | — | — |
| t245 | 08-imovel-1280 | 1280×900 → 1280×900 | 17.3% | 52–899 px de 900 |
| t245 | 07-cidade-uberlandia-390 | 390×844 → 390×844 | 10.2% | 59–644 px de 844 |
| t245 | 01-home-390 | 390×844 → 390×844 | 9.3% | 59–834 px de 844 |
| t245 | 12-para-proprietarios-1280 | 1280×900 → 1280×900 | 5.3% | 52–899 px de 900 |
| t245 | 16-buscas-salvas-390 | 390×844 → 390×844 | 15.1% | 16–834 px de 844 |
| t245 | 14-painel-inquilino-390 | 390×844 → 390×844 | 17.4% | 16–834 px de 844 |
| t245 | 10-como-funciona-1280 | 1280×900 → 1280×900 | 2.9% | 52–899 px de 900 |
| t245 | 17-conta-inquilino-390 | 390×844 → 390×844 | 16.9% | 16–834 px de 844 |
| t245 | 09-imoveis-parecidos-390 | 173×286 → 173×346 **(mudou)** | — | — |
| t245 | 17-conta-inquilino-1280 | 1280×900 → 1280×900 | 31.4% | 0–899 px de 900 |
| t245 | 06-favoritos-390 | 390×844 → 390×844 | 5.8% | 59–638 px de 844 |
| t245 | 08-imovel-390 | 390×844 → 390×844 | 10.0% | 59–834 px de 844 |
| t245 | 18-painel-proprietario-390 | 390×844 → 390×844 | 27.3% | 16–834 px de 844 |
| t245 | 01-home-1280 | 1280×900 → 1280×900 | 2.7% | 52–899 px de 900 |
| t263 | 02-barra-morador-1280-app | 1280×58 → 1280×58 | 4.3% | 10–48 px de 58 |
| t263 | 02-barra-morador-390 | 390×58 → 390×58 | 12.1% | 10–48 px de 58 |
| t263 | 01-imovel-inteiro-1280 | 1280×6926 → 1280×8299 **(mudou)** | — | — |
| t263 | 01-imovel-inteiro-390 | 390×11728 → 390×13529 **(mudou)** | — | — |
| t271 | t271-admin-atendimento-390 | 390×844 → 390×844 | 41.0% | 18–843 px de 844 |
| t271 | t271-admin-financeiro-1280 | 1280×900 → 1280×900 | 19.3% | 10–899 px de 900 |
| t271 | t271-admin-documentos-390 | 390×844 → 390×844 | 18.5% | 18–843 px de 844 |
| t271 | t271-admin-atendimento-1280 | 1280×900 → 1280×900 | 21.4% | 10–871 px de 900 |
| t271 | t271-admin-contratos-1280 | 1280×900 → 1280×900 | 21.5% | 10–871 px de 900 |
| t271 | t271-admin-documentos-1280 | 1280×900 → 1280×900 | 13.9% | 10–899 px de 900 |
| t271 | t271-admin-contrato-id-1280 | 1280×900 → 1280×900 | 16.2% | 10–899 px de 900 |
| t271 | t271-admin-usuarios-1280 | 1280×900 → 1280×900 | 25.7% | 10–887 px de 900 |
| t271 | t271-admin-parceiros-1280 | 1280×900 → 1280×900 | 19.1% | 10–899 px de 900 |
| t271 | t271-admin-1280 | 1280×900 → 1280×900 | 32.0% | 10–899 px de 900 |
| t271 | t271-admin-390 | 390×844 → 390×844 | 43.7% | 18–843 px de 844 |

## 3. Critério de julgamento

Para cada tela o pacote traz três imagens (esperado, obtido, diferença) e a minha leitura do que mudou. O Gerente
escolhe uma classe por tela:

| Classe | Quando | O que acontece |
|---|---|---|
| A. Mudança legítima | a diferença corresponde a uma decisão já tomada (cito o item) | a referência é regravada, com o julgamento registrado no PR |
| B. Mudança não intencional | ninguém decidiu aquilo | defeito real: vira item novo; a referência NÃO muda; corrige-se o produto |
| C. Ruído do teste | a diferença vem de dado que muda sozinho (contagem, data, nome) e não está mascarado | corrige-se a máscara do teste; a referência só é regravada se a tela também mudou por decisão |
| D. Mista | parte é legítima e parte não | a parte não intencional vira item novo; a referência só é regravada depois da correção |

Regras de leitura que vou seguir ao preparar cada tela:

1. Começo pelo que é comum a muitas telas (casca do painel, topo público, rodapé, flutuante): uma decisão explica várias.
2. Depois olho o que sobra **dentro do conteúdo** de cada tela — é ali que uma mudança não intencional se esconde.
3. Tela que mudou de tamanho: comparo bloco a bloco para dizer qual bloco entrou, saiu ou cresceu.
4. Sem decisão que eu consiga citar, a tela vai como "não sei explicar": o Gerente decide entre A e B.

## 4. O que ainda vai mexer nestas telas (PRs abertos na cadeia)

Regravar agora e mesclar estes PRs depois deixaria as referências velhas de novo:

| PR | Item | Telas que muda |
|---|---|---|
| #3880 | E900, pílula do modo | todas as do painel: t245 14–20 (cabeçalho a 1280; uma linha nova a 390) |
| #3882 | prompt 078, escada sem o Plano Gestor | t245 01, 10 e 12 (texto da taxa); 11 se a página de preços voltar |
| #3855 | E960, logo com área de toque | topo público (sem mudança visível esperada; conferir) |
| #3868 | E398, painel do `/auth` | t245 13 (a foto é mascarada; conferir o borrão) |
| #3889, #3891 | E976, link de salto | nenhuma (o link fica fora da tela sem foco) |

**Sugestão de ordem:** julgar o pacote com a primeira rodada do `lab-diffs`; regravar as referências numa rodada só,
depois de a cadeia entrar, para não regravar duas vezes.

## 5. Roteiro para a hora (quando o `lab-diffs` existir)

```bash
git fetch origin lab-diffs
```

```bash
git show FETCH_HEAD:README.md
```

```bash
git worktree add /caminho/da/pasta-do-lab-diffs FETCH_HEAD
```

Depois, o montador gera uma prancha por tela (esperado | obtido | diferença) e o índice com a medida:

```bash
node montar-pacote-visual.js /caminho/da/pasta-do-lab-diffs /caminho/de/saida
```

O montador foi validado no ensaio local: 52 pranchas e o índice da seção 2. Ele fica na área de rascunho da sessão;
entra no repositório, em `scripts/lab/`, junto com o pacote, se o Gerente quiser.

Com as pranchas, preencho por tela: o que mudou, a decisão que explica (ou "não sei explicar") e a classe proposta.
Entrego ao Gerente, spec por spec, com as pranchas.

## 6. Limites e pontos de atenção

- **Limite do `lab-diffs` (corrigido no #3852):** o publicador limitava a rodada a 60 imagens; com 54 telas × 3 a
  primeira rodada só traria as 20 primeiras do t245. O limite passou a 240.
- **`/precos` (t245 11):** está suspensa; a tela não roda e a referência dela não é conferida.
- **t263 06–08:** rodam em cadeia; enquanto a primeira falhar no preparo, as outras não geram imagem. Se continuarem
  sem rodar no laboratório do GitHub, o pacote delas fica para depois da correção do preparo.
- **t296:** a área da falha já foi nomeada (Início do proprietário, teste velho) e a correção está no #3886.
