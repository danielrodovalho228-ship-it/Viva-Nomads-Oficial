# E801 (D5): a barra de rolagem não flutua sobre a linha das abas

## Sintoma (prova de 12/11, nas duas contas)

Em `/dashboard/conta/avaliacoes`, uma miniatura da barra de rolagem aparecia junto das abas "Recebidas/Feitas". Pelo E798, essa rota hoje redireciona para `/dashboard/avaliacoes?aba=recebidas`.

## Causa

A fileira das abas (`nav` em `src/components/avaliacoes/painel.tsx`) tinha `overflow-x-auto`, e cada aba tinha `-mb-px`, para o sublinhado cobrir a borda inferior. Esse pixel que sai para baixo faz o conteúdo passar da altura da fileira. Com `overflow-x` diferente de `visible`, o `overflow-y` também vira automático, então o navegador abre a rolagem vertical e desenha a barra sobre a linha das abas.

O mesmo padrão estava em `src/components/dashboard/favoritos-tabs.tsx`, de onde as abas de Avaliações foram copiadas no E782.

## Correção

`FILEIRA_ABAS`, em `src/components/ui/abas-fileira.ts`, é uma classe única para as duas fileiras:
- `overflow-x-auto overflow-y-hidden`: rola só na horizontal, e o `-mb-px` deixa de abrir rolagem vertical;
- `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`: a barra fica escondida, o mesmo que o `FileiraRolavel` já faz.

O visual das abas não muda (sublinhado, `border-b-2`), e o teste do E782 segue verde.

## Provas

### Unitário

`node --test src/components/ui/e801-abas-fileira.test.ts`. No escopo (avaliações, dashboard, estilo, favoritos): **73 pass / 0 fail**.

### E2E

`tests/e2e/specs/t1618-e801-abas-sem-barra.spec.ts` mede a fileira de abas em `/dashboard/avaliacoes?aba=recebidas` e em `/dashboard/favoritos`. Usa as contas da massa (DONO17 e INQUILINA), a 1280 e a 390 px, e verifica:
- a fileira não abre rolagem vertical: não pode haver excesso para baixo com `overflow-y` em `auto` ou `scroll`;
- a barra fica escondida (`scrollbar-width: none`);
- a aba "Feitas" continua clicável.

No Chromium headless a barra é sobreposta e não ocupa espaço, por isso medir a largura da barra daria sempre 0 px. A medida que pega o defeito é se a fileira rola na vertical.

### Resultado (lab, mesma build, só `src` trocado)

| Base | t1618 |
|---|---|
| main `27dbdf1` | **4 failed**: "/dashboard/avaliacoes?aba=recebidas: a fileira abre rolagem vertical (excesso 1px, overflow-y auto) — a barra flutua sobre as abas" (×4) |
| branch | **4 passed** (26.0s) |
