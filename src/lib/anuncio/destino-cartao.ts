/*
  E510 — para onde levam a FOTO e o TÍTULO do cartão em Meus imóveis (fonte única, os mesmos destinos dos botões do
  cartão). Antes a foto não era clicável em nenhum estado e o título só linkava no anúncio ativo (pausado e rascunho
  davam 404 na página pública, t249 D-V7 — por isso o destino deles é a edição, não a página pública).
   • ativo    → a página pública do anúncio ("Ver");
   • rascunho → onde parou ("Continuar editando", E507);
   • pausado  → o editor ("Editar").
*/
export type EstadoCartao = "active" | "paused" | "draft";

export function destinoDoCartao(p: { id: string; status: EstadoCartao; retomar: string }): string {
  if (p.status === "active") return `/imoveis/${p.id}`;
  if (p.status === "draft") return p.retomar;
  return `/dashboard/imoveis/${p.id}/editar`;
}
