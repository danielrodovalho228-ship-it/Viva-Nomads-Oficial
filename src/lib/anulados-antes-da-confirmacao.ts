import { componentesDoPagamento, parteDaColuna } from "./pagamento-componentes.ts";
import { textoLinhaSemDocumento } from "./documentos-linha.ts";

/**
 * E1241 (MAPA-E1241, dúvida 1): o registro anulado ANTES da confirmação do morador — a linha que dono e morador viam
 * nas listas de pagamentos, agora com o selo. Caminho ao lado: nunca entra na lista de pagamentos (totais, o que falta
 * pagar e a numeração das partes continuam sem ele). Decide a data da anulação; o motivo aparece quando houver.
 */
export interface AnuladoAntesDaConfirmacao {
  id: string;
  rotulo: string;
  motivo: string | null;
}

export function anuladosAntesDaConfirmacao(rows: Record<string, unknown>[], rotuloDe: (r: Record<string, unknown>) => string): AnuladoAntesDaConfirmacao[] {
  return rows
    .filter((r) => r.anulado_em && !r.confirmado_pelo_inquilino)
    .map((r) => {
      const motivo = typeof r.anulado_motivo === "string" ? r.anulado_motivo.trim() : "";
      return { id: String(r.id), rotulo: rotuloDe(r), motivo: motivo || null };
    });
}

/** "Anulado: registro em duplicidade"; sem motivo gravado, "Anulado". */
export const textoDoSeloAnulado = (motivo: string | null): string => (motivo ? `Anulado: ${motivo}` : "Anulado");

/**
 * E1241 (ORDEM-DUET 1237): a linha do registro anulado antes da confirmação — a forma curta da gramática do coordenador
 * ("Bloco 2 · R$ 6.400,00 · 20/12 a 19/01"; o complementar diz "registro complementar", pela coluna parte), com o TOTAL
 * do registro (na caução os encargos não contam). Sem número: o registro nunca teve documento.
 */
export function linhaDoAnulado(pg: Record<string, unknown>): string {
  const tipo = String(pg.tipo ?? "aluguel");
  const b = pg.contrato_blocos as { numero_bloco?: number | null; inicio?: string | null; fim?: string | null } | null | undefined;
  const total = componentesDoPagamento({ valor: Number(pg.valor) || 0, encargos: tipo === "caucao" ? [] : pg.encargos }).total;
  return textoLinhaSemDocumento({ tipo, total, inicio: b?.inicio ?? null, fim: b?.fim ?? null, bloco: b?.numero_bloco ? Number(b.numero_bloco) : null, parte: tipo === "caucao" ? 1 : parteDaColuna(pg.parte) });
}
