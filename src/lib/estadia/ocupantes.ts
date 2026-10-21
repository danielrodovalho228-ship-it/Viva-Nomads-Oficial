/*
  Ocupantes da estadia (Prompt 32, item 3) — lista para a portaria. Regras puras.
  O morador preenche depois da assinatura; o dono vê e baixa a "Lista para a portaria" (nome + documento).
  Dados apagados RETENCAO_OCUPANTES_DIAS depois do fim do contrato (rotina das automações).
*/
import { ddmmaaaa } from "./estadia.ts";

/** Prazo único de retenção. Se o parecer jurídico trouxer outro prazo, muda só aqui. */
export const RETENCAO_OCUPANTES_DIAS = 90;

export const AVISO_OCUPANTES = "Estes dados são usados só para a liberação na portaria.";

export interface OcupanteEntrada {
  nome: string;
  documento: string;
  parentescoOuRelacao?: string | null;
}

export type Validacao<T> = { ok: true; valor: T } | { ok: false; erro: string };

export function validarOcupante(o: OcupanteEntrada): Validacao<{ nome: string; documento: string; parentesco_ou_relacao: string | null }> {
  const nome = (o.nome ?? "").replace(/\s+/g, " ").trim();
  const documento = (o.documento ?? "").trim();
  const rel = (o.parentescoOuRelacao ?? "").trim();
  if (nome.length < 2 || nome.length > 120) return { ok: false, erro: "Informe o nome completo do ocupante." };
  if (documento.replace(/[^0-9a-z]/gi, "").length < 5 || documento.length > 30) return { ok: false, erro: "Informe um documento (CPF, RG ou passaporte)." };
  if (rel.length > 60) return { ok: false, erro: "Parentesco ou relação: até 60 caracteres." };
  return { ok: true, valor: { nome, documento, parentesco_ou_relacao: rel || null } };
}

/** Teto: nunca mais ocupantes que o contrato prevê (qtd_ocupantes). */
export function podeAdicionarOcupante(atuais: number, previstos: number): boolean {
  return atuais < Math.max(1, previstos);
}

export function textoTetoOcupantes(previstos: number): string {
  return `Este contrato prevê ${previstos} ${previstos === 1 ? "ocupante" : "ocupantes"}. Para mudar, use "Propor alteração".`;
}

/** Texto para copiar ou baixar: "Lista para a portaria". */
export function textoListaPortaria(
  c: { numero: string; imovel: string; inicio: string | null; fim: string | null },
  ocupantes: { nome: string; documento: string }[],
): string {
  const periodo = c.inicio && c.fim ? `${ddmmaaaa(c.inicio)} a ${ddmmaaaa(c.fim)}` : "a definir";
  return [
    `Lista para a portaria — ${c.imovel}`,
    `Contrato ${c.numero} · Período: ${periodo}`,
    "",
    ...ocupantes.map((o, i) => `${i + 1}. ${o.nome} — ${o.documento}`),
  ].join("\n");
}

/** Contrato cujo fim (AAAA-MM-DD) passou há mais de RETENCAO_OCUPANTES_DIAS: os ocupantes devem ser apagados. */
export function ocupantesVencidos(fim: string | null, agora: Date = new Date()): boolean {
  if (!fim) return false;
  const limite = Date.parse(`${fim}T00:00:00Z`) + (RETENCAO_OCUPANTES_DIAS + 1) * 86_400_000;
  return agora.getTime() >= limite;
}

/** O dia de corte para a rotina: contratos com fim ANTES deste dia têm os ocupantes apagados. */
export function diaDeCorteRetencao(agora: Date = new Date()): string {
  return new Date(agora.getTime() - RETENCAO_OCUPANTES_DIAS * 86_400_000).toISOString().slice(0, 10);
}
