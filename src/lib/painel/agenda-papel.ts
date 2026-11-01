/**
 * E410 (01/11) — a Agenda no painel da MORADORA. A Agenda é página comum (não troca o papel ativo); no papel morador ela
 * dizia "todos os seus imóveis" e "Quando você anunciar… / Anunciar imóvel". PURO.
 */
import type { Papel } from "../papel/papel-ativo.ts";

/** Papel morador: o gravado é "morador", ou a conta nem tem o papel de proprietário. Sem leitura (null): o de sempre. */
export function agendaNoPapelMorador(estado: { papeis: readonly Papel[]; gravado: Papel | null } | null): boolean {
  if (!estado) return false;
  return estado.gravado === "morador" || !estado.papeis.includes("proprietario");
}

export const TEXTOS_AGENDA_MORADOR = {
  subtitulo: (fuso: string) => `As visitas que você pediu ficam em Visitas (${fuso}).`,
  subtituloComImoveis: (fuso: string) => `Visitas, entradas, saídas e datas bloqueadas dos imóveis que você anuncia (${fuso}).`,
  lembrete: "As visitas que você pediu como morador ficam em Visitas.",
  vazioTitulo: "Nenhuma visita na agenda",
  vazioTexto: "Na página de um imóvel, toque em “Agendar visita” ou “Visita por vídeo”, escolha até 3 horários e acompanhe a resposta em Visitas.",
  acao: "Ver minhas visitas",
} as const;
