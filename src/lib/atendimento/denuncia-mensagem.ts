/*
  Denunciar mensagem suspeita (ordem 404cd213, item 3) — regra pura, sem banco.
  O chamado leva só o id da conversa e a nota da pessoa; o conteúdo das mensagens a equipe lê no admin.
*/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ASSUNTO_DENUNCIA = "Mensagem suspeita denunciada na conversa";
export const NOTA_DENUNCIA_MAX = 500;

export type DenunciaValida = { ok: true; conversationId: string; nota: string } | { ok: false; error: string };

export function validarDenuncia(input: { conversationId: unknown; nota?: unknown }): DenunciaValida {
  const id = typeof input.conversationId === "string" ? input.conversationId.trim() : "";
  if (!UUID_RE.test(id)) return { ok: false, error: "Conversa inválida." };
  const nota = typeof input.nota === "string" ? input.nota.trim() : "";
  if (nota.length > NOTA_DENUNCIA_MAX) return { ok: false, error: `Observação longa demais (máx. ${NOTA_DENUNCIA_MAX} caracteres).` };
  return { ok: true, conversationId: id, nota };
}

export function textoDenuncia(conversationId: string, nota: string): string {
  return `Denúncia de mensagem suspeita na conversa ${conversationId}. ${nota ? `Observação da pessoa: ${nota}` : "Sem observação da pessoa."}`;
}
