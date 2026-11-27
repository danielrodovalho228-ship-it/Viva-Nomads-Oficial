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

/**
 * E887 — o que a conferência devolve e a validade do documento, ditos ANTES de conferir (/conferir), no resultado
 * (/conferir/<código>) e na Central de Ajuda. Fonte única: as três telas leem daqui, e a lista bate com os campos de
 * camposExibidos + situacaoDoDocumento (o teste E887 confere).
 */
export const CONFERENCIA_DEVOLVE = [
  "o tipo de documento (recibo, contrato, laudo, conferência do imóvel…)",
  "o número e a versão",
  "a data de emissão",
  "a situação: válido, anulado, substituído por uma versão nova ou documento de teste",
  // E1121: o laudo de avaliação do imóvel diz também o que declara e deixa conferir o arquivo.
  "no laudo de avaliação do imóvel: o nível, o resultado e o hash do arquivo",
] as const;
/** As partes: por privacidade, nem nomes nem valores — a pessoa compara com o documento que tem em mãos. */
export const CONFERENCIA_PARTES =
  "Por privacidade, a conferência não mostra os nomes das partes nem valores: confira esses dados no documento que você tem em mãos.";
/** A validade real: o código não vence; vale a situação de hoje (o documento perde a validade se for anulado ou substituído). */
export const CONFERENCIA_VALIDADE =
  "Validade: o código não vence. A conferência mostra a situação de hoje: o documento vale enquanto estiver válido e deixa de valer se for anulado ou substituído por uma versão nova.";
/** Uma frase com a lista, para textos corridos (Ajuda). */
export function fraseConferenciaDevolve(): string {
  const l = [...CONFERENCIA_DEVOLVE];
  return `A conferência mostra ${l.slice(0, -1).join("; ")}; e ${l[l.length - 1]}.`;
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
/** E1229: a data de um instante em Brasília (dd/mm/aaaa); sem instante válido, null. */
const dataEmBrasilia = (iso: string | null | undefined): string | null => {
  const t = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(t)) return null;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(t));
};

export function situacaoDoDocumento(d: Pick<LinhaConferida, "status" | "anulado_motivo" | "is_teste" | "versao_vigente"> & { status_em?: string | null }): { estado: "valido" | "anulado" | "substituido" | "teste"; texto: string } {
  // E1229 (ORDEM-DUET-1143): o anulado diz quando e por quê — "Anulado em {data}: {motivo}".
  if (d.status === "anulado") {
    const quando = dataEmBrasilia(d.status_em);
    const motivo = (d.anulado_motivo ?? "").trim();
    return { estado: "anulado", texto: `Anulado${quando ? ` em ${quando}` : ""}${motivo ? `: ${motivo}` : ""}. Foi gerado pela plataforma, mas não vale mais.` };
  }
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

/**
 * E1121 (ORDEM-DUET-523) — o laudo de avaliação do imóvel (VIS) na conferência: além do tipo, do número, da versão e
 * da data, a página diz o NÍVEL e o RESULTADO que o laudo declara e mostra o HASH do arquivo registrado. Nada disto é
 * dado de pessoa: é o que o próprio laudo traz impresso, e só chega aqui quem tem o código que vem nele.
 * `nivel` e `resultado` já vêm com o rótulo de tela (quem lê o laudo é a página; aqui fica só a regra do que aparece).
 */
export interface LaudoConferido {
  nivel: string | null;
  resultado: string | null;
}
export const ROTULO_HASH_DO_ARQUIVO = "Hash do arquivo (SHA-256)";

/** O documento é um laudo de avaliação do imóvel? */
export function ehLaudoDeAvaliacao(prefixo: string): boolean {
  return prefixo === "VIS";
}

/** As linhas a mais do laudo: nível e resultado, cada uma só quando existe (laudo reprovado não sustenta nível). */
export function camposDoLaudo(l: LaudoConferido | null | undefined): [string, string][] {
  if (!l) return [];
  return [...(l.nivel ? ([["Nível", l.nivel]] as [string, string][]) : []), ...(l.resultado ? ([["Resultado", l.resultado]] as [string, string][]) : [])];
}

/** O hash que a página mostra por extenso: só no laudo, e só um SHA-256 inteiro (64 letras e números). */
export function hashExibido(d: Pick<LinhaConferida, "prefixo" | "hash_sha256">): string | null {
  return ehLaudoDeAvaliacao(d.prefixo) && d.hash_sha256 && /^[0-9a-f]{64}$/.test(d.hash_sha256) ? d.hash_sha256 : null;
}

/** Documentos com PDF guardado: a pessoa pode conferir o arquivo (o hash do registro é o do PDF). E1121: o laudo também. */
export function aceitaArquivo(prefixo: string): boolean {
  return (["REC", "CAU", "DEV", "INF", "PRV", "VIS"] as Prefixo[]).includes(prefixo as Prefixo);
}

/** Hex de um digest (o navegador devolve ArrayBuffer). */
export function hexDe(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hashConfere(registrado: string | null, calculado: string): boolean {
  return !!registrado && /^[0-9a-f]{64}$/.test(calculado) && registrado === calculado;
}
