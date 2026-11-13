# E844: "Para trabalhar de casa" nos exemplos sai da regra única

Foto da main: `27dbdf1`. Origem: Phoenix RELATORIO-016, A-04 e A-05 (12/11/2026).

## Defeito

Nos 15 anúncios de exemplo, `tagHomeOffice` estava escrito à mão em `src/lib/properties.ts`, sem relação com a "Estrutura de trabalho" que cada exemplo lista. Por isso, estruturas iguais davam resultados diferentes. O ube-004 (bancada + internet fibra 300) ficava fora, e o ube-007 (mesa + internet fibra 300) entrava. No total, 10 exemplos tinham o selo.

O anúncio real tira o selo de `qualification.tagHomeOffice`: cômodo de trabalho, mesa, cadeira e internet que aguenta trabalho. É o mesmo critério que o selo promete ao público (`SELOS.homeOffice.resumo`).

## Correção

`src/lib/exemplos/home-office-exemplo.ts` lê a estrutura de trabalho do exemplo:
- `workFeatures` "Escritório…" conta como cômodo; "Mesa…" ou "Bancada…", como mesa; "Cadeira…", como cadeira;
- a internet vem de `internetTier`.

Com isso, chama a mesma `tagHomeOffice`. `properties.ts` aplica o resultado aos 15 exemplos, e nenhum valor fica escrito à mão.

### Efeito

Pela regra, só o **ube-001** tem cômodo, mesa, cadeira e internet de trabalho. O filtro passa de 10 para **1**.
- Os outros 9 listam escritório **ou** mesa, sem os demais itens.
- ube-004 e ube-007 passam a ter o mesmo resultado: sem o selo.

O destaque "Espaço para trabalhar" da página não muda, porque sai da estrutura listada e não do selo.

## Testes

- **Unitário:** `node --test src/lib/exemplos/e844-home-office-exemplo.test.ts`.
  - main: 1 fail, com 9 exemplos cujo selo diverge da regra (ube-006, 007, 008, 009, 011–015).
  - branch: 3 pass.
- **Escopo** (exemplos, busca, níveis, anúncio, lib, config, estilo): **2777 pass / 0 fail**. tsc limpo.

## Asserção alterada

`src/lib/busca/facetas.test.ts`: na matriz do fixture, o chip "Para trabalhar de casa" passou de **10** para **1**.
