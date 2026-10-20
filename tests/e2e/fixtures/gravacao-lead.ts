/**
 * Diz se um POST é a GRAVAÇÃO de um contato (Server Action `requestLead`: o corpo leva o tipo
 * "candidatura" | "duvida" | "visita") ou o texto digitado na mensagem. As Server Actions de
 * leitura/rastreio que a página dispara sozinha depois de hidratar (também POST na mesma URL)
 * não gravam contato e não contam.
 */
export function ehGravacaoDeLead(metodo: string, corpo: string | null | undefined, textos: string[] = []): boolean {
  if (metodo !== "POST") return false;
  const c = corpo ?? "";
  if (/"(candidatura|duvida|visita)"/.test(c)) return true;
  return textos.some((t) => t && c.includes(t));
}
