# E898 — Avaliações abre na casca da Conta

**Achado (Daniel, uso real):** as seções da Conta abrem na `CascaConta` (menu lateral "Conta" fixo, item ativo marcado). `/dashboard/avaliacoes` abria fora dela: sem menu lateral, com cabeçalho próprio "‹ Avaliações" (voltava ao painel), coluna estreita (`max-w-3xl`, centralizada). Quem clicava em Avaliações perdia o menu e a orientação.

**Correção**
- `src/app/(dashboard)/dashboard/avaliacoes/page.tsx`: o painel é renderizado dentro de `<CascaConta ativo="avaliacoes">`. Menu lateral com "Avaliações" ativo no computador; no celular, "‹ Conta" e o título no topo, como as irmãs. O título, a largura e a linha de fechamento vêm da casca.
- `src/components/avaliacoes/painel.tsx`: sai o cabeçalho próprio (H1 + `VoltarCelular` para o painel) e a coluna `mx-auto max-w-3xl`. O conteúdo fica igual: as abas Para avaliar/Recebidas/Feitas, os estados vazios, a faixa das avaliações secretas e as recebidas recentes.

**Varredura das irmãs:** todas as seções do menu (Perfil, Como você usa a Viva, Avaliações, Dados, Privacidade, Segurança, Notificações, Pagamentos e Ajuda) agora têm a tela na `CascaConta`. O teste novo percorre `SECOES_CONTA` e falha se alguma sair. Da mesma família havia `/dashboard/conta/perfil-publico` ("Seu perfil público", subtela do Perfil), que abria fora da casca com `VoltarLista` + `PageTitle`. Agora é `<CascaConta ativo="perfil" subtela titulo="Seu perfil público">`, com o mesmo "← Perfil" no topo e o menu lateral com Perfil ativo.

**Fora do escopo (mantido como está):** o botão flutuante "Fale com a Viva". Ele aparece em Avaliações como aparece em Dados, Pagamentos, Como você usa e Notificações. Some só onde cobria controles: Perfil, Privacidade, Segurança e Ajuda. Nenhuma tela o mostra no celular (< 768 px). O t58 fixa que "as outras telas da conta continuam com o botão".

**Testes**
- `src/lib/conta/e898-avaliacoes-na-casca.test.ts` (4 casos): vermelho na main (0/4), verde na branch (4/4).
- Lab `tests/e2e/specs/t1623-e898-avaliacoes-na-casca.spec.ts`:
  - 1280 px: menu lateral, Avaliações `aria-current`, um H1, abas, largura igual à de Dados, clique no menu.
  - 390 px: "‹ Conta", sem rolagem lateral.
  - Perfil público na casca.
- O t644 (que já esperava o menu lateral em Avaliações) passa.
