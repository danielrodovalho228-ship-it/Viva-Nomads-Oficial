/**
 * Número PÚBLICO do contrato — uma função só (complemento do #884, 19/10): "VN-CT-11281A61". O mesmo na lista de
 * contratos, no PDF, no e-mail, na fila do admin e na conferência pública (o banco usa a mesma regra em
 * conferir_documento, 0182). Puro.
 */
export function numeroPublicoContrato(contratoId: string | null | undefined): string {
  return contratoId ? `VN-CT-${contratoId.slice(0, 8).toUpperCase()}` : "Contrato não encontrado";
}

/**
 * E543: numa lista, dois contratos com o MESMO número público (os 8 primeiros hex do id coincidem — hoje só o par da
 * massa 0268, E331) ganham o desempate com o fim do id ("VN-CT-A0268B00 · id …0011"). O número público não muda (é a
 * identidade dos documentos já emitidos); só a linha deixa de parecer duplicada.
 */
export function numerosDaLista(ids: readonly string[]): Map<string, string> {
  const vezes = new Map<string, number>();
  for (const id of ids) vezes.set(numeroPublicoContrato(id), (vezes.get(numeroPublicoContrato(id)) ?? 0) + 1);
  return new Map(ids.map((id) => {
    const n = numeroPublicoContrato(id);
    return [id, (vezes.get(n) ?? 0) > 1 ? `${n} · id …${id.slice(-4)}` : n];
  }));
}
