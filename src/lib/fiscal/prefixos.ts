/*
  Prefixos, números e marca dos documentos da plataforma (Prompt 56) — PURO, node --test.
  Todo documento gerado pela plataforma passa por registrarDocumento (registro.ts), que usa estas regras.
  "RPS" é a sigla oficial da NFS-e: nunca é prefixo nem aparece em documento da Viva (o recibo do parceiro PF é RSV).
*/

/** Marca do documento (D1). */
export type Marca =
  /** documento da plataforma: só a marca Viva */
  | "plataforma"
  /** documento do emissor gerado pela plataforma: o emissor em destaque e a Viva numa linha discreta */
  | "emissor"
  /** documento fiscal (NFS-e): layout oficial, sem marca; a marca vai só no e-mail de entrega */
  | "fiscal"
  /** bilateral assinado: Viva + blocos das duas partes */
  | "bilateral";

export interface RegraPrefixo {
  rotulo: string;
  marca: Marca;
  /**
   * Como o número nasce: "contador" = proximo_numero_documento (6 dígitos, ano de Brasília) com o tipo indicado;
   * "proprio" = o número vem de fora (ORC do next_document_number, VN-CT do id, VN-SV do pedido, NFS-e oficial).
   */
  numeracao: { contador: string } | "proprio";
  /** Reservado: a regra existe, o gerador nasce no prompt dele (39-B, 39-C, 51). */
  reservado?: true;
  /** Legado: o número não muda e ganha "Registro nº" ao lado. */
  legado?: true;
}

export const PREFIXOS = {
  ORC: { rotulo: "Proposta", marca: "bilateral", numeracao: "proprio" },
  "VN-CT": { rotulo: "Contrato", marca: "bilateral", numeracao: "proprio", legado: true },
  "VN-SV": { rotulo: "Pedido de parceiro", marca: "plataforma", numeracao: "proprio", legado: true },
  REC: { rotulo: "Recibo de locação", marca: "emissor", numeracao: { contador: "recibo_aluguel" } },
  CAU: { rotulo: "Comprovante de Caução", marca: "emissor", numeracao: { contador: "comprovante_caucao" } },
  DEV: { rotulo: "Termo de devolução da Caução", marca: "emissor", numeracao: { contador: "termo_devolucao_caucao" } },
  PRV: { rotulo: "Pacote de provas", marca: "plataforma", numeracao: { contador: "PRV" } },
  CND: { rotulo: "Conferência", marca: "plataforma", numeracao: { contador: "CND" } },
  PRT: { rotulo: "Lista da portaria", marca: "plataforma", numeracao: { contador: "PRT" } },
  ENC: { rotulo: "Encerramento", marca: "bilateral", numeracao: { contador: "ENC" } },
  INF: { rotulo: "Informe anual", marca: "plataforma", numeracao: { contador: "informe_anual" }, reservado: true },
  RPG: { rotulo: "Comprovante da taxa da plataforma", marca: "plataforma", numeracao: { contador: "RPG" }, reservado: true },
  RSV: { rotulo: "Recibo de serviço", marca: "emissor", numeracao: { contador: "RSV" }, reservado: true },
  REG: { rotulo: "Comprovante ao titular (LGPD)", marca: "plataforma", numeracao: { contador: "REG" }, reservado: true },
  NFSE: { rotulo: "NFS-e", marca: "fiscal", numeracao: "proprio", reservado: true },
  // Prompt 62-B2: laudo de avaliação do imóvel, emitido pela plataforma (nunca arquivo do avaliador).
  VIS: { rotulo: "Laudo de avaliação", marca: "plataforma", numeracao: { contador: "VIS" } },
} as const satisfies Record<string, RegraPrefixo>;

export type Prefixo = keyof typeof PREFIXOS;

/** Texto fixo do RPG; ele deixa de ser emitido quando a NFS-e da Viva (39-C) estiver ativa. */
export const TEXTO_RPG = "Comprovante de pagamento. Não é documento fiscal.";

/** "ORC-2026-0002" v1 → igual; v2 → "ORC-2026-0002 v2". */
export function numeroExibido(numero: string, versao = 1): string {
  return versao > 1 ? `${numero} v${versao}` : numero;
}

/** Aditivo n do contrato: "VN-CT-11281A61-AD1" (o número do contrato não muda). */
export function numeroAditivo(numeroContrato: string, n: number): string {
  return `${numeroContrato}-AD${n}`;
}

/** Orçamento do parceiro, congelado no aceite: "VN-SV-LOV4CA8I · orçamento v2" (sem a sigla ORC). */
export function numeroOrcamentoParceiro(codigoPedido: string, versao: number): string {
  return `${codigoPedido} · orçamento v${versao}`;
}

/** Registro nº com 6 dígitos ("Registro nº 000001"), exibido ao lado do número legado. */
export function rotuloRegistro(seq: number | string): string {
  return `Registro nº ${String(seq).padStart(6, "0")}`;
}

/** Host do site sem protocolo ("vivanomads.com.br"). */
export function hostDoSite(siteUrl: string): string {
  return siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Rodapé comum: "Confira em vivanomads.com.br/conferir com o código XXXX". */
export function linhaConferir(siteUrl: string, codigo: string): string {
  return `Confira em ${hostDoSite(siteUrl)}/conferir com o código ${codigo}`;
}

/** Data e hora de emissão no horário de Brasília: "06/10/2026 às 11:03 (horário de Brasília)". */
export function emitidoEmBrasilia(iso: string): string {
  const d = new Date(iso);
  const data = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return `${data} às ${hora} (horário de Brasília)`;
}

/** "RPS" nunca: nem como prefixo nem no texto de documento da Viva. */
export function temRps(texto: string): boolean {
  return /\bRPS\b/.test(texto);
}

export const CODIGO_VERIFICACAO_RE = /^[0-9a-f]{32}$/;
