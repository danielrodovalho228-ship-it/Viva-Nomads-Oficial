/*
  E143 (decisão do Muse, 25/10; Família 7, ORDEM-DUET-027) — para onde vai quem quer ver ou mexer no NÍVEL de um anúncio.
  PURO. A página antiga do nível (/dashboard/imoveis/[id]/nivel), aberta para um rascunho fora da captura, REDIRECIONA
  ao Passo 5 (paginaNivelFica); segue aberta para a CAPTURA (link do celular/QR, ?fotografar= e ?medir=), para a avaliação
  por avaliador e para o anúncio publicado. As outras entradas seguem o mapa por contexto:
    • anúncio em cadastro (rascunho) → Passo 5 do assistente, no bloco do nível;
    • anúncio já publicado → a seção "Nível do anúncio" do editor por seções (nunca o assistente de anúncio novo).
*/

export const ANCORA_NIVEL_CADASTRO = "nivel-cadastro";
export const ANCORA_NIVEL_EDICAO = "secao-nivel";

/** Rascunho (status "draft") ou anúncio que já saiu do cadastro (publicado, pausado, em análise…). */
export function nivelEhDoCadastro(status: string | null | undefined): boolean {
  return status === "draft";
}

export function destinoNivel(propertyId: string, status: string | null | undefined): string {
  const id = encodeURIComponent(propertyId);
  return nivelEhDoCadastro(status)
    ? `/dashboard/imoveis/novo?draft=${id}&etapa=comodidades#${ANCORA_NIVEL_CADASTRO}`
    : `/dashboard/imoveis/${id}/editar#${ANCORA_NIVEL_EDICAO}`;
}

/** Depois da captura no celular: o rótulo do caminho de volta (o destino é o de destinoNivel). */
export function rotuloVoltaNivel(status: string | null | undefined): string {
  return nivelEhDoCadastro(status) ? "Voltar ao cadastro do anúncio" : "Voltar à edição do anúncio";
}

/**
 * E143 (Família 7): a página antiga /dashboard/imoveis/[id]/nivel, aberta para um RASCUNHO, redireciona para o Passo 5
 * (onde estão o nível, os toggles de ruído e extras e o guia). Fica aberta para a CAPTURA (?fotografar= / ?medir=, do
 * link do celular ou do QR), com a chave da vistoria ligada (a avaliação por avaliador mora aqui) e para o anúncio que já
 * saiu do cadastro (o Passo 5 é do cadastro; o publicado tem a seção "Nível do anúncio" na edição).
 */
export function paginaNivelFica(p: { captura: boolean; vistoriaAtiva: boolean; status: string | null | undefined }): boolean {
  return p.captura || p.vistoriaAtiva || !nivelEhDoCadastro(p.status);
}
