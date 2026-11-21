/*
  E830 — o critério do texto de local da busca, num lugar só: o anúncio entra quando "bairro cidade" contém o texto
  (sem diferença de maiúsculas). É BAIRRO/CIDADE, não distância: quem usa este critério (a /buscar, a contagem dos
  atalhos da home e o atalho do HC-UFU) tem de dizer bairro no nome. PURO.
*/
export function casaLocal(p: { neighborhood?: string | null; city?: string | null }, local: string): boolean {
  const q = local.trim().toLowerCase();
  if (!q) return true;
  return `${p.neighborhood ?? ""} ${p.city ?? ""}`.toLowerCase().includes(q);
}
