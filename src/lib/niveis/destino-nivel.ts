/*
  E143 (decisão do Muse, 25/10) — para onde vai quem quer ver ou mexer no NÍVEL de um anúncio. PURO. Nada de redirect
  geral: a página antiga do nível (/dashboard/imoveis/[id]/nivel) continua viva para a CAPTURA (link do celular/QR,
  ?fotografar= e ?medir=) e para a avaliação por avaliador. As outras entradas seguem o mapa por contexto:
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
