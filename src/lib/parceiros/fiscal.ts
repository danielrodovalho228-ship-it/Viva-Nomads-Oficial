/*
  FISCAL-PARCEIRO-B (E24) — documento do serviço do parceiro e documento da taxa da Viva. PURO, node --test.
  A nota fiscal de serviço (ou o recibo, quando PF) é do PARCEIRO, para o cliente; a Viva emite o documento só da
  própria taxa. A pergunta é OBRIGATÓRIA na trilha PJ (MEI conta como PJ) — não é chave nem opção escondida.
  Fonte única para as telas da Pista A e para o filtro da busca.
*/
import { NFSE_ATIVA } from "../flags.ts";
import { PREFIXOS } from "../fiscal/prefixos.ts";

export const PERGUNTA_NOTA = "Você emite nota fiscal de serviço para o cliente?";
export const PENDENCIA_NOTA = "Responda se você emite nota fiscal de serviço para o cliente.";
export const MOTIVO_NOTA_NAO_EMITIDA = "Não emitiu a nota fiscal declarada";
export const ROTULO_FILTRO_NOTA = "Emite nota fiscal";

export type DocumentoServico = "nota" | "recibo" | null;
export type DocumentoTaxaViva = "nfse" | "comprovante" | null;

export interface ParceiroFiscal {
  tipoPessoa?: string | null;
  emiteNota?: boolean | null;
}

/** O que o cliente recebe do parceiro: PF → recibo; PJ que declarou emitir → nota; PJ sem resposta ou "não" → null. */
export function documentoDoServico(p: ParceiroFiscal): DocumentoServico {
  if (p.tipoPessoa === "pf") return "recibo";
  if (p.tipoPessoa === "pj" && p.emiteNota === true) return "nota";
  return null;
}

/** Geradores da Viva: a NFS-e só com NFSE_ATIVA; o comprovante (RPG) só quando o prefixo deixar de ser reservado. */
export const GERADOR_RPG: boolean = !("reservado" in PREFIXOS.RPG && PREFIXOS.RPG.reservado);

/**
 * Documento da taxa da Viva: 'nfse' com NFSE_ATIVA ligada; senão 'comprovante' se o gerador RPG existir; senão null.
 * Na main de hoje: null (RPG e NFS-e só reservados em fiscal/prefixos.ts). Nenhum gerador é ligado aqui.
 */
export function documentoDaTaxaViva(estado: { nfseAtiva: boolean; geradorRpg: boolean } = { nfseAtiva: NFSE_ATIVA, geradorRpg: GERADOR_RPG }): DocumentoTaxaViva {
  if (estado.nfseAtiva) return "nfse";
  if (estado.geradorRpg) return "comprovante";
  return null;
}

/** PJ que ainda não respondeu: pendência no painel (não tira do ar o que já está publicado). */
export function faltaRespostaNota(p: ParceiroFiscal): boolean {
  return p.tipoPessoa === "pj" && typeof p.emiteNota !== "boolean";
}

/**
 * Valor a gravar (servidor; nada do navegador é confiado): PJ exige Sim/Não; PF grava sempre null.
 * `invalido` = PJ sem resposta booleana — o cadastro não conclui.
 */
export function emiteNotaParaGravar(tipoPessoa: string | null | undefined, resposta: unknown): { ok: true; valor: boolean | null } | { ok: false; erro: string } {
  if (tipoPessoa === "pf") return { ok: true, valor: null };
  if (tipoPessoa !== "pj") return { ok: false, erro: "Escolha pessoa física ou jurídica." };
  if (typeof resposta !== "boolean") return { ok: false, erro: `${PERGUNTA_NOTA} Responda Sim ou Não.` };
  return { ok: true, valor: resposta };
}

/** Filtro "Emite nota fiscal" da busca: pela mesma função do documento do serviço. */
export function passaFiltroNota(p: ParceiroFiscal, soNota: boolean): boolean {
  return !soNota || documentoDoServico(p) === "nota";
}
