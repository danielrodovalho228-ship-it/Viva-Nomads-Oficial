# E899 — cartão de imóvel enxuto (só o essencial; o detalhe fica na página)

**Decisão (Daniel, 13/11, uso real):** o cartão de imóvel tinha texto demais, cerca de 9 linhas. Ele passa a mostrar só o essencial; quem quiser o detalhe clica e vê na página. A composição do valor sai do cartão e fica na página do imóvel. Lei que não muda (E777): os números do cartão vêm da mesma fonte única da página.

## O que mudou

O cartão (`src/components/property-card.tsx`, o único, usado nas 13 superfícies) agora tem esta ordem fixa:

1. Foto com os selos e o coração (sem mudança).
2. Bairro e cidade + nota, na mesma fileira. O local tem no máximo 1 linha (antes, até 2).
3. Título em no máximo 1 linha (antes, até 2).
4. Selo "Anúncio de exemplo", quando for exemplo (sem mudança).
5. `R$ X/mês` em destaque.
6. `R$ Y em N meses · tudo incluído` (contas fixas) ou `R$ Y em N meses · água, luz e gás à parte` (contas medidas).
7. Especificações.
8. Disponibilidade.
9. "Visto" / "Você já contatou" (sem mudança).

Saíram do cartão: `cartao-total-rotulo` ("Total por mês, tudo incluído"), `cartao-mes-composicao` e `cartao-total-composicao`.

| Arquivo | Mudança |
|---|---|
| `src/lib/cartao-modelo.ts` (novo) | `modeloDoCartao(p, meses)`, função pura: `precoMes`, `totalEstadia`, `aviso`, `sintese`, `disponivel`. O cartão desenha só a partir dela. |
| `src/lib/precos.ts` | Os dois avisos curtos, definidos uma vez: `AVISO_TUDO_INCLUIDO`, `AVISO_CONTAS_A_PARTE` e `avisoCurtoDoTotal(p)`. |
| `src/lib/cartao-preco.ts` | Removida a `ROTULO_TOTAL_MES` duplicada. A de `precos.ts` ("Total por mês (com contas)") é a única. |
| `src/components/property-card.tsx` | Cartão enxuto. Nenhuma conta dentro do componente. |
| `src/components/property/price-card.tsx` | A página do imóvel ganha, perto do preço, a linha `cartao-lateral-mes-composicao` com `composicaoDoMes(property)`. A conta da estadia já vinha de `estadiaDoImovel` (`cartao-lateral-estadia-conta`) e não foi mexida. |

A página do imóvel mostrava a composição do mês com outra função (a lista "Quanto você paga por mês", de `calcularTotalMensal`). Pela regra do prompt, passou a mostrar também o texto de `composicaoDoMes`, a mesma função que o cartão usava. A lista ficou como estava.

## Medidas (antes → depois, altura do bloco de texto do cartão)

| Tela | Largura do cartão | Antes | Depois |
|---|---|---|---|
| Busca, 1280 px | 220 px | 385 px | 239 px |
| Busca, 390 px | 350 px | 271 px | 199 px |
| Home, 1280 px | 272 px | 199 px | 143 px |
| Home, 390 px | 169 px | 281 px | 183 px |

Prints em `docs/capturas/e899/` (`busca-…` e `home-…`, `-antes` e `-depois`, a 390 e 1280 px).

## Testes

- **T1, T2, T3 (unitários):** `src/lib/e899-cartao-enxuto.test.ts` (10 casos).
- **T4 (E2E):** `tests/e2e/specs/t1624-e899-cartao-enxuto.spec.ts`: home, `/buscar`, `/cidades/uberlandia`, `/dashboard/favoritos` (conta com 1 favorito) e a visão geral do painel, a 390 e 1280 px.
- **T5 (E2E):** `tests/e2e/specs/t1625-e899-cartao-igual-pagina.spec.ts`: ube-001 (contas fixas) e ube-003 (contas medidas), a 390 e 1280 px.

Como o T4 conta as "6 linhas": cada item do bloco de texto é uma linha (local, título, preço, total + aviso, especificações, disponível). O selo "Anúncio de exemplo" e o "Visto" ficam fora da conta. Local e título têm de ocupar exatamente 1 linha de texto (`line-clamp-1`). Ver "Dúvidas" no PR.

## Asserções alteradas (decisão E899, Daniel, 13/11)

| Teste | Antes | Agora |
|---|---|---|
| `t1603` (E756) | o cartão da busca mostrava `cartao-mes-composicao` e `cartao-total-composicao` | o cartão não tem as duas linhas; as composições são conferidas na página (`cartao-lateral-mes-composicao`, `cartao-lateral-estadia-conta`); cartão = página segue |
| `t1300` (E356) | `cartao-total-rotulo` = "Total por mês, tudo incluído" | `cartao-total-rotulo` não existe; `cartao-aviso` é um dos dois avisos curtos |
| `t244` (fundação visual) | título em até 2 linhas; total depois de "/mês · " na linha do preço | título em 1 linha; total em linha própria (`cartao-total-linha`), com o aviso |
| `t245` (visual) | teste 09 removia `cartao-total-estadia` do cartão normalizado | remove a linha inteira (`cartao-total-linha`); imagens de referência: ver "Dúvidas" |
| `t277` (preço com contexto) | lia "R$ X/mês · R$ Y em N meses" de `cartao-total-mes` | lê o preço de `cartao-total-mes` e o total de `cartao-total-estadia`; a comparação com a página segue igual |
| `c9-cartao-local-sem-corte.test.ts` | local com `line-clamp-2` | local com `line-clamp-1`; segue sem `truncate` |
| `estilo-padrao.test.ts` (2 casos) | título `line-clamp-2`; `{preco.valor}`; contas no componente; `cartao-total-rotulo` | título `line-clamp-1`; `{m.precoMes}`; contas em `cartao-modelo.ts`; aviso curto |
| `cartao-preco.test.ts` | `ROTULO_TOTAL_MES` de `cartao-preco.ts` = "Total por mês, tudo incluído" | a constante não existe mais ali; o aviso curto vem de `precos.ts` |
| `e756-composicao-unica.test.ts`, `e756-total-do-cartao.test.ts` | o cartão desenhava as duas composições e chamava `estadiaNoCartao` | as composições são desenhadas na página; o total chega ao cartão por `modeloDoCartao` |
| `cartao-sintese.test.ts`, `e626-selos-cartao.test.ts`, `busca-celular.test.ts`, `preco-paridade.test.ts` | `itensSintese`, o filtro do nível e `rotuloPreco` chamados dentro do componente | as mesmas chamadas, agora em `cartao-modelo.ts`; o componente chama `modeloDoCartao(property, periodMonths)` |

Nenhuma dessas asserções mudou de regra de cálculo. Todas mudaram porque a conta saiu do componente para a função pura, ou porque uma das três linhas saiu do cartão.
