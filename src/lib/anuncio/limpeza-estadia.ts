/**
 * Pacote de limpeza durante a estadia (ordem 4c74ac38, item 3). Puro: sem banco, sem tela.
 * O proprietário define quantas limpezas por mês, o que cada uma inclui e o valor do pacote por mês.
 * A validação roda no servidor; a tela só repete para avisar cedo.
 */

export const QTDS_LIMPEZA = [0, 1, 2, 4] as const;
export const MAX_TEXTO_LIMPEZA = 200;
export const MAX_VALOR_LIMPEZA = 100000;

export interface LimpezaEstadia {
  /** Limpezas incluídas por mês (1, 2 ou 4; 0 = sem pacote, guardado como null). */
  porMes: number;
  /** O que cada limpeza inclui, texto curto (pode ficar vazio). */
  inclui: string;
  /** Valor do pacote por mês, em R$. 0 = já incluído no valor mensal. */
  valorMes: number;
}

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");
}

/** Aceita só o formato esperado; 0 limpezas e qualquer outra coisa viram null. */
export function normalizarLimpezaEstadia(raw: unknown): LimpezaEstadia | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const porMes = Number(r.porMes);
  if (!QTDS_LIMPEZA.some((q) => q === porMes) || porMes === 0) return null;
  const texto =
    typeof r.inclui === "string" ? r.inclui.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "";
  if (texto.length > MAX_TEXTO_LIMPEZA) return null;
  const bruto = r.valorMes == null || r.valorMes === "" ? 0 : Number(typeof r.valorMes === "string" ? r.valorMes.replace(",", ".") : r.valorMes);
  if (!Number.isFinite(bruto) || bruto < 0 || bruto > MAX_VALOR_LIMPEZA) return null;
  return { porMes, inclui: texto, valorMes: Math.round(bruto * 100) / 100 };
}

/** Texto do anúncio, da proposta e do resumo do contrato: a quantidade sempre explícita. */
export function textoLimpezaEstadia(l: LimpezaEstadia): string {
  const qtd = l.porMes === 1 ? "1 limpeza por mês" : `${l.porMes} limpezas por mês`;
  const inclui = l.inclui ? ` (${l.inclui})` : "";
  const valor =
    l.valorMes > 0
      ? `${brl(l.valorMes)} por mês`
      : l.porMes === 1
        ? "incluída no valor mensal"
        : "incluídas no valor mensal";
  return `${qtd}${inclui} — ${valor}`;
}

export function linhaLimpezaResumo(l: LimpezaEstadia): string {
  return `Limpeza durante a estadia — ${textoLimpezaEstadia(l)}`;
}

/**
 * Pacote que entra no resumo do contrato. Antes de qualquer assinatura vale o do anúncio (ao vivo);
 * depois da primeira, só o congelado no contrato, para as duas partes assinarem o mesmo texto/hash.
 * Contrato sem o dado congelado (anterior a esta regra) fica sem a linha, como era quando assinou.
 */
export function limpezaDoResumo(d: { algumaAssinatura: boolean; viva: unknown; congelada: unknown }): LimpezaEstadia | null {
  return normalizarLimpezaEstadia(d.algumaAssinatura ? d.congelada : d.viva);
}
