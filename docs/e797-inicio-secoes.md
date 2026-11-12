# E797: o Início chega em seções (decisão do chat principal, opção b)

## O sintoma

`/dashboard` abria com um esqueleto de página inteira por cerca de 1 a 3 s, mesmo com a chave `piloto` ligada.

## A causa (medida no #3751)

O esqueleto **não** era o do guarda: esse o E793 já resolveu, e o `auth-guard-carregando` nunca aparece no piloto.

Era o `SkeletonLista` do `dashboard/loading.tsx`, o Suspense da rota. A página do Início era um único componente assíncrono que esperava as leituras antes de desenhar qualquer coisa: 11 em paralelo, mais um 2º lote de 4, mais as ativações. Enquanto isso, o Suspense mostrava o esqueleto de página inteira.

No lab, ele ficava de 50 a 250 ms. Em produção, com leituras mais lentas, chegava aos 1 a 3 s da prova ao vivo.

## A decisão (chat principal, 12/11)

Opção (b): dividir o Início em seções que chegam aos poucos.
- Topo e atalhos pintam no 1º quadro.
- Cada bloco de dados carrega com o seu próprio marcador.
- O esqueleto de página inteira não aparece na rota do Início.

## O que mudou

| Arquivo | Antes | Depois |
|---|---|---|
| `dashboard/loading.tsx` | `SkeletonLista` (esqueleto de página inteira) em toda tela do painel | Em `/dashboard`, a **casca do Início**: o topo, o marcador do bloco de dados (`inicio-secao-carregando`) e as partes fixas. É o 1º quadro, na carga e na navegação até o Início. Nas demais telas, nada muda |
| `dashboard/page.tsx` | `async`: esperava todas as leituras | Topo → `InicioDados` → partes fixas → rodapé. Quando as leituras terminam, o marcador dá lugar ao bloco de dados no mesmo lugar, e topo e fixos ficam onde estavam |
| `dashboard/inicio-dados.tsx` (novo) | — | As **mesmas** leituras e regras de antes, só mudadas de lugar (o mesmo `Promise.all`, os mesmos limites e o mesmo aviso de falha) |
| `dashboard/visao-geral-client.tsx` | — | Ganhou `InicioTopo` ("Olá, {primeiro nome}!"; no piloto o nome vem da sessão do servidor no 1º quadro), `MarcadorSecaoInicio` e `InicioFixo` (no modo dono, Peça na Viva e Ferramentas) |
| `components/painel/inicio-dono.tsx` | Peça na Viva e Ferramentas dentro do bloco de dados | Saíram para `InicioDonoFixo`, com os mesmos testids e o mesmo texto, e aparecem no 1º quadro |

### Por que a casca é o fallback do `loading.tsx`, e não um Suspense interno

A 1ª versão tinha um `<Suspense>` **dentro** da página. O t266 pegou o efeito colateral:
- a casca hidratava primeiro, e o bloco de dados ficava **cerca de 880 ms visível, mas sem hidratar**;
- um toque nesse intervalo ("Resolver agora") era segurado pelo React, e a navegação se perdia.

Medi isso com uma sonda, e o t266 ficou vermelho só na branch. Pelo `loading.tsx` da rota, a página chega e hidrata **inteira de uma vez**, como na main. O t266 voltou a 8/8, e o esqueleto de página inteira continua fora (t1614).

## Provas

### Unitário

Comando:
```
node --test <testes alterados> src/lib/painel/*.test.ts "src/app/(dashboard)/dashboard/"*.test.ts src/components/painel/*.test.ts src/lib/estilo/*.test.ts
```
Resultado: **297 pass / 0 fail**. Inclui `src/lib/painel/e797-inicio-secoes.test.ts`.

### E2E no lab

Spec: `tests/e2e/specs/t1614-e797-inicio-secoes.spec.ts`, com as contas da massa (DONO17, TRES e INQUILINA), a 1280 e a 390 px, mais a navegação de `/dashboard/conta/perfil` até o Início. Ela verifica três coisas:
- **no HTML do servidor:** o topo vem **antes** do bloco de dados, e o `SkeletonLista` de página inteira não vem;
- **no navegador, quadro a quadro (MutationObserver):** o esqueleto de página inteira (o `SkeletonLista` ou o do guarda) **nunca** aparece, e o topo aparece antes do bloco de dados ou junto com ele;
- **na navegação interna até o Início:** o esqueleto de página inteira também não aparece.

| | main `27dbdf1` | branch |
|---|---|---|
| t1614 (7 casos) | **7 failed**: "o esqueleto de página inteira apareceu" (6 em carga dura, 1 na navegação) | **7 passed** |

### Regressão (lab, branch final)

- t266 (painel do Prompt 42): **8 passed**.
- t1608 (piloto E793): **7 passed**.
- t761 (Início do morador): **2 passed**.
- t480: **5 passed**, na versão anterior desta branch; a parte de navegação do morador não mudou desde então.
- t464: **falha também na main** (`inicio-dono-foto` a 390 px). É anterior a este PR e não foi tocado.

## Asserções alteradas

Vinte e sete testes antigos liam o código-fonte de `dashboard/page.tsx` para conferir as leituras do Início. Agora leem `dashboard/inicio-dados.tsx`, para onde as leituras foram, sem mudança. O que eles conferem é o mesmo.

Em `e503-inicio-carregamento.test.ts`:
- o recorte começa em `export async function InicioDados`, e não mais em `export default async function DashboardPage`;
- o `<RodapeInicio />` é conferido em `page.tsx`, porque passou a fazer parte da casca fixa.
