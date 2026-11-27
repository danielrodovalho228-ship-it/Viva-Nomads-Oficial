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
