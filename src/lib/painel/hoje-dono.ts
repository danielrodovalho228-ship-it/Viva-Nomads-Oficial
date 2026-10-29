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
  /** "a partir das 14:00" / "até as 11:00"; sem horário no imóvel, null. */
  horario: string | null;
  /** A estadia do contrato (a mesma URL para o dono e o morador). */
  href: string;
}

const HORA = /^\d{2}:\d{2}$/;

/** Horários do imóvel (properties.checkin_after / checkout_before), por id do imóvel. */
export type HorariosDosImoveis = Record<string, { entrada?: string | null; saida?: string | null }>;

export function cartoesDeHoje(itens: readonly ItemAgenda[], hoje: string, horarios: HorariosDosImoveis = {}): CartaoHoje[] {
  const cartoes: CartaoHoje[] = [];
  for (const i of itens) {
    if ((i.tipo !== "entrada" && i.tipo !== "saida") || i.quando.slice(0, 10) !== hoje) continue;
    const contratoId = i.id.replace(/^(entrada|saida)-/, "");
    const h = (i.tipo === "entrada" ? horarios[i.propertyId]?.entrada : horarios[i.propertyId]?.saida)?.trim() ?? "";
    cartoes.push({
      id: i.id,
      tipo: i.tipo,
      rotulo: i.tipo === "entrada" ? "Entra hoje" : "Sai hoje",
      contratoId,
      imovel: i.imovel,
      nome: i.pessoa?.nome?.trim() || "Morador",
      fotoUrl: i.pessoa?.fotoUrl ?? null,
      horario: HORA.test(h) ? (i.tipo === "entrada" ? `a partir das ${h}` : `até as ${h}`) : null,
      href: `/dashboard/estadia/${contratoId}`,
    });
  }
  // Primeiro quem entra, depois quem sai; dentro de cada um, pelo nome do imóvel.
  return cartoes.sort((a, b) => (a.tipo === b.tipo ? a.imovel.localeCompare(b.imovel, "pt-BR") : a.tipo === "entrada" ? -1 : 1));
}
