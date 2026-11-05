/*
  Adendo 59.1 — filtro "a partir de" nível na busca (PURO). `?nivel=essencial` mostra os anúncios com nível calculado;
  `?nivel=conforto` mostra Conforto e Premium; `?nivel=premium`, só Premium. Usa o nível gravado pelo servidor (elo mais fraco). Nível não compra posição: o filtro só tira da lista.
*/
import { ROTULO_NIVEL, type Nivel } from "../../config/niveis.ts";

const VALIDOS: readonly Nivel[] = ["essencial", "conforto", "premium"];

export function filtroNivelDaUrl(sp: { get(k: string): string | null }): Nivel | "" {
  const v = sp.get("nivel") ?? "";
  return (VALIDOS as readonly string[]).includes(v) ? (v as Nivel) : "";
}

/** Rótulo do resumo dos filtros: "Nível Conforto ou acima" / "Nível Premium". */
export function rotuloFiltroNivel(nivel: Nivel | "" | undefined): string | null {
  if (!nivel) return null;
  return nivel === "premium" ? "Nível Premium" : `Nível ${ROTULO_NIVEL[nivel]} ou acima`;
}

export function filtroNivelNaUrl(params: URLSearchParams, nivel: Nivel | ""): void {
  if (nivel && (VALIDOS as readonly string[]).includes(nivel)) params.set("nivel", nivel);
  else params.delete("nivel");
}

// ── NIVEL-BUSCA-A: filtro de nível sem beco sem saída ───────────────────────────────────────────────────────────
/** No lugar do grupo "Nível a partir de" quando nenhum nível tem anúncio na busca atual (sem link). */
export const TEXTO_SEM_NIVEIS = "Os níveis aparecem quando os anúncios desta busca tiverem o padrão mínimo confirmado.";

/** Aviso da busca que o `?nivel=` zerou (o botão "Ver todos" tira só o filtro de nível). */
export function avisoNivelSemResultado(nivel: Nivel): string {
  return `Nenhum imóvel com nível ${ROTULO_NIVEL[nivel]} nesta busca`;
}

/**
 * Como a folha mostra o grupo de nível: cada opção com contagem 0 fica desabilitada (o "· 0" fica); com as três em 0 o
 * grupo some e entra a linha TEXTO_SEM_NIVEIS. A opção já escolhida nunca é desabilitada nem escondida (senão não dá
 * para desligar o filtro).
 */
export function grupoNivel(contagens: Record<Nivel, number>, escolhido: Nivel | ""): { visivel: boolean; desabilitado: Record<Nivel, boolean> } {
  const desabilitado = Object.fromEntries(VALIDOS.map((v) => [v, contagens[v] === 0 && escolhido !== v])) as Record<Nivel, boolean>;
  return { visivel: !!escolhido || VALIDOS.some((v) => contagens[v] > 0), desabilitado };
}

// ── E573: filtro por nível EXATO (Essencial · Conforto · Premium), com contador por nível ────────────────────────
/*
  Decisão do Daniel (04/11): o grupo "Nível" do painel de filtros devolve os anúncios com AQUELE nível definido (não
  "a partir de"). Mais de um nível escolhido soma (Conforto ou Premium). Anúncio sem nível definido (nulo ou "em
  adequação") não entra em filtro de nível nenhum. URL: `?niveis=conforto,premium`. O rótulo/posição no painel é da
  Pista A; aqui ficam os dados e a regra.
*/

/** Os níveis escolhidos na URL (`?niveis=`), sem repetidos e na ordem da casa; inválidos caem. */
export function niveisDaUrl(sp: { get(k: string): string | null }): Nivel[] {
  const pedidos = new Set((sp.get("niveis") ?? "").split(",").map((v) => v.trim()));
  return VALIDOS.filter((v) => pedidos.has(v));
}

export function niveisNaUrl(params: URLSearchParams, niveis: readonly Nivel[]): void {
  const validos = VALIDOS.filter((v) => niveis.includes(v));
  if (validos.length) params.set("niveis", validos.join(","));
  else params.delete("niveis");
}

/** O anúncio tem um dos níveis escolhidos? Sem escolha, passa; sem nível definido, nunca passa num filtro ligado. */
export function passaNiveis(nivel: string | null | undefined, niveis: readonly Nivel[] | undefined): boolean {
  if (!niveis || niveis.length === 0) return true;
  return !!nivel && (niveis as readonly string[]).includes(nivel);
}

/** "Nível Conforto" / "Nível Conforto ou Premium" (resumo dos filtros). */
export function rotuloFiltroNiveis(niveis: readonly Nivel[] | undefined): string | null {
  const validos = VALIDOS.filter((v) => niveis?.includes(v));
  if (!validos.length) return null;
  return `Nível ${validos.map((v) => ROTULO_NIVEL[v]).join(" ou ")}`;
}
