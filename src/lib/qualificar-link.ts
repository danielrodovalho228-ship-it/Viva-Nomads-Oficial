// Destino do aviso "Falta a qualificação" no assistente de novo imóvel (F8).
// Nunca aponta para a própria página do assistente: com id vai ao checklist
// daquele imóvel; sem id (rascunho ainda não salvo) o assistente salva antes.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function linkQualificacao(imovelId?: string | null): string | null {
  if (!imovelId || !UUID_RE.test(imovelId)) return null;
  return `/qualificar?imovel=${imovelId}`;
}
