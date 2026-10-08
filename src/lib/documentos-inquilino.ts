/*
  DOCUMENTOS DO INQUILINO — regras PURAS (sem imports @/).

  Pacote "Cadastro confiável", parte B2 (Daniel, 08/10/2026): depois do ACEITE e
  antes do contrato, o inquilino envia a identidade e um comprovante de renda OU
  de vínculo (contrato de trabalho, carta da empresa, matrícula). Ficam no bucket
  privado; quem pode ver (o inquilino, o dono da candidatura e o admin) abre por
  link de 10 minutos. Agentes nunca abrem documentos (LGPD).
*/

export type TipoDocInquilino = "identidade" | "renda" | "vinculo";

export const DOCS_INQUILINO: { tipo: TipoDocInquilino; titulo: string; ajuda: string }[] = [
  { tipo: "identidade", titulo: "Documento de identidade", ajuda: "RG, CNH ou passaporte (frente e verso no mesmo arquivo)." },
  { tipo: "renda", titulo: "Comprovante de renda", ajuda: "Holerite, extrato ou declaração de imposto de renda recente." },
  { tipo: "vinculo", titulo: "Comprovante de vínculo", ajuda: "Contrato de trabalho, carta da empresa ou matrícula. Vale no lugar do comprovante de renda." },
];

export const tipoDocValido = (v: unknown): v is TipoDocInquilino => v === "identidade" || v === "renda" || v === "vinculo";

/** Identidade + (renda ou vínculo). */
export function documentosInquilinoCompletos(tipos: Iterable<string>): boolean {
  const t = new Set(tipos);
  return t.has("identidade") && (t.has("renda") || t.has("vinculo"));
}

export const MSG_DOCS_INQUILINO =
  "O inquilino ainda não enviou os documentos (identidade e comprovante de renda ou vínculo). Ele envia em Minhas candidaturas; o contrato precisa deles.";

/** Caminho no bucket privado: <tenant_id>/<lead_id>/<uuid>.<ext>. */
export function caminhoDocInquilino(tenantId: string, leadId: string, arquivoId: string, ext: "pdf" | "jpg" | "png"): string {
  return `${tenantId}/${leadId}/${arquivoId}.${ext}`;
}
