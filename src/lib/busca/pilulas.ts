import { OPCOES_ESTADIA, OPCOES_PRECO, OPCOES_TIPO, type FiltrosPainel } from "./painel-filtros.ts";
import { ROTULO_NIVEL } from "../../config/niveis.ts";

export type IdPilula = "datas" | "local" | "tipo" | "preco" | "nivel" | "ordenar";

/** E82-A: a ordem do mockup BUSCA-CARD — uma linha só. */
export const ORDEM_PILULAS = ["datas", "local", "tipo", "preco", "nivel", "mais", "ordenar", "mapa"] as const;

export const ROTULO_PILULA: Record<IdPilula, string> = { datas: "Datas", local: "Local", tipo: "Tipo", preco: "Preço", nivel: "Nível", ordenar: "Ordenar" };

/** O valor de cada pílula quando ativa ("Até R$ 3.500", "Conforto+", "Perto de HC-UFU"); null = rótulo neutro. */
export function valorDaPilula(id: IdPilula, f: FiltrosPainel, extra: { local?: string; perto?: string | null; ordem?: string | null }): string | null {
  if (id === "datas") {
    const partes = [f.entrada ? `Entrada ${f.entrada.split("-").reverse().slice(0, 2).join("/")}` : "", OPCOES_ESTADIA.find((o) => o.valor === f.periodo)?.rotulo ?? ""].filter(Boolean);
    return partes.length ? partes.join(" · ") : null;
  }
  if (id === "local") return extra.perto ? `Perto de ${extra.perto}` : extra.local?.trim() || null;
  if (id === "tipo") return OPCOES_TIPO.find((o) => o.valor === f.tipo)?.rotulo ?? null;
  if (id === "preco") return OPCOES_PRECO.find((o) => o.valor === f.maxPrice)?.rotulo ?? (f.maxPrice ? `Até R$ ${f.maxPrice.toLocaleString("pt-BR")}` : null);
  if (id === "nivel") return f.nivelMin ? (f.nivelMin === "premium" ? ROTULO_NIVEL.premium : `${ROTULO_NIVEL[f.nivelMin]}+`) : null;
  return extra.ordem ?? null;
}
