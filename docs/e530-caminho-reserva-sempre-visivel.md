# E530 (reprova de 06/11) — "Ver o caminho de reserva" sempre visível na página do imóvel

**Reprova:** o controle não aparecia em `ube-010`/`ube-001` público nem no anúncio de teste logado. A causa: o PR #2599 pôs o controle dentro do bloco do calendário que só existe **depois de escolher datas** e só no **anúncio de exemplo**; em anúncio real, ou sem datas, não havia nada.
**Correção:** `src/components/property/caminho-reserva.tsx` (um "abrir/fechar" com os passos do morador, a mesma fonte do Como funciona, e o link para `/como-funciona#para-inquilinos`) fica em `#disponibilidade`, acima do calendário, para todo imóvel, visitante ou logado, desktop e celular (alvo de toque de 44 px). O calendário deixa de guardá-lo (um só no DOM).
**Testes:** `src/lib/e530-caminho-reserva.test.ts` (componente próprio, posição antes do calendário, um só controle); `t873` agora abre o controle sem escolher datas, a 1280 e 390 px (prova no laboratório, não executada aqui).
