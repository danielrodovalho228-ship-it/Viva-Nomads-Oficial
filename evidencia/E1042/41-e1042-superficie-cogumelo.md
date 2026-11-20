# E1042: a superfície exata (ORDEM-DUET-234/239, item c)
**É um defeito do teste, não do produto.**

## Onde
- **Rota:** `/dashboard/estadia/[contrato]`.
- **O que se fotografa:** a folha "Ações desta estadia", aberta pelo cogumelo (`getByTestId("cogumelo")`), com `getByRole("dialog", { name: "Ações desta estadia" })`.
- **Largura:** 390 px.
- **Imagens-base:** `tests/e2e/visual/t263-visual-41.spec.ts/06-estadia-cogumelo-morador-antes-390.png`, `07-…-depois-390.png` e `08-estadia-cogumelo-proprietario-390.png`.
- **Código:** `tests/e2e/specs/t263-visual-41.spec.ts`, linhas 213 a 236, com `await expect(folha).toHaveScreenshot(nome, { mask: mascaras(page) })`. A função `mascaras(page)` está nas linhas 40 a 52.

## O mecanismo
- `mascaras(page)` usa **locators da página inteira**, por exemplo `img, video, canvas, svg image`, `time`, `[data-testid="papel-ativo"] span:first-child` e `[data-visual="muda"]`.
- Numa captura **de elemento**, o Playwright pinta a máscara de todos os elementos que casam e que se sobrepõem à caixa da folha, **incluindo os que estão por trás da folha**, na página.
- A medida, em magenta, sobre a folha:
  - antes do #3880, a máscara ia de x 33 a 356 e de y 0 a 22 (morador) ou de y 0 a 10 (dono);
  - com o #3880, vai de y 0 a 66 (+44 px) ou de y 0 a 76 (+66 px).
- A máscara cresce exatamente a altura da linha da pílula, que empurra a página para baixo. Um elemento mascarado da página, por trás do topo da folha, passa a tapar o título "Ações desta estadia".

## A correção (só no teste)
- Na captura da folha, as máscaras devem ser procuradas **dentro da folha**: `mascaras(folha)`, ou uma lista própria de locators relativos a `folha`.
- Depois, as 3 imagens-base são refeitas na imagem do Playwright, com a atribuição ao #3880 e ao E1042.
- **O dono do t263 é a Fable** (disposição "teste-velho"). A Pista 3 pode escrever a correção, se o Gerente mandar.

## As provas neste pacote
- `antes-depois-06-…png`, `-07-…png` e `-08-…png`: à esquerda, a imagem-base da main (de 16/11); à direita, a refeita com o #3880 (corridas 44684341883 e 44694789633, iguais nestas 3).
- A máscara magenta cobre x 33–356 nas duas, e desce de y 0–22 para y 0–66 (morador) e de y 0–10 para y 0–76 (dono). O título "Ações desta estadia" fica tapado.
