# E811 — selos iguais no cartão e na página, com critério visível

**Achado** (RELATORIO-011):
- **Selos a mais na página:** a página do anúncio acrescentava "Pronto para Morar" (sobre a foto), "Para trabalhar de
  casa" e "Bem localizado p/ trabalho", que o cartão da busca não mostra (ube-001 e ube-002).
- **Critério:** nenhum selo tinha critério visível.
- **Pets no ube-003:** dizia "Aceita pets" na lista "Tem", sem o selo e sem a linha "Animais" nas regras.

**O que os drafts já cobrem (não refeito aqui):**
- #3762 (E843): o texto "Pronto para morar" garantido nos destaques da página.
- #3763 (E844): o selo "Para trabalhar de casa" dos exemplos sai da regra única.

**Desenho aprovado (E626).** O cartão mostra a pílula do nível e a pílula de símbolos (verificado, preço justo, pets,
negociação). A página mostra os mesmos símbolos por extenso.

**Correção (só o restante).**
1. **Fonte única:** `simbolosDoImovel` (`src/lib/cartao-selos-foto.ts`), chamada pelo cartão (`property-card.tsx`) e pela
   página (`<SelosAnuncio tem={simbolosDoImovel(property)} />`). Exemplo nunca leva "verificado".
2. **Critério visível:** `CRITERIO_SIMBOLO`, desenhado na página logo abaixo dos selos (`data-testid="selos-criterios"`).
3. **Sem selos a mais na página:**
   - Sai o "Pronto para Morar" sobre a foto da galeria (`readyToLive={false}`); o texto segue nos destaques (#3762).
   - Saem os chips "Para trabalhar de casa" e "Bem localizado p/ trabalho" (`PropertyTags`). O espaço de trabalho e os
     arredores seguem nas seções próprias da página, e os filtros da busca não mudam.
4. **Pets inequívoco:** o ube-003 ganha `petsAllowed: true`, porque já dizia "Aceita pets" na lista "Tem". Com isso
   aparecem o selo, o critério e a linha "Animais" das regras. A faceta "Aceita pets" da busca passa de 7 para 8.

**Testes.**
- `src/lib/e811-selos-iguais.test.ts` (5): falha na main (o export não existe) e passa na branch.
- `tests/e2e/specs/t1623-e811-selos-iguais.spec.ts`: no lab, com o build da branch, ube-001/002/003 têm a mesma lista
  de selos no cartão e na página, os critérios visíveis, nada de "Pronto para Morar" nem "Bem localizado" como selo, e
  o ube-003 com selo + critério + "Animais: Aceita pets". Rodado com o t920 e o t7: 10 passed.

**Asserções alteradas:**
- Leem a fonte única em vez do objeto inline: `property-card.pets.test.ts`, `busca/e439-aceita-negociacao.test.ts`,
  `busca/e580-filtro-preco-justo-visivel.test.ts` e `e626-selos-cartao.test.ts`.
- `busca/facetas.test.ts`: "Aceita pets" passa de 7 para 8 (ube-003).
