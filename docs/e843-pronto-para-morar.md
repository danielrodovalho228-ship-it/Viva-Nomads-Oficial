# E843: "Pronto para Morar" — o filtro e a página contam igual

Foto da main: `27dbdf1`. Origem: Phoenix RELATORIO-016, A-03 e A-29 (12/11/2026).

## O que medi (laboratório, build da main)

- **Filtro:** os 15 exemplos têm `readyToLiveBadge: true`, então "Pronto para Morar · 15" está certo.
- **Página:** o selo aparece sobre a foto (galeria) nas 15. Já a lista de destaques, que é onde se lê o texto "Pronto para morar", só o trazia em 9.
  - Faltava em ube-001, 002, 004, 005, 008 e 009.
- **Causa:** `destaquesDoImovel` (`src/lib/anuncio/resumos-imovel.ts`) põe o "Pronto para morar" depois de saúde, educação, trabalho, internet e ar, e corta a lista em 3.

## Correção

Com o selo, o "Pronto para morar" tem lugar garantido, no último dos 3 destaques. Sem o selo, ele nunca aparece. O resto da ordem (E259) não muda.

## Testes

- **Unitário:** `node --test src/lib/anuncio/e843-pronto-destaque.test.ts`.
  - main: 1 fail, faltando os 6 anúncios acima.
  - branch: 2 pass.
- **Escopo** (anúncio, níveis, estilo, busca): **922 pass / 0 fail**. tsc limpo.
- **E2E:** `tests/e2e/specs/t1619-e843-pronto-na-pagina.spec.ts` percorre as 15 páginas a 1280 e a 390 px.

| Base | t1619 |
|---|---|
| main `27dbdf1` | **2 failed**: "páginas sem 'Pronto para morar' nos destaques: ube-001, ube-002, ube-004, ube-005, ube-008, ube-009" |
| branch | **2 passed** (6.0m) |

## Asserção alterada

`src/lib/anuncio/resumos-imovel.test.ts` ("máximo de 3 destaques"): com o selo, o 3º destaque passa a ser "Pronto para morar" e não mais "Espaço para trabalhar".

## Fora do escopo

- **Cartões de `/buscar`:** não mostram o selo. É o desenho aprovado no E626, com no máximo 2 pílulas (o nível e os símbolos), e "Pronto para Morar" não é uma delas. Mudar isso é decisão de desenho.
- **Home e `/cidades/uberlandia`:** dizem "prontos para morar". Hoje isso vale para os 15 exemplos, que têm todos o selo.
