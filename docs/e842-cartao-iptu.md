# E842: o cartão não promete "tudo incluído"

Foto da main: `27dbdf1`. Origem: Phoenix RELATORIO-016, A-02 (12/11/2026).

## Defeito

O rótulo dos cartões de `/buscar` e dos carrosséis ("Imóveis parecidos") vem de `ROTULO_TOTAL_MES`, em `src/lib/cartao-preco.ts`, e dizia "Total por mês, tudo incluído". Duas coisas desmentem a frase:
- A página de todo anúncio diz "IPTU não incluso no total" (`price-card.tsx`), porque o IPTU não existe no cadastro.
- Nos anúncios com contas medidas, a linha logo abaixo (`composicaoDoMes`) dizia "água, luz e gás medidos à parte, fora do total". No ube-003, o mesmo cartão se contradizia.

## Correção

O rótulo passa a ser **"Total por mês · IPTU à parte"**. A conta do total não muda: aluguel + condomínio + consumo fixo, a mesma fonte do pino do mapa e da página. A composição embaixo continua dizendo o que entra e o que fica fora.

## Teste

`node --test src/lib/e842-cartao-sem-tudo-incluido.test.ts`:
- **main:** 2 fail, porque o rótulo traz "tudo incluído" e não fala do IPTU, e a frase com as contas medidas diz "tudo incluído" e "fora do total" ao mesmo tempo.
- **branch:** 3 pass.

Testes do escopo (preço do cartão, estadia, preços, estilo, componentes): **108 pass / 0 fail**. tsc limpo, consistência OK.

## Asserções alteradas

- `src/lib/cartao-preco.test.ts` (E356): o texto esperado passou de "Total por mês, tudo incluído" para "Total por mês · IPTU à parte".
- `tests/e2e/specs/t1300-e356-total-por-mes.spec.ts`: a mesma troca no texto de `cartao-total-rotulo`.
