/*
  Fila "Documentos com falha" legível (complemento do #880, reteste do Muse). Puro (node --test): cada linha mostra,
  antes do clique, o número do documento, o tipo, o contrato (VN-CT-…), o nome curto do proprietário e do inquilino,
  o motivo e a data. A chave da linha é o documento (sem documento ainda: o pagamento ou o acerto), então duas linhas
  iguais não existem.
*/
import { numeroPublicoContrato } from "../contrato-ref.ts";
import { ROTULO_TIPO, type TipoDocumento } from "./documento.ts";

/** Mesmo formato da lista de contratos: "VN-CT-11281A61". */
export function refContratoVN(contratoId: string | null | undefined): string {
  return numeroPublicoContrato(contratoId);
}

/** Tipo pela emissão (documento) ou, sem documento, pela origem (pagamento de caução, aluguel ou devolução). */
export function tipoDaFalha(p: { docTipo?: string | null; pagamentoTipo?: string | null; acerto?: boolean }): string {
  if (p.docTipo && p.docTipo in ROTULO_TIPO) return ROTULO_TIPO[p.docTipo as TipoDocumento];
  if (p.acerto) return ROTULO_TIPO.termo_devolucao_caucao;
  return p.pagamentoTipo === "caucao" ? ROTULO_TIPO.comprovante_caucao : ROTULO_TIPO.recibo_aluguel;
}

export interface ChaveFalha {
  documentoId: string | null;
  pagamentoId: string | null;
  acertoId: string | null;
  atualizadoEm: string;
}

/** A chave é o documento; sem documento, a origem. */
export function chaveDaFalha(f: Pick<ChaveFalha, "documentoId" | "pagamentoId" | "acertoId">): string {
  return f.documentoId ? `doc:${f.documentoId}` : f.pagamentoId ? `pag:${f.pagamentoId}` : `ac:${f.acertoId}`;
}

/** Uma linha por chave (fica a mais recente). */
export function umaLinhaPorDocumento<T extends ChaveFalha>(falhas: T[]): T[] {
  const porChave = new Map<string, T>();
  for (const f of falhas) {
    const k = chaveDaFalha(f);
    const atual = porChave.get(k);
    if (!atual || f.atualizadoEm > atual.atualizadoEm) porChave.set(k, f);
  }
  return falhas.filter((f) => porChave.get(chaveDaFalha(f)) === f);
}
