# E800 (D3): a pílula da prévia não encosta nas bordas e o relógio não cobre o texto

## Sintoma (prova de 12/11, nas duas contas)

Na prévia do perfil, a pílula verde ("É assim que o morador te vê no seu anúncio" ou "É assim que o proprietário te vê quando você pede para morar") quebrava em duas linhas, com o texto encostando nas bordas arredondadas. Além disso, o ícone de relógio cobria levemente o começo de "Responde X% das conversas…".

## Causas

- **Pílula:** era `rounded-full` com `px-3`. Em duas linhas, o raio "total" faz os cantos entrarem na área do texto.
- **Relógio:** a linha `espelho-resposta` é um `flex` com o ícone **sem `shrink-0`**. Quando o texto quebra, o flex encolhe o SVG, que é desenhado por cima do começo do texto.

## Correção

`src/components/account/espelho-classes.ts` reúne as classes únicas das duas prévias: a do dono (`espelho-papel.tsx`) e a do morador (`espelho-perfil.tsx`).
- **Pílula:**
  - `px-4` e `rounded-xl`, um raio de 12 px, que está dentro do padrão de estilo (8, 12 ou full);
  - `items-start`, com o texto em `leading-5`.
- **Ícones** (o olho da pílula e o relógio): ficam numa caixa com a altura de uma linha (`h-5`, igual ao `leading-5`) e têm `shrink-0`. Assim, alinham com a primeira linha e nunca encolhem.

O texto de "Responde…" continua sendo uma única string (E504).

## Provas

### Unitário

`node --test src/components/account/e800-pilula-previa.test.ts`: **3 pass**. No escopo (estilo, conta, perfil, E101): **204 pass / 0 fail**.

### E2E

`tests/e2e/specs/t1617-e800-pilula-previa.spec.ts` mede a geometria na tela a 1280 e a 390 px. Ele roda em três contas:
- DONO17 e INQUILINA, da massa;
- um **dono próprio com 3 conversas respondidas**, porque a massa não tem nenhum dono com a linha "Responde X%…" (DONO17: 0 conversas).

As regras medidas:
- **Pílula:**
  - se o título quebrou, o raio dos cantos tem de ser de no máximo 12 px;
  - o texto tem de ficar a pelo menos 12 px de cada borda.
- **Relógio:**
  - mantém pelo menos 15 px de largura (não encolhe);
  - não se sobrepõe a nenhuma linha do texto de "Responde…".

| | main `27dbdf1` | branch |
|---|---|---|
| t1617 (6 casos: 3 contas × 1280/390) | **6 failed**. Em todos, "pílula quebrada em 2 linhas com raio 33554400px" (`rounded-full`). Nos 2 casos do dono com conversas, também "o relógio encolheu" | **6 passed** |

Na main, a sobreposição medida pelo retângulo do texto não disparou. O defeito pego no relógio foi o encolhimento do ícone (largura abaixo de 15 px), que é a causa do efeito visto na prova.
