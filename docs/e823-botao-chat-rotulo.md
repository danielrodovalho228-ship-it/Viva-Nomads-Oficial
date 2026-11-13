# E823 — o botão flutuante de chat sem rótulo

**Achado** (RELATORIO-012). Em /empresas e /parceiros, o círculo verde com um balão, no canto inferior direito, não
tinha texto: o visitante não sabia o que ele abria.

**Contexto.** O botão é o "Fale com a Viva" (`src/components/ajuda/viva-chat.tsx`):
- **C1b:** ele virou só o ícone redondo em todo o site, porque com o texto (180 × 48 px) cobria conteúdo de /termos,
  /empresas e /parceiros. O nome ficou só para leitor de tela (`aria-label`, `sr-only`).
- **E246:** no celular ele não aparece; o "Fale com a Viva" fica no menu ☰.

**Correção**, sem voltar a cobrir o conteúdo:
- **Rótulo visível:** "Fale com a Viva · chat de atendimento" (`ROTULO_BOTAO_VIVA`) aparece logo acima do botão ao
  passar o mouse ou ao focar pelo teclado (`peer-hover` / `peer-focus-visible`). Ele não recebe clique e não aparece
  enquanto se arrasta.
- **`title`:** o botão ganha o mesmo texto.
- **Nome acessível:** continua "Fale com a Viva".

**Testes.**
- `src/components/ajuda/e823-botao-chat-rotulo.test.ts` (3): falha na main (2 de 3) e passa na branch. Confere o texto,
  o `title` e o nome acessível, e o rótulo que aparece no hover/foco.
- `tests/e2e/specs/t1624-e823-botao-chat-rotulo.spec.ts`: no lab, com o build da branch, em /empresas e /parceiros a
  1280 px, o rótulo está escondido, aparece no hover, some ao tirar o mouse e aparece no foco pelo teclado. 2 passed.
