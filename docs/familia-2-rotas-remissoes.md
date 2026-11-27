# Família 2 — Rotas e remissões (14/11/2026)

**Itens:**
- **E889** 🔴
- **E836**
- **E851** 🟡
- **E874** 🟡: veio do #3799, draft que este PR supera.
- **E885** 🟡: veio do #3808, draft que este PR supera.
- **E916** 🟢
- **E921** 🟡
- **E922** 🟡

## Rota / remissão → antes → depois

| Rota ou remissão | Antes | Depois |
|---|---|---|
| `/imoveis-perto-de/<destino>` (E889) | página VAZIA ("Ainda não há imóvel…"): descartava todo anúncio de exemplo, enquanto a região (polo) mostrava 15 | lê a MESMA base da região e da busca (`baseDoPertoDe`, em `src/lib/perto-de.ts`). São exemplos enquanto não há imóvel real; quando houver real, só os reais. |
| Guia "Como precificar…", "A tabela completa está em /precos" (E836) | remissão a página suspensa | a frase traz a escada de taxas da fonte única (`FRASE_ESCADA_TAXAS`) |
| Prompt da Viva: "Comparação em /precos" e "/precos (planos)" na lista de páginas (E836) | a assistente podia mandar o usuário para a página suspensa | saem; entra `/sobre` |
| Cenário de teste da Viva n.º 12: "detalhes em /precos" (E836) | remissão morta | aponta para "Quanto custa anunciar?", na Central de Ajuda |
| `/sobre` (E851) | 404 | página institucional, só com fatos já públicos e pelas fontes oficiais: `PROMESSA_ESTADIA`, `SITUACAO_VIVA.fase`, `CONTATO_NUNCA_TROCADO`, Fale com a Viva e o e-mail de suporte |
| `/contato` (E851) | 308 → `/ajuda` (Central genérica) | 308 → `/ajuda/fale-com-a-viva` (o contato vigente) |
| Rodapé (E851) | sem "Sobre" nem contato direto | "Fale com a Viva" e "Sobre a Viva" |
| `/cidades` e a 2ª cidade (E874) | sem índice; cidade sem operação dava 404 | `/cidades` é o índice (lista + contagem); a cidade sem operação tem página própria (noindex), sem 404 a meio do caminho |
| `/entrar` (E885) | 404 | 308 → `/auth`, com a query |
| Página 404 (E916) | sem rodapé e sem campo de busca | rodapé padrão, campo "Cidade ou bairro" → `/buscar?local=…`, link para a Central de Ajuda |
| Guia "Como escolher o bairro", atalhos "Perto do HC-UFU" e "Perto do Umuarama" (E921) | TEXTO não clicável que dizia "já filtram os imóveis por proximidade", mas o destino só reordena (15/15) | o texto diz o que cada caminho faz (o bairro filtra; o destino põe em ordem de tempo; com "até N min", filtra). Os atalhos viram links: "Perto do HC-UFU/Umuarama" (o atalho da home, `/buscar?local=Umuarama`) e o guia da região. |
| Pílula Local da busca com destino (E921) | "Perto de HC-UFU" (soa a filtro, mas só ordenava) | "Por tempo até HC-UFU" (ordena); com tempo máximo, "Até 20 min de HC-UFU" (filtra) |
| `/ajuda/para-empresas` (E922) | 404 | 308 → `/empresas` |

## Escolhas (E889, E921 e E922)
- **E889:** listar os imóveis que a página promete, pela mesma base da região e da busca. É o desenho que a página do polo e a cidade já seguem (E446). Nenhuma alternativa precisou ser implementada.
- **E921:** **rotular, não filtrar.** O destino sozinho não tem raio definido. Filtrar exigiria inventar um raio ou um tempo, e a busca já tem o filtro honesto "até N min". O rótulo passa a dizer exatamente o que acontece, e todo atalho visível vira link.
- **E922:** **redirecionar**, não criar tema. A Ajuda tem quatro temas (morador, proprietários, contratos, segurança), e o conteúdo de empresas, com o "Fale com a gente", vive em `/empresas`. Nenhuma remissão interna apontava para `/ajuda/para-empresas`.

## Testes (trava por item)
**Em `src/lib/rotas-remissoes/`:**
- `e889-perto-de-lista`
- `e836-sem-precos-no-conteudo`
- `e851-sobre-contato`
- `e916-404-rodape-busca`
- `e921-atalhos-proximidade`
- `e922-ajuda-para-empresas`
- `familia2-remissoes-vivas`: a varredura. Lê guias, FAQ, textos de parceiros e o prompt da Viva, e exige que todo caminho citado seja uma rota viva. As rotas vivas saem do próprio `src/app`, menos as suspensas `/precos` e `/planos`.

**Vindos dos PRs anteriores:**
- E874: `src/lib/e874-indice-cidades.test.ts`
- E885: `src/config/e885-entrar-redirect.test.ts`

**E2E:**
- `tests/e2e/specs/t1629-familia2-rotas-vivas.spec.ts`, a 390 px: cada rota corrigida tem destino vivo; a 404 tem busca e rodapé; os atalhos do guia respondem; a lista por tempo mostra imóveis quando a região tem.
- `t1631-e874-indice-cidades`

## Nota do Gerente (Família 1)
`PROMESSA_ATENDIMENTO` passa a ser montada inteira a partir das constantes, `ASSISTENTE_HORAS` e `PROMESSA_HUMANA_H`. O texto exibido é o mesmo.
