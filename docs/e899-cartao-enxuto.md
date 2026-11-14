# E899 — cartão de imóvel enxuto (só o essencial; o detalhe fica na página)

**Decisão (Daniel, 13/11):** o cartão tinha ~9 linhas. Fica só o essencial e a composição do valor mora na página do imóvel. Lei E777: os números do cartão vêm da mesma fonte única da página.

## O que mudou
- `src/lib/cartao-modelo.ts` (novo): `modeloDoCartao(p, meses)`, uma função pura com os campos abaixo.
  - `precoMes`: `calcularTudoIncluido(p).total` formatado.
  - `totalEstadia`: o resultado de `estadiaNoCartao`, que usa `estadiaDoImovel(p, N)`.
  - `aviso`: o aviso curto.
  - `sintese`: `itensSintese` sem o nível.
  - `disponivel`.
- `src/lib/precos.ts`: os dois avisos curtos, definidos uma vez (`AVISO_CARTAO_TUDO_INCLUIDO`, `AVISO_CARTAO_CONTAS_A_PARTE`) e `avisoDoCartao` ("tudo incluído" só com `utilitiesMode === "fixed"`).
- `src/components/property-card.tsx`: o componente é o único, nos 13 lugares, e desenha só do modelo.
  - **Ordem:** foto (selos, coração), local + nota (1 linha), título (1 linha), [Anúncio de exemplo], `R$ X/mês`, `R$ Y em N meses · aviso`, especificações, disponível, Visto.
  - **Saíram do cartão:** `cartao-total-rotulo`, `cartao-mes-composicao` e `cartao-total-composicao`.
  - **Nada clicável a mais:** não entrou nenhum "Detalhes do valor" dentro do cartão, que é um link.
- `src/lib/cartao-preco.ts`: sai `ROTULO_TOTAL_MES` ("Total por mês, tudo incluído"). O de `precos.ts` ("Total por mês (com contas)") fica como o único.
- Página do imóvel (`src/components/property/price-card.tsx`): ela já mostrava a conta da estadia por `estadiaDoImovel(property, N).conta`, a mesma função do cartão. A composição do mês aparecia como lista (`calcularTotalMensal`), não por `composicaoDoMes`. Por isso entrou a linha `composicaoDoMes(property)` (`cartao-lateral-mes-composicao`) logo abaixo do preço, com o aviso das contas medidas.

## Prints
- Antes: as linhas de base do t245 em `tests/e2e/visual/t245-visual-regressao.spec.ts/` (02-home-cartoes, 03-buscar), a 390 e 1280.
- Depois (lab local, t1624): `docs/e899/depois-{home,buscar}-{390,1280}.png`.

## Testes
- Unitário `src/lib/e899-cartao-enxuto.test.ts` (T1, T2, T3 e a página):
  - Na main o arquivo não carrega (`cartao-modelo.ts` não existe): `# pass 0 / # fail 1`.
  - Na branch: `# pass 7 / # fail 0`.
- E2E `tests/e2e/specs/t1624-e899-cartao-enxuto.spec.ts` (T4 em 5 superfícies × 390/1280; T5 cartão = página):
  - Na branch: 5 passed.
  - Na main: o T4 falha (`cartao-mes-composicao`: 4 encontrados, esperado 0) e o T5 falha (não há `cartao-aviso`).
