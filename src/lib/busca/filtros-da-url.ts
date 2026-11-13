/*
  E829 — os filtros da busca lidos da URL, numa função PURA. É a mesma leitura que o /buscar fazia só depois de montar
  (useEffect), o que pintava primeiro a lista SEM filtro (15 cartões) e só então caía para o resultado. Agora o servidor
  passa a query da URL e o estado da busca já NASCE com ela: a primeira pintura (servidor e cliente) respeita o filtro.
  O voltar/avançar do navegador usa a mesma função.
*/
import { PROPERTY_TYPES } from "../amenities.ts";
import { CAUCAO_PARCELADA_UI, FAIXAS, GARANTIAS_FAIXA, GARANTIAS_PUBLICAS } from "../faixas.ts";
import { comodidadesDaUrl, type ComodidadeFiltro } from "./filtro-comodidades.ts";
import { seguroDaUrlLegada } from "./painel-filtros.ts";
import { datasFlexiveisDaUrl } from "./datas-flexiveis.ts";
import { filtroNivelDaUrl, niveisDaUrl } from "./filtro-nivel.ts";
import { filtroInternetDaUrl } from "./filtro-internet.ts";
import { destinoDaUrl, type EstadoDestino } from "./destino-busca.ts";
import { exemplosForcadosNaUrl } from "./exemplos-e-pedido.ts";
import type { Nivel } from "../../config/niveis.ts";

const GARANTIAS_FILTRO = CAUCAO_PARCELADA_UI ? GARANTIAS_FAIXA : GARANTIAS_PUBLICAS;

export type OrdemBusca = "relevance" | "trabalho" | "recent" | "price-asc" | "price-desc";

export interface FiltrosDaUrl {
  exemplosForcados: boolean;
  locationQuery: string;
  geoCenter: { lat: number; lng: number } | null;
  radiusKm: number | null;
  maxPrice: number;
  minBedrooms: number;
  adults: number;
  children: number;
  maxPeriod: number;
  sort: OrdemBusca;
  estadoDestino: EstadoDestino;
  typeFilter: string;
  faixa: string;
  dataEntrada: string;
  datasFlexiveis: boolean;
  garantia: string;
  petsOnly: boolean;
  petPorte: "" | "P" | "M" | "G";
  furnishedOnly: boolean;
  readyToLiveOnly: boolean;
  homeOfficeOnly: boolean;
  workLocatedOnly: boolean;
  invoiceOnly: boolean;
  operatedOnly: boolean;
  negociaOnly: boolean;
  precoJustoOnly: boolean;
  comodidades: ComodidadeFiltro[];
  internetMin: number;
  soInternetMedida: boolean;
  nivelMin: Nivel | "";
  niveis: Nivel[];
}

/** Lê a query da busca ("?preco=2500&pet=1" ou "preco=2500&pet=1"). Valor inválido = sem filtro (o padrão). */
export function filtrosDaUrl(search: string): FiltrosDaUrl {
  const sp = new URLSearchParams(search);
  const num = (k: string) => Number(sp.get(k)) || 0;
  const on = (k: string) => sp.get(k) === "1";

  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const r = Number(sp.get("r"));
  const temGeo = sp.get("lat") != null && sp.get("lng") != null && Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);

  // Preço: aceita `orcamento` (busca do hero) OU `preco` (sync interno) — A3.
  const orc = num("orcamento") || num("preco");
  // Período: novos valores (60/120/180) + legado do hero (30/90 → mapeados).
  const perMap: Record<number, number> = { 30: 60, 60: 60, 90: 120, 120: 120, 180: 180 };

  const ordem = sp.get("ordem");
  const estadoDestino = destinoDaUrl(sp);
  const sort: OrdemBusca =
    ordem === "recent" || ordem === "price-asc" || ordem === "price-desc" ? ordem : estadoDestino.destino ? "trabalho" : "relevance";

  const tipo = sp.get("tipo") ?? "";
  const fx = sp.get("faixa") ?? "";
  const ent = sp.get("entrada") ?? "";
  const gar = sp.get("garantia") ?? "";
  const garValida = gar && GARANTIAS_FILTRO.some((g) => g.key === gar) ? gar : "";
  const porte = sp.get("porte");
  const fi = filtroInternetDaUrl(sp);

  return {
    exemplosForcados: exemplosForcadosNaUrl(sp.toString()),
    locationQuery: sp.get("local") ?? "",
    geoCenter: temGeo ? { lat, lng } : null,
    radiusKm: temGeo && [5, 10, 20].includes(r) ? r : null,
    maxPrice: orc >= 300 && orc <= 50000 ? orc : 0,
    minBedrooms: [1, 2, 3].includes(num("quartos")) ? num("quartos") : 0,
    adults: num("adultos") >= 1 ? Math.min(16, num("adultos")) : 1,
    children: num("criancas") >= 1 ? Math.min(10, num("criancas")) : 0,
    maxPeriod: perMap[num("periodo")] ?? 0,
    sort,
    estadoDestino,
    typeFilter: tipo && PROPERTY_TYPES.some((t) => t.value === tipo) ? tipo : "",
    faixa: fx && FAIXAS.some((f) => f.key === fx) ? fx : "",
    dataEntrada: /^\d{4}-\d{2}-\d{2}$/.test(ent) ? ent : "",
    datasFlexiveis: datasFlexiveisDaUrl(sp),
    // E43 (Adendo 3): o atalho antigo `?seguro=1` vira a garantia "Seguro-fiança".
    garantia: garValida || (!gar && seguroDaUrlLegada(gar, sp.get("seguro")) ? "seguro_fianca" : ""),
    petsOnly: on("pet"),
    petPorte: on("pet") && (porte === "P" || porte === "M" || porte === "G") ? porte : "",
    furnishedOnly: on("mobiliado"),
    readyToLiveOnly: on("pronto"),
    homeOfficeOnly: on("homeoffice"),
    workLocatedOnly: on("localizado"),
    // E574: "Emite nota fiscal" = dono PJ/MEI que declarou emitir nota da locação.
    invoiceOnly: on("nota"),
    operatedOnly: on("gestor"),
    negociaOnly: on("negocia"),
    precoJustoOnly: on("precojusto"),
    comodidades: comodidadesDaUrl(sp.get("comod")),
    internetMin: fi.internetMin,
    soInternetMedida: fi.soInternetMedida,
    nivelMin: filtroNivelDaUrl(sp),
    niveis: niveisDaUrl(sp),
  };
}
