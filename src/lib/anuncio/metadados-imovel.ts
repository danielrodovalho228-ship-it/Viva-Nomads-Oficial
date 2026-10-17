/*
  TÍTULO E DESCRIÇÃO DA ABA DA PÁGINA DO IMÓVEL (ordem dd15064d, D6) — regra pura.
  O título anuncia o mesmo TOTAL do mês que o cartão (textosTotalMensal), não o valor base.
*/
import type { Property } from "../types";
import { textosTotalMensal } from "../precos.ts";
import { quartosTexto } from "./plural.ts";

export function tituloAbaImovel(p: Property): string {
  return `${p.title} — ${textosTotalMensal(p).destaque}`;
}

export function descricaoAbaImovel(p: Property): string {
  return `Imóvel mobiliado em ${p.neighborhood}, ${p.city}: ${p.propertyType.toLowerCase()} de ${quartosTexto(p.bedrooms)} · ${p.areaM2} m² · estadia de 30 a 180 dias.`;
}
