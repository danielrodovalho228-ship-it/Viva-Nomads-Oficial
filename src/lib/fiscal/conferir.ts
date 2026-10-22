/*
  /conferir (Prompt 56, D3) — regras PURAS da resposta pública, node --test.
  Entrada: só o código de verificação impresso no documento (número sozinho não responde: impede varrer a
  sequência). Resposta: existe, status, tipo, número, versão e data — nunca valor nem nome das partes. O "hash
  confere" é calculado NO NAVEGADOR: o arquivo não sai do aparelho da pessoa.
*/
import { PREFIXOS, rotuloRegistro, type Prefixo } from "./prefixos.ts";

export interface LinhaConferida {
  prefixo: string;
  tipo: string;
  numero: string;
  versao: number;
  status: "valido" | "anulado" | "substituido";
  anulado_motivo: string | null;
  status_em: string | null;
  emitido_em: string;
  hash_sha256: string | null;
  is_teste: boolean;
  registro_seq: number;
  versao_vigente: number | null;
}

/** Código como a pessoa digitou: sem espaços e em minúsculas ("9F3B 82D1…" → "9f3b82d1…"). */
export function normalizarCodigo(codigo: string): string {
  return codigo.replace(/\s+/g, "").toLowerCase();
}

export function rotuloDoTipo(prefixo: string, tipo: string): string {
  if (tipo === "aditivo") return "Aditivo do contrato";
  if (tipo.startsWith("conferencia")) return "Conferência do imóvel";
  return (PREFIXOS as Record<string, { rotulo: string }>)[prefixo]?.rotulo ?? "Documento";
}

/** Situação em uma frase: válido, anulado com motivo, substituído pela versão N, ou documento de teste. */
export function situacaoDoDocumento(d: Pick<LinhaConferida, "status" | "anulado_motivo" | "is_teste" | "versao_vigente">): { estado: "valido" | "anulado" | "substituido" | "teste"; texto: string } {
  if (d.status === "anulado") return { estado: "anulado", texto: `Documento ANULADO${d.anulado_motivo ? ` (${d.anulado_motivo})` : ""}. Foi gerado pela plataforma, mas não vale mais.` };
  if (d.status === "substituido")
    return { estado: "substituido", texto: `Documento SUBSTITUÍDO${d.versao_vigente ? ` pela versão ${d.versao_vigente}` : ""}. Esta versão foi gerada pela plataforma, mas não é a vigente.` };
  // Anulado e substituído vêm antes: valem também para o documento de teste.
  if (d.is_teste) return { estado: "teste", texto: "Documento de teste: foi gerado numa conta de teste da plataforma e não vale como documento real." };
  return { estado: "valido", texto: "Documento válido, registrado pela plataforma Viva Nomads." };
}

/** Os campos exibidos — nenhum valor, nenhum nome. */
export function camposExibidos(d: LinhaConferida, dataHora: (iso: string) => string): [string, string][] {
  const legado = (PREFIXOS as Record<string, { legado?: true }>)[d.prefixo]?.legado;
  return [
    ["Documento", rotuloDoTipo(d.prefixo, d.tipo)],
    ["Número", d.numero],
    // A página promete "o tipo, o número, a versão e a data": a versão tem linha própria (QA do Muse, 22/10).
    ["Versão", String(d.versao)],
    ...(legado ? ([["Registro", rotuloRegistro(d.registro_seq).replace("Registro ", "")]] as [string, string][]) : []),
    ["Emitido em", dataHora(d.emitido_em)],
  ];
}

/** Documentos com PDF guardado: a pessoa pode conferir o arquivo (o hash do registro é o do PDF). */
export function aceitaArquivo(prefixo: string): boolean {
  return (["REC", "CAU", "DEV", "INF", "PRV"] as Prefixo[]).includes(prefixo as Prefixo);
}

/** Hex de um digest (o navegador devolve ArrayBuffer). */
export function hexDe(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hashConfere(registrado: string | null, calculado: string): boolean {
  return !!registrado && /^[0-9a-f]{64}$/.test(calculado) && registrado === calculado;
}
