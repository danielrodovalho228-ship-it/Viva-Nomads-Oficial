// Destino do aviso "Falta a qualificação" no assistente de novo imóvel (F8).
// E196: os requisitos moram no cartão "Antes de publicar" da Revisão (Passo 10, E132-A) e o documento num lugar só
// (E153) — não há mais página à parte. Com id, vai à Revisão daquele rascunho; sem id (rascunho ainda não salvo), o
// assistente salva antes.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function linkQualificacao(imovelId?: string | null): string | null {
  if (!imovelId || !UUID_RE.test(imovelId)) return null;
  return `/dashboard/imoveis/novo?draft=${imovelId}&etapa=revisao`;
}

/**
 * E196: para onde vai um link antigo `/qualificar?imovel=<id>` (e-mail, favorito): rascunho abre o "Antes de publicar"
 * da Revisão; anúncio publicado, o editor; imóvel que não é do dono (ou não existe), Meus imóveis.
 */
export function destinoDaQualificacao(imovel: { id: string; rascunho: boolean } | null): string {
  if (!imovel) return "/dashboard/imoveis";
  return imovel.rascunho ? `/dashboard/imoveis/novo?draft=${imovel.id}&etapa=revisao` : `/dashboard/imoveis/novo?id=${imovel.id}`;
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
