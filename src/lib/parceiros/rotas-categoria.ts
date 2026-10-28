/*
  E187 — endereços "naturais" de categoria de parceiro (/parceiros/limpeza, /parceiros/montagem…). A busca de verdade é
  /parceiros/buscar?categoria=<valor>; /parceiros/fotografos tem página própria. Seguros e gestores não são categorias
  da busca: vão aos tipos de parceria em /parceiros. PURO (node --test). Só vale quando não há parceiro com esse
  endereço (a página do parceiro tem prioridade).
*/
import { categoriaValida } from "./regras.ts";

/** Plurais e apelidos → valor da categoria do catálogo. */
const APELIDOS: Record<string, string> = {
  limpezas: "limpeza",
  faxina: "limpeza",
  lavanderias: "lavanderia",
  montagens: "montagem",
  "montagem-de-moveis": "montagem",
  mudancas: "mudanca",
  manutencoes: "manutencao",
  reparos: "manutencao",
  outros: "outro",
};

const PARA_FOTOGRAFOS = new Set(["fotografia", "fotografo", "fotografa", "fotografas"]);
const PARA_TIPOS = new Set(["seguros", "seguro", "gestores", "gestor", "administradoras", "administradora"]);

/** O destino de /parceiros/<slug> quando o slug é uma categoria; null quando não é (segue o 404 de sempre). */
export function destinoDaCategoria(slug: string): string | null {
  const s = decodeURIComponent(slug).trim().toLowerCase();
  if (PARA_FOTOGRAFOS.has(s)) return "/parceiros/fotografos";
  if (PARA_TIPOS.has(s)) return "/parceiros#tipos";
  const valor = APELIDOS[s] ?? s;
  return categoriaValida(valor) ? `/parceiros/buscar?categoria=${valor}` : null;
}
