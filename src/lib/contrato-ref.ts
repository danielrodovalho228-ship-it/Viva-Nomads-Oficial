/**
 * Número PÚBLICO do contrato — uma função só (complemento do #884, 19/10): "VN-CT-11281A61". O mesmo na lista de
 * contratos, no PDF, no e-mail, na fila do admin e na conferência pública (o banco usa a mesma regra em
 * conferir_documento, 0182). Puro.
 */
export function numeroPublicoContrato(contratoId: string | null | undefined): string {
  return contratoId ? `VN-CT-${contratoId.slice(0, 8).toUpperCase()}` : "Contrato não encontrado";
}
