# Frente 3 — área conta/contas de teste (t39, t236, t241, t250, t286)

Quarto PR da Frente 3 (o índice geral está em `docs/frente3-regressoes.md`). Tudo foi reproduzido no
**laboratório local igual ao do CI**: Supabase local, `seed-lab`, variáveis do lab, build próprio e site na 3123.

| Spec | Na main (lab local) | Causa | Classe | Ação |
|---|---|---|---|---|
| t39 (app-mobile) | falha: `/dashboard/assinatura` cai em `/auth?redirect=%2Fdashboard`, não em `/app/boas-vindas` | **E563** (`448775ce8`, 05/11): `/precos` ficou atrás da chave `PRECOS_VISIVEL` (desligada), e `next.config.ts` manda `/dashboard/assinatura` para `/dashboard` (que pede login) | spec desatualizado por decisão (**asserção alterada**) | o destino segue a chave: boas-vindas com `/precos` visível, login sem ela |
| t236 nº "390px /parceiros/[slug]" | já passa na main | E774 (o contato nunca é trocado) — o spec foi acompanhado pelo **E791** (`42fb25a46`, 12/11 02:37), depois da última rodada do CI (`4d705dee7`) | já resolvido na main | nenhuma |
| t241 nº 2 | falha: o cartão da parceira não aparece em `/parceiros/buscar` | **E648** (`9a3205a59`, 06/11): o cadastro que ficou só com CPF não aparece na busca até apresentar o CNPJ (`filtrarParceiros` → `parceiroPodeReceberServico`). A massa do spec criava a parceira como PF com CPF. | spec desatualizado por decisão (dado, não asserção) | a massa passa a PJ com `cnpjAleatorio()` |
| t250 roteiro | falha: "Enviar avaliação" desligado | **E679-B parte 2** (`9f0d6a582`, 07/11): a avaliação do parceiro ficou igual à da estadia, com nota, critérios do par (1 a 5) e "recomendaria". Sem eles o botão não liga. | spec desatualizado por decisão (passos, não asserção) | o spec preenche os critérios e o "recomendaria" antes de enviar |
| t286 carregando (390 e 1280) | falha: nem esqueleto nem título em 3,5 s | **Next 16.4.2** (`30964ddfb`, Prompt 60, primeiro vermelho no lab em 23/10). Para rota ISR com `generateStaticParams`, o Next 16.4 não pré-carrega nada de um id ainda não gerado. A navegação fica parada na busca até a resposta inteira chegar, e o `loading.tsx` nunca aparece. | **regressão** (de dependência) | correção de código: a página do imóvel sai do `generateStaticParams` |

## t286: prova

A sonda (`router.prefetch` + `router.push` com as respostas RSC atrasadas em 4 s, como o spec) mostrou três coisas:

- **main atual:** o `prefetch` não dispara **nenhuma** requisição para `/imoveis/<id>`. Por 3 s a tela segue em "23 imóveis em Uberlândia", e só depois cai direto no imóvel.
- **main sem o `layout.tsx` do #1070** (o 404 do t176): o mesmo comportamento. Portanto o layout **não** é a causa.
- **main sem `generateStaticParams`** (rota passa de ● ISR para ƒ dinâmica): o `prefetch` pede `/imoveis/<id>` com `next-router-prefetch: 1`, e o esqueleto aparece logo após o `push`.

Esse último caso é o que a doc do Next 16 descreve em "Prefetching static vs. dynamic routes": rota dinâmica é pré-carregada até o `loading.js`.

No lab, o histórico de `lab_execucoes` mostra o último verde em `c90e242be` (23/10 00:24) e o primeiro vermelho em `30964ddfb`, que é o commit da troca do Next.

## O que a correção mantém

- `export const revalidate = 60` (guardas `revalidar.test` e `chave-publica.test`).
- O 404 de verdade do layout antes do `loading.tsx` (t176).
- `revalidarAnuncio` nas ações.

O custo é que a página do imóvel passa a renderizar a cada visita, em vez de vir do cache ISR. Ver "Dúvidas" no PR.

## Guarda

`src/app/(public)/imoveis/[id]/frente3-esqueleto-prefetch.test.ts`:

- a página não exporta `generateStaticParams`;
- o `loading.tsx` usa o esqueleto;
- o `revalidate` de 60 s e o `notFound()` do layout continuam.
