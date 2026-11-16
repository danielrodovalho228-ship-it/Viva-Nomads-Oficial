/*
  E969 — a conversa encerra (definição do coordenador, 15/11, RELATORIO-DUET-068 + regra final). PURO.
  • Sem contrato: encerra quando a candidatura que a originou termina (recusada, expirada sem reabertura ou cancelada).
  • Com contrato: encerra no que vier POR ÚLTIMO entre o fechamento do processo da caução (devolução concluída e contestação
    resolvida) e o fim da estadia + DIAS_PRAZO_AVALIACAO (src/lib/avaliacoes.ts — nunca um número à mão). Sem caução: no
    fim da estadia + DIAS_PRAZO_AVALIACAO. Processo da caução aberto: não encerra. Sem piso de 30 dias (vetado).
  • Quem vê: faixa "Esta conversa foi encerrada em {data}. O histórico continua disponível.", sem campo de envio; para o
    morador o motivo é neutro (a faixa não diz motivo).
  • Candidatura NOVA do mesmo morador ao mesmo imóvel reabre a MESMA conversa (id fixo pessoa+pessoa+imóvel), com o
    separador "Nova candidatura em {data}".
*/
import { DIAS_PRAZO_AVALIACAO } from "../avaliacoes.ts";
import { addDiasCorridos } from "../caucao.ts";

/** Fim da candidatura SEM contrato: estas situações encerram a conversa. */
export const STATUS_QUE_ENCERRAM = new Set(["rejected", "expired", "cancelled", "canceled", "withdrawn"]);

const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
export const textoConversaEncerrada = (diaIso: string) => `Esta conversa foi encerrada em ${dataBR(diaIso)}. O histórico continua disponível.`;
export const MSG_CONVERSA_ENCERRADA = "Esta conversa foi encerrada. O histórico continua disponível, mas não recebe mensagens novas.";
export const textoNovaCandidatura = (diaIso: string) => `Nova candidatura em ${dataBR(diaIso.slice(0, 10))}`;

/**
 * Com contrato: o dia (AAAA-MM-DD) em que a conversa encerra, ou null enquanto o processo da caução estiver aberto.
 * `fimProcessoCaucao` = o dia em que o processo fechou (devolução concluída, sem contestação aberta), ou null.
 */
export function encerraComContrato(f: { fimEstadia: string; comCaucao: boolean; fimProcessoCaucao: string | null }): string | null {
  const fimAvaliacao = addDiasCorridos(f.fimEstadia.slice(0, 10), DIAS_PRAZO_AVALIACAO);
  if (!f.comCaucao) return fimAvaliacao;
  if (!f.fimProcessoCaucao) return null;
  const fimCaucao = f.fimProcessoCaucao.slice(0, 10);
  return fimCaucao > fimAvaliacao ? fimCaucao : fimAvaliacao;
}

export interface CandidaturaDaConversa {
  criadaEm: string;
  status: string;
  /** Quando terminou sem contrato (rejected_at…); null enquanto aberta ou aceita. */
  terminouEm?: string | null;
  /** Com contrato: o fim da estadia e o estado do processo da caução. */
  contrato?: { fimEstadia: string | null; comCaucao: boolean; fimProcessoCaucao: string | null } | null;
}

export interface EstadoDaConversa {
  /** Dia (AAAA-MM-DD) em que encerrou; null = aberta. */
  encerradaEm: string | null;
  /** Instantes (ISO) das candidaturas que reabriram a conversa — o separador "Nova candidatura em {data}". */
  novasCandidaturas: string[];
}

/** A conversa vale pela candidatura MAIS RECENTE: uma nova reabre a mesma conversa. */
export function estadoDaConversa(cands: CandidaturaDaConversa[], hoje: string): EstadoDaConversa {
  const ord = [...cands].sort((a, b) => a.criadaEm.localeCompare(b.criadaEm));
  const novasCandidaturas = ord.slice(1).map((c) => c.criadaEm);
  const ultima = ord.at(-1);
  if (!ultima) return { encerradaEm: null, novasCandidaturas };
  const dia = hoje.slice(0, 10);
  let fim: string | null = null;
  if (ultima.contrato) {
    fim = ultima.contrato.fimEstadia ? encerraComContrato({ fimEstadia: ultima.contrato.fimEstadia, comCaucao: ultima.contrato.comCaucao, fimProcessoCaucao: ultima.contrato.fimProcessoCaucao }) : null;
  } else if (STATUS_QUE_ENCERRAM.has(ultima.status)) {
    fim = (ultima.terminouEm ?? ultima.criadaEm).slice(0, 10);
  }
  return { encerradaEm: fim && fim <= dia ? fim : null, novasCandidaturas };
}
