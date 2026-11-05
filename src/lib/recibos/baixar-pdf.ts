/*
  E465 — o texto e o nome do arquivo do botão que gera e baixa um PDF (puro, sem imports @/).
*/

export const MSG_PDF_GERANDO = "Gerando o PDF…";
export const MSG_PDF_FALHOU = "Não foi possível gerar o PDF agora. Tente de novo em instantes.";
export const msgPdfBaixado = (arquivo: string) => `PDF gerado e baixado: ${arquivo}.`;

/** O nome que a rota dá no Content-Disposition (sem caminho); sem ele, o padrão. */
export function nomeDoAnexo(contentDisposition: string | null | undefined, padrao: string): string {
  const m = /filename="?([^";]+)"?/i.exec(contentDisposition ?? "");
  const nome = m?.[1]?.split(/[\\/]/).pop()?.trim();
  return nome || padrao;
}
