/*
  E207 (decisão do coordenador, 28/10): o detalhe público do imóvel não tem migalhas visíveis; "← Voltar aos resultados"
  aparece SÓ para quem chegou ali pela /buscar, e volta para a mesma busca (com os filtros). Quem chega direto (Google,
  link compartilhado) não vê nada. PURO: a /buscar grava qual imóvel foi aberto e de qual URL; o detalhe só mostra o
  link se for o MESMO imóvel. Fica só nesta aba (sessionStorage), sem dado pessoal.
*/
export const CHAVE_VOLTAR_BUSCA = "vn:voltar-busca";
export const ROTULO_VOLTAR_BUSCA = "Voltar aos resultados";

/** O que a /buscar grava ao abrir um imóvel: o id (do href /imoveis/<id>) e a URL da busca com os filtros. */
export function registroVoltarBusca(href: string, buscaAtual: string): string | null {
  const m = /^\/imoveis\/([^/?#]+)/.exec(href);
  if (!m || !buscaAtual.startsWith("/buscar")) return null;
  return JSON.stringify({ id: decodeURIComponent(m[1]), url: buscaAtual });
}

/** Para onde volta o "← Voltar aos resultados" deste imóvel; null = não mostra (não veio da busca). */
export function destinoVoltarBusca(raw: string | null, imovelId: string): string | null {
  try {
    const o = raw ? (JSON.parse(raw) as { id?: unknown; url?: unknown }) : null;
    if (!o || o.id !== imovelId || typeof o.url !== "string") return null;
    return o.url.startsWith("/buscar") && !o.url.startsWith("//") ? o.url : null;
  } catch {
    return null;
  }
}
