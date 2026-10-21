/*
  Instruções de chegada (Prompt 32, item 2) — regras puras.
  O dono preenche uma vez no imóvel; o texto por contrato de contratos_checkin (quando houver) sobrescreve o campo
  "como entrar" (decisão do Muse, 21/10). O morador vê 7 dias antes da entrada, só com o contrato assinado pelas duas
  partes e o 1º pagamento registrado. Antes disso: "Liberadas em [data]".
*/
import { diaBRT } from "../datas-brasilia.ts";
import { ddmmaaaa, diasAte } from "./estadia.ts";

/** Decisão do Daniel (18/10): liberadas 7 dias antes da entrada. */
export const LIBERACAO_DIAS = 7;
/** Lembrete ao dono quando faltam 10 dias e as instruções ainda estão vazias. */
export const LEMBRETE_DONO_DIAS = 10;

export const CAMPOS_INSTRUCOES = [
  { chave: "como_entrar", rotulo: "Como entrar", ajuda: "Portaria, código, chave e horário.", max: 1000 },
  { chave: "wifi_rede", rotulo: "Wi-Fi: rede", ajuda: "", max: 100 },
  { chave: "wifi_senha", rotulo: "Wi-Fi: senha", ajuda: "", max: 100 },
  { chave: "regras_condominio", rotulo: "Regras do condomínio", ajuda: "", max: 1500 },
  { chave: "lixo", rotulo: "Lixo", ajuda: "Onde e quando descartar.", max: 500 },
  { chave: "vaga", rotulo: "Vaga", ajuda: "", max: 500 },
  { chave: "contatos_predio", rotulo: "Contatos úteis do prédio", ajuda: "Portaria, zelador, síndico.", max: 500 },
  { chave: "observacoes", rotulo: "Observações", ajuda: "", max: 1500 },
] as const;

export type ChaveInstrucao = (typeof CAMPOS_INSTRUCOES)[number]["chave"];
export type Instrucoes = Partial<Record<ChaveInstrucao, string | null>>;

/** Preenchidas = ao menos "como entrar" ou outro campo com texto. */
export function instrucoesPreenchidas(i: Instrucoes | null | undefined): boolean {
  return !!i && CAMPOS_INSTRUCOES.some((c) => (i[c.chave] ?? "").trim().length > 0);
}

/** Limpa e corta cada campo no limite; devolve só os campos conhecidos. */
export function normalizarInstrucoes(entrada: Record<string, unknown>): Instrucoes {
  const out: Instrucoes = {};
  for (const c of CAMPOS_INSTRUCOES) {
    const v = typeof entrada[c.chave] === "string" ? (entrada[c.chave] as string).trim().slice(0, c.max) : "";
    out[c.chave] = v || null;
  }
  return out;
}

/** O texto por contrato (contratos_checkin.instrucoes) sobrescreve "como entrar" quando presente. */
export function instrucoesEfetivas(doImovel: Instrucoes | null, doContrato: string | null | undefined): Instrucoes | null {
  const sobrescrita = (doContrato ?? "").trim();
  if (!doImovel && !sobrescrita) return null;
  return { ...(doImovel ?? {}), ...(sobrescrita ? { como_entrar: sobrescrita } : {}) };
}

/** Dia (AAAA-MM-DD) em que as instruções ficam visíveis ao morador. */
export function diaDaLiberacao(inicio: string | null): string | null {
  if (!inicio) return null;
  const d = new Date(`${inicio}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - LIBERACAO_DIAS);
  return d.toISOString().slice(0, 10);
}

export interface CondicaoLiberacao {
  inicio: string | null;
  assinadoPelasDuas: boolean;
  primeiroPagamento: boolean;
}

/** Liberadas no D-7 (calendário de Brasília), com o contrato assinado pelas duas partes e o 1º pagamento registrado. */
export function instrucoesLiberadas(c: CondicaoLiberacao, agora: Date = new Date()): boolean {
  const dia = diaDaLiberacao(c.inicio);
  if (!dia || !c.assinadoPelasDuas || !c.primeiroPagamento) return false;
  const hoje = diaBRT(agora);
  return !!hoje && diasAte(dia, hoje) >= 0;
}

/** O que o morador vê antes da liberação. */
export function textoAntesDaLiberacao(c: CondicaoLiberacao): string {
  const dia = diaDaLiberacao(c.inicio);
  if (!dia) return "Liberadas 7 dias antes da entrada.";
  const extra = !c.assinadoPelasDuas
    ? " Antes, o contrato precisa estar assinado pelas duas partes."
    : !c.primeiroPagamento
      ? " Antes, o 1º pagamento precisa estar registrado."
      : "";
  return `Liberadas em ${ddmmaaaa(dia)}.${extra}`;
}

/** A rotina diária avisa o morador no dia da liberação (uma vez). */
export function liberaHoje(c: CondicaoLiberacao, agora: Date = new Date()): boolean {
  const dia = diaDaLiberacao(c.inicio);
  return !!dia && diaBRT(agora) === dia && c.assinadoPelasDuas && c.primeiroPagamento;
}

/** Lembrete ao dono 10 dias antes, se ainda não preenchidas. */
export function lembrarDono(inicio: string | null, preenchidas: boolean, agora: Date = new Date()): boolean {
  if (!inicio || preenchidas) return false;
  const hoje = diaBRT(agora);
  return !!hoje && diasAte(hoje, inicio) === LEMBRETE_DONO_DIAS;
}
