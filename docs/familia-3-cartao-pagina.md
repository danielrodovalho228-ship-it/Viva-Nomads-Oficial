# Família 3 — cartão e página: honestidade dos números (E920, E890, E923, E924, E925, E926)

Um PR, seis itens (o E926 entrou por aditamento). Lei da família: os números não se bifurcam, e o que a frase promete é verdade.
Medições feitas no laboratório local (Supabase local semeado, build de produção), em 14/11/2026. Os dados de produção foram lidos em 14/11/2026, 23h UTC, só com contagens.

## E920 — a página abre e fica no período de referência

**Sintoma (Gerente, em produção):** a página do imóvel abria com o total do período de referência do cartão e, ao assentar, mudava sozinha de período.

**Causa:** depois de carregar, a página lia `vn:ultima-busca` no aparelho e usava os meses da última busca no total (`property-detail.tsx`, `setMesesBusca`). Esse registro não tem validade e não é apagado quando a pessoa limpa o filtro de período da busca.

**Correção:** `mesesDoTotalDaPagina(selecao, minPeriodDays)` em `src/lib/imovel/selecao-estadia.ts`. O total usa o período que a pessoa escolheu nas datas (entrada e saída) ou, sem escolha, a estadia mínima do anúncio. A duração da última busca não entra mais na página. A data de entrada sugerida pela última busca (E816) continua, e sozinha não muda o total.

**Antes → depois** (mesma página, lida a cada 250 ms por 6 s; a 390 px o resultado é o mesmo):

| Anúncio | Guardado no aparelho | Antes | Depois |
|---|---|---|---|
| ube-001 | nada (aparelho novo) | "R$ 4.660 em 1 mês" | "R$ 4.660 em 1 mês" |
| ube-001 | última busca de 6 meses | "R$ 4.660 em 1 mês" → em 1,1 s "R$ 24.460 em 6 meses" | "R$ 4.660 em 1 mês" |
| ube-001 | última busca de 2 meses | "R$ 4.660 em 1 mês" → em 0,8 s "R$ 8.620 em 2 meses" | "R$ 4.660 em 1 mês" |
| ube-001 | última busca só com data | "R$ 4.660 em 1 mês" | "R$ 4.660 em 1 mês" |
| ube-003 | nada (aparelho novo) | "R$ 8.900 em 2 meses" | "R$ 8.900 em 2 meses" |
| ube-003 | última busca de 6 meses | "R$ 8.900 em 2 meses" → em 0,8 s "R$ 25.300 em 6 meses" | "R$ 8.900 em 2 meses" |
| ube-003 | última busca de 2 meses | "R$ 8.900 em 2 meses" | "R$ 8.900 em 2 meses" |

Ação explícita (anúncio real do laboratório, `t1632`): escolher 60 dias no calendário troca o total para o do período escolhido ("… em 60 dias"); "Limpar" volta ao total de referência.

## E890 — veredito: duplicado do E920

"O prazo exibido no total alterna entre carregamentos, sem o visitante escolher" é o mesmo mecanismo: o prazo dependia do que estava guardado no aparelho. Evidência:

- A tabela acima: a mesma página mostrava 1, 2 ou 6 meses conforme o registro `vn:ultima-busca`, sem nenhuma ação na página.
- O mapa do Phoenix (saltos de 1 para 2 meses em 12 de 15 imóveis) bate com uma busca de 2 meses guardada: os 3 exemplos que não saltam são os que pedem 60 dias de estadia mínima (ube-003, ube-008 e ube-013), em que 2 meses já é a referência.
- Não há outro caminho no código que mude o período: a seleção só muda por clique no calendário ou pelos campos de data.

A correção do E920 fecha os dois. O `t1632` tem um caso próprio para o E890: quatro carregamentos da mesma página, com quatro estados do aparelho, têm de dar o mesmo prazo.

## E923 — "tudo incluído" só com as contas dentro do total

**O caso existe nos dados?**

| Onde | Contas fixas sem estimativa |
|---|---|
| Anúncios de exemplo (15) | nenhum (14 com contas fixas e estimativa; ube-003 com consumo real) |
| Produção, ativos (12) | nenhum (os 12 têm contas fixas com estimativa) |
| Produção, rascunhos (39) | 36 |
| Produção, pausados (12) | 10 |
| Imóveis de teste do laboratório | todos (nascem com o padrão do banco: contas fixas, estimativa vazia) |

Em produção não há hoje nenhum anúncio com consumo real nem com estimativa negativa. Nenhum anúncio declara água, luz e gás em "Incluído no preço".

**O que a frase significava no caso:** o dono escolheu "Valor fixo estimado" e não informou o valor. O total do mês não tem nenhum valor de água, luz e gás, e o anúncio não diz quanto custam. "Tudo incluído" não era verdade. Nenhum anúncio ativo mostra isso hoje, mas qualquer um dos 46 mostraria ao ser publicado ou reativado.

**Correção:** `situacaoDasContas(p)` em `src/lib/precos.ts`, com três situações, lida pelo cartão, pela composição do mês e pela nota do total da página.

| Situação | Quando | Cartão | Composição do mês (página) |
|---|---|---|---|
| no total | contas fixas com estimativa maior que zero | "tudo incluído" | a soma já mostra "+ contas R$ X" |
| medidas | consumo real | "água, luz e gás à parte" | "… · água, luz e gás medidos à parte, fora do total" |
| não informadas | contas fixas com estimativa vazia, nula ou zero | "água, luz e gás não informados" | "… · água, luz e gás não informados, fora do total" |

**Antes → depois** (imóvel de teste do laboratório, valor mensal R$ 3.200, contas fixas sem estimativa): cartão "R$ 3.200 em 1 mês · tudo incluído" → "R$ 3.200 em 1 mês · água, luz e gás não informados". Informando R$ 250 de estimativa, o cartão passa a "R$ 3.450/mês" e "tudo incluído".

## E924 — selos do topo: levantamento por anúncio

Fileira de selos do topo da página (`selos-anuncio`), nos 15 exemplos:

| Anúncio | Nível | Preço justo | Aceita pets | Por quê |
|---|---|---|---|---|
| ube-001 | Essencial | sim | sim | único com valor do Airbnb declarado (R$ 4.200); total do mês R$ 3.960 ≤ R$ 4.200 |
| ube-002, 005, 008, 010, 013, 015 | Essencial | não | sim | sem valor do Airbnb declarado: sem o dado, não há selo |
| ube-003, 004, 006, 007, 009, 011, 012, 014 | Essencial | não | não | sem valor do Airbnb e sem pets |

"Perto de Hospital" não é selo: é destaque de proximidade (até 3 por anúncio), e só aparece em quem tem hospital entre as proximidades (ube-001, 002, 004 e 005).

**Conclusão:** entre as páginas, cada diferença é justificada pelo dado do anúncio. O que não tinha justificativa era o mesmo anúncio dar composição diferente no cartão e no topo da página: o cartão abre com a pílula do nível e o topo da página não tinha o nível. Sem os outros selos (ube-003, 004 e 014), o topo não tinha fileira nenhuma.

**Correção:** o topo da página recebe o resultado da mesma função do cartão (`selosDaFoto`). Composição e ordem: nível em pílula própria, com a palavra e a cor do nível; depois verificado, preço justo, pets e negociação. O nível do topo é o do bloco "Nível" da própria página.

**Antes → depois:** ube-001: "Preço justo · Aceita pets" → "Essencial · Preço justo · Aceita pets". ube-003: nenhuma fileira → "Essencial".

## E925 — as duas notas com rótulo

| Onde | Antes | Depois |
|---|---|---|
| Topo da página (ube-001) | "4,7 · 3 avaliações" | "4,7 · 3 avaliações do imóvel" |
| Bloco "Sobre o proprietário" (ube-001) | "4,7 · 11 avaliações" | "4,7 · 11 avaliações do proprietário" |

Os números e a fonte de cada nota não mudaram. O texto sai de `textoDaNota` (`src/lib/imovel/rotulo-avaliacoes.ts`).

## E926 — um nome só para o anúncio de exemplo

**Achado (Phoenix, RELATORIO-045, A-259):** o cartão dizia "Anúncio de exemplo" e a página do imóvel, "Exemplo ilustrativo". A varredura achou um terceiro nome, "Anúncio de demonstração".

**Termo único:** "Anúncio de exemplo", numa constante só (`SELO_EXEMPLO`, em `src/config/exemplo-proprietarios.ts`).

| Superfície | Antes | Depois |
|---|---|---|
| Cartão (busca, home, cidade, favoritos, painel) | "Anúncio de exemplo" | "Anúncio de exemplo" (sem mudança) |
| Página do imóvel, selo ao lado da nota | "Exemplo ilustrativo" | "Anúncio de exemplo" |
| Página do imóvel, faixa do proprietário | "Exemplo ilustrativo" | "Anúncio de exemplo" |
| Página do imóvel, seção Avaliações | "Exemplo ilustrativo" | "Anúncio de exemplo" |
| Página do imóvel, bloco "Sobre o proprietário" (selo) | "Exemplo ilustrativo" | "Anúncio de exemplo" |
| Bloco "Sobre o proprietário" e perfil de exemplo (aviso) | "Anúncio de demonstração: nos anúncios reais…" | "Anúncio de exemplo: nos anúncios reais…" |
| Perfil do proprietário de exemplo (faixa e avaliações) | "Exemplo ilustrativo" | "Anúncio de exemplo" |
| Perfil do proprietário de exemplo (título da aba) | "Helena M. (exemplo) — exemplo ilustrativo" | "Helena M. (exemplo) — proprietário de anúncio de exemplo" |
| Lista de imóveis do painel (linha do imóvel) | "Exemplo ilustrativo" | "Anúncio de exemplo" |
| Recusa de reserva em anúncio de exemplo (mensagem) | "Este é um anúncio de demonstração — …" | "Este é um anúncio de exemplo — …" |

Já usavam o termo e não mudaram: o aviso do cartão de preço ("Anúncio de exemplo: serve para você ver como a Viva funciona…"), a barra do celular, o calendário e o aviso de pets.

Ficaram como estão, porque não nomeiam o anúncio: "Vídeo ilustrativo." (nomeia o vídeo), "(exemplo)" depois do nome do proprietário e "Demonstração: este anúncio é de exemplo e a solicitação não é enviada." (o rótulo é da ação).

**Trava:** `src/lib/e926-termo-unico-exemplo.test.ts` proíbe "Exemplo ilustrativo" e "Anúncio de demonstração" em qualquer arquivo de produção (tela, mensagem ou comentário) e fixa o termo nas superfícies varridas. O `t1635` varre, a 390 e 1280 px, o cartão na busca e nos favoritos, a página do imóvel e o perfil do proprietário de exemplo.

## Testes novos

| Item | Unitário | E2E |
|---|---|---|
| E920 e E890 | `src/lib/imovel/e920-periodo-de-referencia.test.ts` | `t1632-e920-periodo-de-referencia.spec.ts` |
| E923 | `src/lib/e923-contas-fixas-sem-estimativa.test.ts` | `t1633-e923-contas-sem-estimativa.spec.ts` (só no laboratório) |
| E924 | `src/lib/e924-selos-do-topo.test.ts` | `t1634-e924-e925-topo-da-pagina.spec.ts` |
| E925 | `src/lib/e925-duas-notas-rotuladas.test.ts` | `t1634-e924-e925-topo-da-pagina.spec.ts` |
| E926 | `src/lib/e926-termo-unico-exemplo.test.ts` | `t1635-e926-anuncio-de-exemplo.spec.ts` |

O "se, e somente se" do E899 (`e899-cartao-enxuto.test.ts`) segue verde, sem alteração.

## Asserções alteradas

| Teste | Antes | Agora | Item |
|---|---|---|---|
| `t262` | com "meses: 3" guardado, a página mostrava "R$ Y em 3 meses" | mostra "R$ Y em 1 mês" (a referência do ube-001) | E920 |
| `t1603` | com "meses: 6" guardado, "R$ 24.460 em 6 meses" | com 1 ou 6 meses guardados, "R$ 4.660 em 1 mês" e a conta de 1 mês | E920 |
| `prompt-41.test.ts`, `selecao-estadia.test.ts` | `mesesDaSelecao(selecao) ?? mesesDoCartao(mesesBusca …)` na página | `mesesDoTotalDaPagina(selecao, property.minPeriodDays)` | E920 |
| `cartao-preco.test.ts` | `avisoCurtoDoTotal({ utilitiesMode: "fixed" })` = "tudo incluído" | sem estimativa: "água, luz e gás não informados"; com estimativa: "tudo incluído" | E923 |
| `t1624`, `t1300`, `t244` | o aviso do cartão era um de dois textos | um de três textos (entra "água, luz e gás não informados") | E923 |
| `e626-selos-cartao.test.ts` | `<SelosAnuncio tem={{…}}>` e `ROTULO_SIMBOLO[id]` | `<SelosAnuncio selos={selosDaFoto({…})}>` e `{s.rotulo}` | E924 |
| `t110`, `t88`, `t173`, `t710`, `t176` | o selo do exemplo dizia "Exemplo ilustrativo" | diz "Anúncio de exemplo" | E926 |
| `t176` | a nota do topo dizia "N avaliações" | diz "N avaliações do imóvel" | E925 |

## Dois specs que já falhavam na `main` e foram consertados

O E926 obrigou a tocar no `t176` e no `t88` (os dois fixavam "Exemplo ilustrativo"). Os dois já falhavam na `main`, por passos que não têm relação com esta família. Rodei cada um no build da `main` antes de mexer.

| Spec | Passo que falhava na `main` | Por quê | O que mudou no spec |
|---|---|---|---|
| `t176` | clicar em "Enviar mensagem" no bloco do proprietário do exemplo | o E694 tirou o botão do anúncio de exemplo; o bloco diz "aqui não há botão de mensagem" | o spec confere que o botão não existe e que o texto aparece |
| `t88` | o cartão lateral tinha de ficar abaixo das abas ao rolar (esperado ≥ 115, recebido −2869) | o E528 fez o cartão mais alto que a janela rolar com a página, sem prender | a medida vale só quando o cartão está preso; a regra do E528 segue guardada pelo `t843` |
