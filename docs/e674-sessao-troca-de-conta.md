# E674 — a sessão não troca de conta sozinha

**Relato (07/11, retomada do E652):** logado como proprietario2 (Paulo) pela porta de QA, navegar a /dashboard ou
/dashboard/conta restaurou a sessão anterior do inquilino1 (Lucas).

**Leitura do código (sem prova ao vivo):** a porta grava os cookies no servidor (`verifyOtp`), mas o navegador guarda
mais coisas da conta anterior:
1. `localStorage["vivanomads-auth"]` (modo ativo, papel "parceiro", relógio de 24h) era herdado pela conta seguinte — o
   Paulo abria como o Lucas. `setUser` não distinguia "outra conta".
2. A página `/qa/entrar` carrega com o cliente do navegador ainda com a sessão da conta anterior; ele pode renovar o
   token e regravar o cookie dela depois que o servidor gravou o da conta nova (corrida entre o cookie do servidor e o
   do cliente).

**Correção (sem migração):**
- `estadoAoTrocarDeConta` (`src/lib/sessao/troca-de-conta.ts`) + `setUser` do store: outra conta no mesmo navegador
  zera `activeMode` e `parceiroAtivo` e reinicia o relógio de 24h.
- O formulário da porta de QA, antes do POST, encerra a sessão LOCAL do navegador (`signOut({ scope: "local" })`, não
  derruba a conta nos outros aparelhos) e limpa o store.

**Teste:** `src/lib/sessao/e674-troca-de-conta.test.ts` (escrito antes, visto vermelho).

**Dúvida:** não reproduzi a troca ao vivo; as duas causas são as que o código mostra. Se a QA ainda vir o Lucas depois do
deploy, falta o horário e a aba em que aconteceu (outra aba aberta com a conta anterior também pode renovar o cookie).

## Complemento (07/11, 2ª volta): a causa que sobrava no SERVIDOR
O #3166 (mergeado) limpou o lado do navegador (store e sessão local, antes do POST da porta). Sobrava o lado do servidor:
`entrarComoQa` chamava `verifyOtp` com os cookies da conta anterior ainda no pedido. Agora, depois de todas as travas e antes
de gravar a sessão nova, a porta encerra a sessão LOCAL (`signOut({ scope: "local" })`: só os cookies deste navegador; a
conta anterior não é derrubada em outros aparelhos). Teste: `src/lib/qa/e674-porta-limpa-sessao.test.ts`.

Sobre a guarda de `/dashboard/contratos` em carga direta: a página não tem guarda própria (o `proxy.ts` barra sem sessão e o
servidor lê a sessão pelo cookie), então o conteúdo da carga direta é sempre o da conta do cookie; a lista por navegação interna
e a carga direta usam a mesma consulta. A troca vinha do cookie, não da página. Sem prova ao vivo.

## E668 (mesmo dispatch)
Já mergeado no #3134 (carimbo `papel_ativo_escolhido_em`, migração 0318): "parceiro" só vale como papel gravado se foi escolhido;
a casca abre como "Áreas do morador/proprietário" por papel. Nada novo neste PR.
