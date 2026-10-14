/*
  Assinatura eletrônica na plataforma (ordem 0fd301f0, F40) — regras PURAS e testáveis.
  O texto dos modelos de contrato NÃO é tocado aqui: a pessoa assina o RESUMO do contrato registrado
  (partes, imóvel, valor, prazo), sempre com a marca de minuta enquanto o parecer jurídico não sai.
*/
import { createHash } from "node:crypto";
import { MARCA_MINUTA } from "./contrato-etapas.ts";
import { linhasRegrasPets, normalizarRegrasPets, type RegrasPets } from "./anuncio/pets-regras.ts";

export type PapelContrato = "proprietario" | "inquilino";

export function papelNoContrato(userId: string, tenantId: string, ownerId: string): PapelContrato | null {
  if (userId === tenantId) return "inquilino";
  if (userId === ownerId) return "proprietario";
  return null;
}

export interface DadosResumo {
  contratoId: string;
  imovel: string;
  aluguelMensal: number;
  prazoDias: number;
  ocupantes: number;
  criadoEm: string;
  /** Regras de pets do anúncio (ordem 022afabb item 5): entram no resumo, não no texto do modelo. */
  petsRegras?: RegrasPets | null;
}

/** Linhas do resumo mostradas na tela e usadas no hash (mesma fonte: o que a pessoa lê é o que ela assina). */
export function resumoContrato(d: DadosResumo): string[] {
  const valor = d.aluguelMensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return [
    MARCA_MINUTA,
    `Contrato ${d.contratoId}`,
    `Imóvel: ${d.imovel}`,
    `Valor mensal: ${valor}`,
    `Prazo total: ${d.prazoDias} dias`,
    `Ocupantes: ${d.ocupantes}`,
    ...(d.petsRegras ? [`Pets — ${linhasRegrasPets(d.petsRegras).join("; ")}`] : []),
    `Registrado em: ${d.criadoEm}`,
  ];
}

/**
 * Regras de pets que entram no resumo. Antes de qualquer assinatura valem as do anúncio (ao vivo);
 * a partir da primeira assinatura valem só as congeladas no contrato, para as duas partes assinarem o
 * mesmo texto/hash mesmo que o dono mude o anúncio depois. Contrato já assinado sem congelamento
 * (anterior a esta regra) fica sem a linha, como era quando assinou.
 */
export function petsRegrasDoResumo(d: {
  algumaAssinatura: boolean;
  vivas: unknown;
  congeladas: unknown;
}): RegrasPets | null {
  return normalizarRegrasPets(d.algumaAssinatura ? d.congeladas : d.vivas);
}

export function hashResumo(linhas: string[]): string {
  return createHash("sha256").update(linhas.join("\n"), "utf8").digest("hex");
}

export function motivoNaoPodeAssinar(c: {
  status: string;
  papel: PapelContrato | null;
  assinadoEm: string | null;
  aceite: boolean;
}): string | null {
  if (!c.papel) return "Você não é parte deste contrato.";
  if (c.status !== "ativo") return "Este contrato não está mais aguardando assinatura.";
  if (c.assinadoEm) return "Você já assinou este contrato.";
  if (!c.aceite) return "Marque “Li e concordo” para assinar.";
  return null;
}

/** Texto do cartão: o que cada parte vê sobre as assinaturas. */
export function avisoAssinatura(papel: PapelContrato, a: { proprietario: string | null; inquilino: string | null }): string {
  const eu = papel === "inquilino" ? a.inquilino : a.proprietario;
  const outro = papel === "inquilino" ? a.proprietario : a.inquilino;
  if (eu && outro) return "As duas partes assinaram.";
  if (eu) return "Você já assinou — falta o outro assinar.";
  if (outro) return "O outro já assinou — falta você assinar.";
  return "Nenhuma assinatura ainda.";
}

/** Assunto do aviso à OUTRA parte depois que alguém assina: se ela já tinha assinado, o contrato está completo. */
export function assuntoAvisoOutraParte(outraJaAssinou: boolean): string {
  return outraJaAssinou
    ? "As duas partes assinaram o contrato"
    : "O outro lado assinou o contrato — falta a sua assinatura";
}

/** Mesma janela do servidor (migração 0089): contrato encerrado e até 14 dias depois. Nunca em contrato ativo. */
export function podeAvaliarLocacao(status: string, encerradoEm: string | null, agora = new Date()): boolean {
  if (!["concluido", "encerrado_sem_renovacao", "encerrado_em_acerto"].includes(status)) return false;
  if (!encerradoEm) return false;
  const fim = new Date(encerradoEm).getTime();
  return Number.isFinite(fim) && agora.getTime() <= fim + 14 * 24 * 3600 * 1000;
}
