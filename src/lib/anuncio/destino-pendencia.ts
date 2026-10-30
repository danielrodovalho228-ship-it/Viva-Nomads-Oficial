/*
  P0 (uso real do Daniel, 30/10) — para onde leva um atalho de pendência de um anúncio. PURO.
  Enquanto o anúncio é RASCUNHO (em cadastro), todo atalho abre o PASSO certo DENTRO do assistente ("Passo X de 10",
  Continuar/Voltar, fotos no Passo 2) — nunca o editor por seções, que esconde as fotos numa seção recolhida.
  Anúncio que já saiu do cadastro (publicado, pausado, em análise) segue no editor por seções, na seção do assunto.
*/
import { ETAPA } from "./etapas-ids.ts";

/** Rascunho = em cadastro (o mesmo critério do nível, E143). */
export function emCadastro(status: string | null | undefined): boolean {
  return status === "draft";
}

/** O passo do assistente de um rascunho (`?etapa=` aceita o número do passo). */
export function hrefPassoDoRascunho(propertyId: string, etapa?: number | null, ancora?: string): string {
  const id = encodeURIComponent(propertyId);
  const passo = typeof etapa === "number" && Number.isInteger(etapa) && etapa >= 0 ? `&etapa=${etapa}` : "";
  return `/dashboard/imoveis/novo?draft=${id}${passo}${ancora ? `#${ancora}` : ""}`;
}

/** Seção do editor por seções de cada passo do assistente (para anúncio já publicado). */
const SECAO_DO_PASSO: Record<number, string> = {
  [ETAPA.regras]: "secao-regras",
  [ETAPA.fotos]: "secao-fotos",
};

/**
 * Destino de uma pendência: rascunho → o passo no assistente; publicado/pausado → o editor por seções (na seção do
 * passo, quando ela tem âncora). `etapa` vem da prontidão (ItemProntidao.etapa).
 */
export function destinoPendencia(imovel: { id: string; status: string | null | undefined }, etapa?: number | null): string {
  if (emCadastro(imovel.status)) return hrefPassoDoRascunho(imovel.id, etapa);
  const secao = typeof etapa === "number" ? SECAO_DO_PASSO[etapa] : undefined;
  return `/dashboard/imoveis/${encodeURIComponent(imovel.id)}/editar${secao ? `#${secao}` : ""}`;
}
