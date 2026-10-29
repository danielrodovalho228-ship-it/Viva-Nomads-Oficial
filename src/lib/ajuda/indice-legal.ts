/*
  E84 — o índice dos Termos e da Privacidade (mockups ajuda-termos e ajuda-privacidade). O índice lê os títulos das
  próprias seções — nenhum texto jurídico é escrito ou repetido aqui. Puro.
*/

/** Âncora estável de uma seção a partir do título ("3. Pagamento do aluguel" → "secao-3"). */
export function ancoraDaSecao(titulo: string): string {
  const numero = /^\s*(\d+)\./.exec(titulo)?.[1];
  if (numero) return `secao-${numero}`;
  const base = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `secao-${base || "sem-titulo"}`;
}

/** Rótulo do índice: o título sem o número ("3. Pagamento do aluguel" → "Pagamento do aluguel"). */
export function rotuloDoIndice(titulo: string): string {
  return titulo.replace(/^\s*\d+\.\s*/, "").trim();
}
