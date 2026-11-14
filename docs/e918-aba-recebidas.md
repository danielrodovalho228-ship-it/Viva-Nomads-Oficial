# E918 — /dashboard/avaliacoes: a aba "Recebidas" não ativava

**Relato (Muse, 14/11):** a aba "Recebidas" não ativava, nem clicando nem pela URL direta. "Para avaliar" continuava ativa.

## O que foi conferido (main `f29d5a70b`, lab local com build de produção)

**O código.**
- `abaDoPainel()` devolve `recebidas` para `?aba=recebidas`. Para os filtros antigos (`todas`, `recentes`, `positivas`), também.
- O painel (`src/components/avaliacoes/painel.tsx`) marca `aria-current="page"` e o sublinhado verde pela mesma variável `aba`.
- O proxy (`src/proxy.ts`) só redireciona `/dashboard/conta/avaliacoes`, e o faz para `?aba=recebidas`. Nenhum redirecionamento do proxy nem do `next.config.ts` apaga o `?aba=` de `/dashboard/avaliacoes`.
- A lógica das abas não mudou desde a produção de 14/11 02:06Z (`db23a15b2`). O E898 (#3810, em produção desde 12:30Z) só embrulhou o painel na casca da Conta.

**A sonda no lab.**
- Contas novas, de morador e de dono, a 390 e 1280 px.
- Abrindo `?aba=recebidas`, a aba "Recebidas" ficou ativa e a lista de recebidas apareceu (filtros "Todas, Recentes, Positivas" e a busca).
- Clicando em "Recebidas" a partir de "Para avaliar", o resultado foi o mesmo. Print a 390 px conferido.

## Entrega
`tests/e2e/specs/t1626-e918-abas-avaliacoes.spec.ts` guarda as três abas:
- uma só aba ativa (`aria-current`);
- o conteúdo da aba certa aparece e o das outras não;
- vale pelo endereço e pelo clique, a 390 e 1280 px, para morador e dono.

No lab: `4 passed (6.2m)`. Não há mudança de comportamento: nenhum código de produção foi alterado.

## Causa encontrada (caso real do Gerente, 14/11)
**O caso real:**
- conta de teste de proprietário, sem nenhuma avaliação (estado vazio);
- "Recebidas" clicada 2× e aberta por **`/dashboard/avaliacoes?tab=recebidas`**.

A página só lia `?aba=`. Com `?tab=`, `abaDoPainel(undefined)` caía em "Para avaliar": a URL mudava e a aba não.

**Correção:**
- `abaDoEndereco()` e `filtroDoEndereco()` (em `src/lib/conta/painel-avaliacoes.ts`) aceitam `?tab=` como `?aba=`;
- `?aba=` manda quando os dois vêm;
- a página usa as duas funções.

**Trava:**
- `src/lib/conta/e918-aba-do-endereco.test.ts`: na main `not ok 1` (sem `abaDoEndereco`); na branch `# pass 4 / # fail 0`.
- `t1626` passa a cobrir `?tab=` para as três abas, o estado vazio (`painel-sem-recebidas`) e os dois cliques seguidos em "Recebidas".
  - Na main: `dono 390 URL ?tab=recebidas: a aba ativa`, `1 failed`.
  - Na branch: `4 passed (6.4m)`.

As contas do lab já nasciam sem avaliações. Nelas, o clique sempre ativou "Recebidas" (main e branch). Só o `?tab=` reproduz o que a prova viu.
