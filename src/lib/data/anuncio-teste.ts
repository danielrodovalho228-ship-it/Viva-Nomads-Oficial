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

/*
  E93 — o anúncio de teste aberto pelo link: segue fora de todas as listagens e com noindex; quem NÃO é o dono nem
  admin vê a faixa e o "Solicitar" desativado com o mesmo texto; o dono e o admin veem a página normal, com uma faixa
  discreta.
*/
export const FAIXA_TESTE_VISITANTE = "Anúncio de teste da equipe Viva — não é um imóvel disponível";
export const FAIXA_TESTE_EQUIPE = "Anúncio de teste: fora da busca e das listagens";

export type ModoAnuncioTeste = "visitante" | "equipe" | null;

/** null = anúncio de verdade; "equipe" = o dono ou o admin; "visitante" = qualquer outra pessoa (com ou sem login). */
export function modoAnuncioTeste(titulo: string | null | undefined, quem: { dono: boolean; admin: boolean }): ModoAnuncioTeste {
  if (!ehAnuncioDeTeste(titulo)) return null;
  return quem.dono || quem.admin ? "equipe" : "visitante";
}
