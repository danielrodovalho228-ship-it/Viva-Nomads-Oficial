/**
 * Vocabulário e regras da CONFERÊNCIA de documentos do imóvel (fila de moderação
 * do admin). Fonte única — a UI do admin e os testes leem daqui.
 *
 * IMPORTANTE (jurídico): conferimos o DOCUMENTO enviado (legibilidade, titular,
 * imóvel, validade) — NÃO atestamos propriedade nem garantimos o imóvel. Por
 * isso o selo ao dono é "Documentação conferida", nunca "propriedade verificada".
 */

/** Itens que o admin marca antes de aprovar. Aprovar exige TODOS marcados. */
export const CHECKLIST_CONFERENCIA = [
  { key: "titular", label: "Nome do titular confere com o da conta" },
  { key: "imovel", label: "Endereço/imóvel do documento confere com o cadastro" },
  { key: "legivel", label: "Documento legível e completo (sem cortes)" },
  { key: "validade", label: "Dentro da validade / atualizado" },
] as const;

export type ChecklistKey = (typeof CHECKLIST_CONFERENCIA)[number]["key"];

/** Motivos de recusa estruturados (dropdown). "outro" exige detalhe livre. */
export const MOTIVOS_RECUSA = [
  { value: "ilegivel", label: "Documento ilegível ou incompleto" },
  { value: "nao_corresponde", label: "Não corresponde ao imóvel do cadastro" },
  { value: "titular_diverge", label: "Titular do documento diverge da conta" },
  { value: "vencido", label: "Documento vencido / desatualizado" },
  { value: "tipo_invalido", label: "Tipo de documento não aceito" },
  { value: "duplicado", label: "Arquivo já utilizado em outro cadastro" },
  { value: "outro", label: "Outro (descreva)" },
] as const;

export type MotivoRecusa = (typeof MOTIVOS_RECUSA)[number]["value"];

/** Todos os itens da conferência marcados? (portão do Aprovar). */
export function conferenciaCompleta(marcados: Record<string, boolean>): boolean {
  return CHECKLIST_CONFERENCIA.every((i) => marcados[i.key] === true);
}

/**
 * Monta o texto final da recusa a partir do motivo escolhido (+ detalhe livre).
 * O detalhe é obrigatório quando o motivo é "outro"; nos demais, complementa.
 * Devolve `null` quando falta informação (motivo vazio, ou "outro" sem detalhe).
 */
export function comporMotivoRecusa(motivo: string, detalhe?: string): string | null {
  const det = (detalhe ?? "").trim();
  if (!motivo) return null;
  if (motivo === "outro") return det || null;
  const item = MOTIVOS_RECUSA.find((m) => m.value === motivo);
  if (!item) return det || null;
  return det ? `${item.label} — ${det}` : item.label;
}

export type VisualizacaoDoc = "imagem" | "pdf" | "outro";

/** Como exibir o documento inline a partir do caminho/arquivo no bucket. */
export function tipoVisualizacaoDoc(pathOrName: string | null | undefined): VisualizacaoDoc {
  if (!pathOrName) return "outro";
  const ext = pathOrName.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp") return "imagem";
  return "outro";
}
