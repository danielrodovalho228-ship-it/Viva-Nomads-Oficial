/*
  PROP-3 (E116/E117) — rótulo do BLOCO do contrato, numa função só. Nenhum status cru ("pendente_aceite") chega à tela
  (cai no mapa único de status-humano) e um contrato que já não está ativo nunca mostra bloco "Em vigência".
  PURO, node --test.
*/
import { ROTULO_ETAPA, type EtapaContrato } from "./contrato-etapas.ts";
import { statusHumano } from "./status-humano.ts";

export interface RotuloBloco {
  label: string;
  tone: string;
}

export const BLOCO_STATUS: Record<string, RotuloBloco> = {
  agendado: { label: "Agendado", tone: "bg-surface-2 text-muted" },
  pendente_aceite: { label: "Aguardando aceite", tone: "bg-amber-50 text-amber-700" },
  ativo: { label: "Em vigência", tone: "bg-sage-100 text-forest" },
  renovado: { label: "Renovado", tone: "bg-blue-50 text-blue-700" },
  encerrado: { label: "Encerrado", tone: "bg-surface-2 text-muted" },
  encerrado_sem_renovacao: { label: "Encerrado (sem renovação)", tone: "bg-amber-50 text-amber-700" },
};

/**
 * @param contratoAtivo false quando o contrato já está encerrado/cancelado: o bloco que ficou "ativo" no banco vira
 *   "Encerrado" (o fechamento do contrato não mexe nos blocos).
 */
export function rotuloDoBloco(status: string, etapa: EtapaContrato | null = "em_vigencia", contratoAtivo = true): RotuloBloco {
  if (!contratoAtivo && (status === "ativo" || status === "agendado" || status === "pendente_aceite")) return BLOCO_STATUS.encerrado;
  // F33: bloco "ativo" sem assinatura/1º pagamento não pode aparecer como "Em vigência".
  if (status === "ativo" && etapa && etapa !== "em_vigencia") return { label: ROTULO_ETAPA[etapa], tone: "bg-amber-50 text-amber-700" };
  return BLOCO_STATUS[status] ?? { label: statusHumano(status), tone: "bg-surface-2 text-muted" };
}
