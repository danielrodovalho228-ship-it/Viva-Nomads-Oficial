/*
  Marcas "Visto" / "Você já contatou" e pedido pré-preenchido (ordem 8302024d, pacote Próximo do FF 1/3).
  Regras puras, sem banco: o cartão, a página do imóvel e os testes usam as mesmas.
*/
import { validarInicioEstadia } from "../inicio-estadia.ts";

export interface Marca {
  vistoEm: string | null;
  contatadoEm: string | null;
}

export type RotuloMarca = "Visto" | "Você já contatou";

/** "Você já contatou" (dúvida, visita ou candidatura) vence "Visto". Sem marca: nada aparece. */
export function rotuloMarca(m: Marca | undefined | null): RotuloMarca | null {
  if (!m) return null;
  if (m.contatadoEm) return "Você já contatou";
  if (m.vistoEm) return "Visto";
  return null;
}

export interface LinhaMarca {
  imovel_id: string;
  visto_em: string | null;
  contatado_em: string | null;
}

export function mapaDeMarcas(linhas: LinhaMarca[]): Record<string, Marca> {
  const out: Record<string, Marca> = {};
  for (const l of linhas) {
    if (!l.imovel_id) continue;
    out[l.imovel_id] = { vistoEm: l.visto_em, contatadoEm: l.contatado_em };
  }
  return out;
}

/** Chave do navegador onde a busca guarda a última data de entrada e o período (só no aparelho). */
export const CHAVE_ULTIMA_BUSCA = "vn:ultima-busca";

/** Chave do navegador onde o pedido guarda o último motivo da estadia (só no aparelho). */
export const CHAVE_ULTIMO_MOTIVO = "vn:ultimo-motivo";

export function serializarUltimaBusca(b: { inicio: string; meses: number; pessoas?: number }): string {
  return JSON.stringify({ inicio: b.inicio, meses: b.meses, pessoas: b.pessoas ?? 0 });
}

/** Lê o que a última busca guardou. Data vencida/estranha e período fora de 1–12 meses são descartados. */
export function ultimaBuscaParaPedido(raw: string | null, hoje: string): { inicio: string; meses: number; pessoas: number } {
  let o: unknown = null;
  try {
    o = raw ? JSON.parse(raw) : null;
  } catch {
    o = null;
  }
  const r = (o && typeof o === "object" ? o : {}) as { inicio?: unknown; meses?: unknown; pessoas?: unknown };
  const inicio = validarInicioEstadia(r.inicio, hoje).ok ? (r.inicio as string).trim() : "";
  const meses = typeof r.meses === "number" && Number.isInteger(r.meses) && r.meses >= 1 && r.meses <= 12 ? r.meses : 0;
  const pessoas = typeof r.pessoas === "number" && Number.isInteger(r.pessoas) && r.pessoas >= 1 && r.pessoas <= 20 ? r.pessoas : 0;
  return { inicio, meses, pessoas };
}

/** Último motivo de estadia guardado no aparelho. Só vale se ainda for um motivo conhecido (lixo ou chave velha: ""). */
export function ultimoMotivoParaPedido(raw: string | null, valido: (chave: string) => boolean): string {
  const k = (raw ?? "").trim();
  return k && valido(k) ? k : "";
}
