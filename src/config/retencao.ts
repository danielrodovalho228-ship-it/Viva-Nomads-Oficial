/*
  Prazos de guarda dos documentos por prefixo (Prompt 56, item 7) — constante ÚNICA.
  Todo prazo está "pendente – item 13 da Dra. Beatriz", menos a lista da portaria (90 dias depois do fim do contrato,
  Prompt 32). Nenhuma rotina apaga documento com prazo pendente: podeApagarDocumento() responde false para ele.
*/
import type { Prefixo } from "../lib/fiscal/prefixos.ts";

export const PENDENTE_ITEM_13 = "pendente – item 13 da Dra. Beatriz";

export interface PrazoRetencao {
  /** Dias de guarda depois do fim do contrato/pedido; null enquanto o prazo estiver pendente. */
  dias: number | null;
  situacao: typeof PENDENTE_ITEM_13 | "definido";
  origem?: string;
}

const pendente: PrazoRetencao = { dias: null, situacao: PENDENTE_ITEM_13 };

export const RETENCAO_DOCUMENTOS: Record<Prefixo, PrazoRetencao> = {
  ORC: pendente,
  "VN-CT": pendente,
  "VN-SV": pendente,
  REC: pendente,
  CAU: pendente,
  DEV: pendente,
  PRV: pendente,
  CND: pendente,
  PRT: { dias: 90, situacao: "definido", origem: "Prompt 32 (ocupantes da lista da portaria)" },
  ENC: pendente,
  INF: pendente,
  RPG: pendente,
  RSV: pendente,
  REG: pendente,
  NFSE: pendente,
};

/** Só um prazo definido permite apagar — e só depois de vencido. Prazo pendente: nunca. */
export function podeApagarDocumento(prefixo: Prefixo, diasDesdeOFim: number): boolean {
  const r = RETENCAO_DOCUMENTOS[prefixo];
  return r.situacao === "definido" && r.dias !== null && diasDesdeOFim > r.dias;
}
