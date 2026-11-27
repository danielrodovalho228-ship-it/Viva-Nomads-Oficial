/**
 * E461: para onde leva "Abrir minha página" no painel do parceiro. Com a página publicada, a página pública (em outra
 * aba, como "Ver a página"); sem ela no ar (rascunho, pausada, suspensa ou painel ainda não lido), o editor da página no
 * próprio painel (#editor-pagina — a aba "Página" abre por padrão). PURO.
 */
export const ANCORA_EDITOR_PAGINA = "editor-pagina";

export function destinoMinhaPagina(p: { status: string; slug: string } | null): { href: string; novaAba: boolean } {
  if (p && p.status === "publicado" && p.slug) return { href: `/parceiros/${encodeURIComponent(p.slug)}`, novaAba: true };
  return { href: `/dashboard/parceiro#${ANCORA_EDITOR_PAGINA}`, novaAba: false };
}
