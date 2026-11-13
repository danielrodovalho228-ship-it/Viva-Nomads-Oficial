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
- a barra horizontal ocupa 0 px e a barra vertical ocupa 0 px;
- nada vaza para baixo (`scrollHeight` ≤ `clientHeight`);
- a aba "Feitas" continua clicável.

Resultado (main × branch): ver o PR.
