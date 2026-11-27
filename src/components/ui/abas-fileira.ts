/*
  E801 (D5, prova de 12/11): nas abas sublinhadas (Avaliações, Favoritos) a fileira tinha overflow-x-auto e cada aba
  -mb-px (o sublinhado cobre a borda). Esse 1 px que vaza para baixo abria a rolagem VERTICAL também — e a miniatura da
  barra de rolagem flutuava sobre a linha das abas. A fileira rola na horizontal, sem rolagem vertical e sem barra à
  vista (o mesmo de FileiraRolavel).
*/
export const FILEIRA_ABAS = "flex gap-2 overflow-x-auto overflow-y-hidden border-b border-sage-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
