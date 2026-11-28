/*
  E190 (parte 2) — "Hoje" no Início do proprietário: quem entra e quem sai HOJE nos imóveis do dono. É a mesma
  informação da Agenda (entradas e saídas dos contratos ativos, lib/data/agenda-servidor.ts), resumida na home. Sem
  nada hoje, a seção não aparece. Vocabulário aprovado: "Entra hoje" / "Sai hoje" (nunca check-in/check-out). PURO.
*/
import type { ItemAgenda } from "../agenda.ts";

export interface CartaoHoje {
  id: string;
  tipo: "entrada" | "saida";
  /** "Entra hoje" / "Sai hoje". */
  rotulo: string;
  contratoId: string;
  imovel: string;
  /** Nome curto do morador (só depois do aceite, como na Agenda); sem ele, "Morador". */
  nome: string;
  fotoUrl: string | null;
  /** "a partir das 14:00" (a hora das instruções do contrato); sem ela, e na saída, null. */
  horario: string | null;
  /** A estadia do contrato (a mesma URL para o dono e o morador). */
  href: string;
}

const HORA = /^\d{2}:\d{2}$/;

/**
 * E1230 (ORDEM-DUET 1300): a hora de entrada POR CONTRATO (o leitor único horasDeEntrada: as instruções do contrato).
 * A saída não tem hora (o campo é o E1240): o "Sai hoje" vai sem ela.
 */
export type HorariosDosContratos = Record<string, { entrada?: string | null }>;

export function cartoesDeHoje(itens: readonly ItemAgenda[], hoje: string, horarios: HorariosDosContratos = {}): CartaoHoje[] {
  const cartoes: CartaoHoje[] = [];
  for (const i of itens) {
    if ((i.tipo !== "entrada" && i.tipo !== "saida") || i.quando.slice(0, 10) !== hoje) continue;
    const contratoId = i.id.replace(/^(entrada|saida)-/, "");
    const h = (i.tipo === "entrada" ? horarios[contratoId]?.entrada : null)?.trim() ?? "";
    cartoes.push({
      id: i.id,
      tipo: i.tipo,
      rotulo: i.tipo === "entrada" ? "Entra hoje" : "Sai hoje",
      contratoId,
      imovel: i.imovel,
      nome: i.pessoa?.nome?.trim() || "Morador",
      fotoUrl: i.pessoa?.fotoUrl ?? null,
      horario: HORA.test(h) ? `a partir das ${h}` : null,
      href: `/dashboard/estadia/${contratoId}`,
    });
  }
  // Primeiro quem entra, depois quem sai; dentro de cada um, pelo nome do imóvel.
  return cartoes.sort((a, b) => (a.tipo === b.tipo ? a.imovel.localeCompare(b.imovel, "pt-BR") : a.tipo === "entrada" ? -1 : 1));
}
