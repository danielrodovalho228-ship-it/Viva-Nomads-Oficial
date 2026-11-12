# E799 (D4): a prévia do perfil não oscila entre carregamentos

## O relato

Na mesma conta de proprietário (Paulo), a prévia do perfil alternava entre dois cartões a cada carregamento:

- "Paulo P. / Responde 100% das conversas, em cerca de 14 horas / É assim que o morador te vê no seu anúncio";
- "Paulo Teste Proprietário2 / E-mail confirmado / É assim que o proprietário te vê quando você pede para morar".

Mudavam o nome, o papel e o texto, e com isso o dono deixa de confiar no que o outro lado vê.

## Causa

O `EspelhoPorPapel` (`src/components/account/espelho-papel.tsx`) decidia o papel pela ação `meuPerfilPublico()`, chamada no navegador **depois** de montar a tela. O código era `papel = !ehDono ? "morador" : …`. Daí vinham dois problemas:

1. **Enquanto a leitura não chegava**, `ehDono` era falso e a prévia desenhava o cartão de **morador**. Depois trocava para o do dono. Esse é o salto visto em toda carga, inclusive no lab sem nenhuma interceptação.
2. **Quando a leitura falhava**, a prévia ficava no cartão de morador. No servidor, `getPerfilProprietario(...).catch(() => null)` e o `try/catch` interno convertiam qualquer tropeço passageiro (avatar assinado, telefones, LinkedIn…) em "não é dono".

Os dois cartões usam fontes de nome diferentes: o nome completo digitado, no de morador, e o nome curto, no do dono. Por isso o nome também oscilava.

## Correção: fonte única e estável

Puro, em `src/lib/perfil/espelho-estado.ts`:
- **`papelDoPerfilPublico(temImovel, faixaLida)`** (servidor):
  - ser dono é **ter imóvel**, o mesmo fato que a RPC `perfil_publico_proprietario` usa;
  - consulta falhou, ou é dono mas a faixa não veio → **falha**, nunca "morador".
- **`estadoDoEspelho({ leitura, ehDono, papelDoModo, visto })`** (tela):
  - leitura carregando → **espera**, sem nome nem papel;
  - leitura falhou → **falha**, com a mensagem e "Tentar de novo";
  - leitura ok → dono vê o cartão do papel em uso (ou o do "Ver como"); quem não anuncia vê o de morador.

Os pontos que mudam:
- **`meuPerfilPublico`:** conta os imóveis da pessoa (`count head`), lê a faixa sem `.catch(() => null)` e lança erro na falha. O `SeuPerfilPublico`, que já trata o erro, também deixa de mostrar o cartão de morador para um dono numa falha.
- **`EspelhoPorPapel`:** passa a usar `estadoDoEspelho`. Os novos `data-testid` são `espelho-carregando`, `espelho-falha` e `espelho-tentar-de-novo`. O `data-papel` traz o estado.

A regra de papel do E55 não muda: dono vê o cartão do papel em uso, com o "Ver como…".

## Provas

### Unitário

Comando:
```
node --test src/lib/perfil/*.test.ts src/components/account/*.test.ts src/lib/e101.test.ts src/lib/estilo/*.test.ts
```
Resultado: **208 pass / 0 fail**.

### E2E no lab

Spec: `tests/e2e/specs/t1613-e799-previa-perfil-estavel.spec.ts`. Usa uma conta de proprietário com imóvel, a 1280 px, com um MutationObserver que registra **todo** título e nome que a prévia chegar a mostrar.

| Caso | main `f5bdb9e` | branch |
|---|---|---|
| leitura da prévia atrasada 4 s | ✘ viu "É assim que o proprietário te vê quando você pede para morar" (cartão de morador) | ✓ espera sem cartão; depois, só o do dono |
| leitura da prévia falhando | ✘ cartão de morador fixo | ✓ "Não foi possível carregar a prévia…" + "Tentar de novo"; nunca o de morador |
| 3 carregamentos seguidos | ✘ em cada carga, o cartão de morador aparece antes do de dono (2 títulos vistos) | ✓ um título só, o mesmo nas 3 cargas |

## Asserções alteradas

`src/lib/e101.test.ts` (E55) conferia o atalho antigo, `const papel: Papel = !ehDono ? "morador" : (visto ?? p.papel)`, e `{ehDono && (`. Agora confere a fonte única, `estadoDoEspelho({ leitura, ehDono, papelDoModo: p.papel, visto })`, e `{leitura === "ok" && ehDono && (`. A regra do E55 segue verificada pelos testes puros.

Saída na branch (build de produção, chave `piloto`):
```
  ✓  2 … três carregamentos seguidos: o mesmo título e o mesmo nome (15.3s)
  ✓  1 … leitura da prévia atrasada: nunca aparece o cartão de morador (38.0s)
  ✓  3 … leitura da prévia falhando: nunca aparece o cartão de morador (8.6s)
  3 passed (1.0m)
```

### Regressão das telas da prévia (lab, branch)

- t355 (Conta A: perfil e espelho): **9 passed**.
- t439 (E101: espelho e detecção): **5 passed**.
