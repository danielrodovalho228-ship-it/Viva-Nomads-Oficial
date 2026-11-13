# E871: pets com uma fonte só (a flag do anúncio)

Foto da main: `27dbdf1`. Origem: Phoenix RELATORIO-020, A-94 (12/11/2026). Família do E776 (fonte única).

## Defeito

- O filtro "Aceita pets" lê a flag `petsAllowed`. A linha "Aceita pets / Não aceita pets" das regras da casa (`linhaPetsPublica`) também lê a flag.
- O ube-003 **não tinha a flag**, e "indefinido" conta como não. Mesmo assim, tinha "Aceita pets" escrito solto na lista de comodidades. Resultado: a página mostrava "Aceita pets" em "Tem", mas o anúncio ficava fora do filtro.
- O ube-002 tinha o mesmo rótulo duplicado na lista, mas com a flag `true`. Era duplicação sem divergência.
- "Aceita pets" não existe no catálogo de comodidades (`src/lib/amenities.ts`). Só os exemplos carregavam o rótulo solto.

## Correção (só dados dos exemplos)

- **ube-003:** passa a ter `petsAllowed: true`, que é o que a página dele dizia, e o rótulo sai da lista de comodidades.
- **ube-002:** o rótulo sai da lista. A flag já era `true`.
- O filtro "Aceita pets" passa de 7 para **8** exemplos.

## Teste

- **Unitário:** `node --test src/lib/e871-pets-fonte-unica.test.ts`, que funciona como guarda: nenhum exemplo com pet na lista de comodidades, todo exemplo com a flag definida, e ube-003 com a flag.
  - main: 3 fail.
  - branch: 3 pass.
- **Escopo** (busca, anúncio, níveis, lib, config, estilo): **2777 pass / 0 fail**. tsc limpo.

## Asserção alterada

`src/lib/busca/facetas.test.ts`: o fixture de "Aceita pets" passou de **7** para **8**, na matriz e na asserção do E42/E6.
