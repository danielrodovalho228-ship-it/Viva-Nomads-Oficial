/*
  Etapa do contrato (ordem de412a9c, F33). Um contrato NUNCA aparece "Em vigência"
  sem as duas assinaturas e sem o 1º pagamento confirmado pelas duas partes:
    Aguardando assinatura → Aguardando 1º pagamento → Em vigência.
  Só vale para contratos com status "ativo" (os encerrados/cancelados mantêm o rótulo próprio).
*/

export type EtapaContrato = "aguardando_assinatura" | "aguardando_pagamento" | "em_vigencia";

export interface EntradaEtapa {
  assinadoProprietarioEm?: string | null;
  assinadoInquilinoEm?: string | null;
  /** 1º pagamento declarado pelo proprietário E confirmado pelo inquilino. */
  primeiroPagamentoConfirmado: boolean;
}

export function etapaContrato(e: EntradaEtapa): EtapaContrato {
  if (!e.assinadoProprietarioEm || !e.assinadoInquilinoEm) return "aguardando_assinatura";
  if (!e.primeiroPagamentoConfirmado) return "aguardando_pagamento";
  return "em_vigencia";
}

export const ROTULO_ETAPA: Record<EtapaContrato, string> = {
  aguardando_assinatura: "Aguardando assinatura",
  aguardando_pagamento: "Aguardando 1º pagamento",
  em_vigencia: "Em vigência",
};

/** Marca obrigatória no topo de todo contrato gerado, enquanto o parecer jurídico não chega. */
export const MARCA_MINUTA = "MINUTA DE TESTE — sem validade";

/** Texto quando a assinatura digital (ZapSign) não está ligada. */
export const MSG_ASSINATURA_INATIVA = "Assinatura digital ainda não ativa — contrato em modo de teste.";
