/*
  TÍTULO E DESCRIÇÃO DA ABA DA PÁGINA DO IMÓVEL (ordem dd15064d, D6) — regra pura.
  O título anuncia o mesmo TOTAL do mês que o cartão (textosTotalMensal), não o valor base.
*/
import type { Property } from "../types";
import { textosTotalMensal } from "../precos.ts";
import { quartosTexto } from "./plural.ts";
import { limitarMeta } from "../seo/meta-descricao.ts";
import { linhaLocalizacao } from "../localizacao.ts";

export function tituloAbaImovel(p: Property): string {
  return `${p.title} — ${textosTotalMensal(p).destaque}`;
}

export function descricaoAbaImovel(p: Property): string {
  return limitarMeta(
    `Imóvel mobiliado em ${linhaLocalizacao(p.neighborhood, p.city, p.state)}: ${p.propertyType.toLowerCase()} de ${quartosTexto(p.bedrooms)} · ${p.areaM2} m² · estadia de 30 a 180 dias.`,
  );
}
