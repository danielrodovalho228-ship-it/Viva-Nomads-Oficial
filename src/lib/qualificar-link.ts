// Destino do aviso "Falta a qualificação" no assistente de novo imóvel (F8).
// Nunca aponta para a própria página do assistente: com id vai ao checklist
// daquele imóvel; sem id (rascunho ainda não salvo) o assistente salva antes.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function linkQualificacao(imovelId?: string | null): string | null {
  if (!imovelId || !UUID_RE.test(imovelId)) return null;
  return `/qualificar?imovel=${imovelId}`;
}

/**
 * Para onde "Voltar ao anúncio" leva: rascunho reabre pelo `?draft=` (retoma o
 * snapshot salvo — `?id=` abria o editor de anúncio publicado, vazio para um
 * rascunho); publicado, pela edição; sem imóvel, um anúncio novo.
 */
export function rotaVoltarAoAnuncio(imovel: { id: string; rascunho: boolean } | null): string {
  if (!imovel) return "/dashboard/imoveis/novo";
  return imovel.rascunho ? `/dashboard/imoveis/novo?draft=${imovel.id}` : `/dashboard/imoveis/novo?id=${imovel.id}`;
}
