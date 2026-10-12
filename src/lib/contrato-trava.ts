/*
  F32 (ordem de412a9c) — trava única do contrato, PURA e testável. Usada por
  /api/contrato (carregarFechamento) E por registrarContrato: nenhum caminho gera
  contrato sem o documento das DUAS partes e sem os documentos do inquilino.
*/
import { documentoCompleto, MSG_DOCUMENTO, type PerfilDocumento } from "./documento-pessoa.ts";
import { MSG_DOCS_INQUILINO } from "./documentos-inquilino.ts";

export interface BloqueioContrato {
  status: number;
  erro: string;
}

/**
 * `docsInquilinoCompletos` null = a tabela de documentos ainda não existe (não dá
 * para saber) → não trava por isso. Devolve o bloqueio, ou null se pode gerar.
 */
export function motivoBloqueioContrato(i: {
  dono: PerfilDocumento | null | undefined;
  inquilino: PerfilDocumento | null | undefined;
  docsInquilinoCompletos: boolean | null;
}): BloqueioContrato | null {
  if (!documentoCompleto(i.dono)) return { status: 409, erro: MSG_DOCUMENTO.fecharDono };
  if (!documentoCompleto(i.inquilino)) return { status: 409, erro: MSG_DOCUMENTO.fecharInquilino };
  if (i.docsInquilinoCompletos === false) return { status: 409, erro: MSG_DOCS_INQUILINO };
  return null;
}
