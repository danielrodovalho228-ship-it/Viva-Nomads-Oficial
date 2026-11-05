/*
  E-DOC-VIGENTE (Relay 47, decisão do Daniel de 02/11/2026: "Manter o aprovado até o novo ser aprovado"). PURO.
  Dois estados separados, a partir das linhas de qualification_checklists de UM imóvel (mais recente primeiro):
  - VIGENTE: a linha APROVADA mais recente. É ela que vale para publicar, para o selo e para o que o dono vê.
  - EM ANÁLISE: um envio pendente mais novo que o vigente. Não substitui, não suspende e não rebaixa o vigente.
  A troca acontece SÓ quando o novo é aprovado (passa a ser a aprovada mais recente). Novo recusado: o vigente segue.
  Sem nenhuma aprovada, vale a linha mais recente (o fluxo de sempre: nenhum, em análise ou recusado).
*/
export type StatusDocumento = "none" | "pending" | "approved" | "rejected";

export interface LinhaDocumento {
  document_status: string | null;
  document_review_reason?: string | null;
}

export interface EstadoDocumentos<T extends LinhaDocumento> {
  /** A aprovada mais recente (o documento que vale), ou null. */
  vigente: T | null;
  /** Envio pendente mais novo que o vigente (só existe com vigente). */
  emAnalise: T | null;
  /** O envio mais novo que o vigente foi recusado (só existe com vigente): o vigente segue valendo. */
  novoRecusado: T | null;
  /** A linha que define o estado: o vigente, ou (sem vigente) a mais recente. */
  linha: T | null;
  /** O estado que vale para publicar, para o selo e para a tela. */
  status: StatusDocumento;
  /** A linha mais recente (com ou sem vigente). */
  ultima: T | null;
}

const STATUS: readonly string[] = ["none", "pending", "approved", "rejected"];
const comoStatus = (s: string | null | undefined): StatusDocumento => (STATUS.includes(String(s)) ? (s as StatusDocumento) : "none");

/** `linhas`: as qualificações de UM imóvel, da mais recente para a mais antiga. */
export function estadoDocumentos<T extends LinhaDocumento>(linhas: readonly T[]): EstadoDocumentos<T> {
  const i = linhas.findIndex((l) => l.document_status === "approved");
  if (i < 0) {
    const ultima = linhas[0] ?? null;
    return { vigente: null, emAnalise: null, novoRecusado: null, linha: ultima, status: comoStatus(ultima?.document_status), ultima };
  }
  const vigente = linhas[i];
  // O que veio DEPOIS do vigente (índices menores): o envio novo mais recente decide se está em análise ou recusado.
  const novo = linhas.slice(0, i).find((l) => l.document_status === "pending" || l.document_status === "rejected") ?? null;
  return {
    vigente,
    emAnalise: novo?.document_status === "pending" ? novo : null,
    novoRecusado: novo?.document_status === "rejected" ? novo : null,
    linha: vigente,
    status: "approved",
    ultima: linhas[0],
  };
}

/** Por imóvel, a partir de linhas de vários imóveis (cada uma com property_id), já da mais recente para a mais antiga. */
export function statusPorImovel<T extends LinhaDocumento & { property_id: string | null }>(linhas: readonly T[]): Map<string, StatusDocumento> {
  const grupos = new Map<string, T[]>();
  for (const l of linhas) {
    if (!l.property_id) continue;
    const g = grupos.get(l.property_id) ?? [];
    g.push(l);
    grupos.set(l.property_id, g);
  }
  return new Map([...grupos].map(([id, g]) => [id, estadoDocumentos(g).status]));
}

/** Estado que vale depois de um envio novo na tela: com aprovado vigente, segue aprovado (o novo fica à parte). */
/** Linhas a ligar a um imóvel recém-criado: a mais recente (o fluxo de sempre) e, se for outra, a vigente. */
export function linhasParaLigar<T extends LinhaDocumento & { id: string }>(e: EstadoDocumentos<T>): string[] {
  return [...new Set([e.ultima?.id, e.vigente?.id].filter((x): x is string => !!x))];
}

export function statusDepoisDoEnvio(vigenteAprovado: boolean, statusDoNovo: StatusDocumento): StatusDocumento {
  return vigenteAprovado ? "approved" : statusDoNovo;
}

export const TEXTO_NOVO_EM_ANALISE = "Documento novo em análise. O aprovado continua valendo até o novo ser aprovado.";
export const TEXTO_NOVO_RECUSADO = "O documento novo foi recusado. O aprovado continua valendo.";

/*
  E587: a TELA do cadastro segue o mesmo desenho. O resultado da conferência automática de um envio novo nunca toma o
  lugar do aprovado vigente: a tela segue "conferida" e o novo aparece à parte (em análise ou recusado). Sem vigente,
  o resultado do envio é o estado da tela (o fluxo de sempre).
*/
export type EstadoNaTela = "aprovado" | "corrija" | "revisao";
export interface NovoEnvio {
  estado: "corrija" | "revisao";
  motivos: string[];
}

export function resultadoNaTela(
  vigenteAprovado: boolean,
  estadoDoNovo: EstadoNaTela,
  motivosDoNovo: readonly string[],
): { estado: EstadoNaTela; motivos: string[]; novo: NovoEnvio | null } {
  if (!vigenteAprovado || estadoDoNovo === "aprovado") return { estado: estadoDoNovo, motivos: estadoDoNovo === "aprovado" ? [] : [...motivosDoNovo], novo: null };
  return { estado: "aprovado", motivos: [], novo: { estado: estadoDoNovo, motivos: [...motivosDoNovo] } };
}

/** O envio novo gravado (getMyDocumentStatus: novo/motivoNovo) no formato da tela. */
export function novoDoStatus(novo: "pending" | "rejected" | null | undefined, motivo: string | null | undefined): NovoEnvio | null {
  if (novo === "pending") return { estado: "revisao", motivos: [] };
  if (novo === "rejected") return { estado: "corrija", motivos: motivo ? motivo.split(" · ").filter(Boolean) : [] };
  return null;
}
