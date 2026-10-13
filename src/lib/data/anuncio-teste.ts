/**
 * Anúncios de teste do QA levam a marca "[TESTE ...]" (ou [TEST]/[QA]) no começo do
 * título. Visitante nunca os vê nas listagens públicas (home, busca, cidades, 404,
 * sitemap). O dono e o QA ainda abrem o anúncio pelo link/painel.
 */
const MARCA_TESTE = /^\s*\[\s*(teste|test|qa)\b[^\]]*\]/i;

export function ehAnuncioDeTeste(titulo: string | null | undefined): boolean {
  return typeof titulo === "string" && MARCA_TESTE.test(titulo);
}

export function semAnunciosDeTeste<T extends { title?: string | null }>(lista: T[]): T[] {
  return lista.filter((p) => !ehAnuncioDeTeste(p.title));
}
