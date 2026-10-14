/*
  Painel de filtros do celular (ordem 314f764e) — PURO. O painel edita um
  RASCUNHO; "Mostrar N imóveis" conta com o rascunho e só ao aplicar a lista
  muda. Uma regra só para a contagem e para a lista (os mesmos campos que a
  /buscar já filtra e lê da URL).
*/
import { ROTULO_COMODIDADE, passaComodidades, type ComodidadeFiltro } from "./filtro-comodidades.ts";
import { aceitaPorte, type PortePet, type RegrasPets } from "../anuncio/pets-regras.ts";

export interface FiltrosPainel {
  maxPrice: number; // 0 = qualquer
  minBedrooms: number; // 0 = qualquer
  petsOnly: boolean;
  /** Porte do pet ("" = qualquer); só vale com "Aceita pets" ligado. */
  petPorte: PortePet | "";
  homeOfficeOnly: boolean;
  readyToLiveOnly: boolean;
  /** Wi-Fi, cozinha, garagem, máquina de lavar (ordem 583d2e71): precisa ter todas. */
  comodidades: ComodidadeFiltro[];
}

export const FILTROS_PAINEL_VAZIOS: FiltrosPainel = {
  maxPrice: 0,
  minBedrooms: 0,
  petsOnly: false,
  petPorte: "",
  homeOfficeOnly: false,
  readyToLiveOnly: false,
  comodidades: [],
};

export const ROTULO_PORTE_CURTO: Record<PortePet, string> = { P: "pequeno", M: "médio", G: "grande" };
export const OPCOES_PORTE_PET: { valor: PortePet | ""; rotulo: string }[] = [
  { valor: "", rotulo: "Qualquer porte" },
  { valor: "P", rotulo: "Pequeno (até 10 kg)" },
  { valor: "M", rotulo: "Médio (até 25 kg)" },
  { valor: "G", rotulo: "Grande (acima de 25 kg)" },
];

export const OPCOES_PRECO: { valor: number; rotulo: string }[] = [
  { valor: 0, rotulo: "Qualquer" },
  { valor: 2500, rotulo: "Até R$ 2.500" },
  { valor: 3500, rotulo: "Até R$ 3.500" },
  { valor: 5000, rotulo: "Até R$ 5.000" },
];

export const OPCOES_QUARTOS: { valor: number; rotulo: string }[] = [
  { valor: 0, rotulo: "Qualquer" },
  { valor: 1, rotulo: "1+" },
  { valor: 2, rotulo: "2+" },
  { valor: 3, rotulo: "3+" },
];

type ImovelFiltravel = {
  monthlyPrice: number;
  bedrooms: number;
  petsAllowed?: boolean;
  petsRegras?: RegrasPets | null;
  tagHomeOffice: boolean;
  readyToLiveBadge?: boolean;
  amenities?: string[];
  comodidadesFiltro?: string[];
  parkingSpots?: number;
};

/** O imóvel passa nos filtros do painel? */
export function passaNoPainel(p: ImovelFiltravel, f: FiltrosPainel): boolean {
  if (f.maxPrice && p.monthlyPrice > f.maxPrice) return false;
  if (f.minBedrooms && p.bedrooms < f.minBedrooms) return false;
  if (f.petsOnly && !p.petsAllowed) return false;
  if (f.petsOnly && f.petPorte && !aceitaPorte(p.petsAllowed, p.petsRegras, f.petPorte)) return false;
  if (f.homeOfficeOnly && !p.tagHomeOffice) return false;
  if (f.readyToLiveOnly && !p.readyToLiveBadge) return false;
  if (!passaComodidades(p, f.comodidades)) return false;
  return true;
}

/** Quantos filtros do painel estão ligados (o número no botão "Filtros"). */
export function contarFiltrosPainel(f: FiltrosPainel): number {
  return (f.maxPrice ? 1 : 0) + (f.minBedrooms ? 1 : 0) + [f.petsOnly, f.homeOfficeOnly, f.readyToLiveOnly].filter(Boolean).length + f.comodidades.length;
}

/** Texto do botão de aplicar: "Mostrar 1 imóvel" / "Mostrar 12 imóveis" / "Nenhum imóvel com esses filtros". */
export function rotuloMostrar(n: number): string {
  if (n === 0) return "Nenhum imóvel com esses filtros";
  return `Mostrar ${n} ${n === 1 ? "imóvel" : "imóveis"}`;
}

/** Resumo curto da busca no topo do celular: "Até R$ 3.500 · 2+ quartos · Aceita pets". */
export function resumoFiltros(f: FiltrosPainel): string {
  const partes: string[] = [];
  if (f.maxPrice) partes.push(OPCOES_PRECO.find((o) => o.valor === f.maxPrice)?.rotulo ?? `Até R$ ${f.maxPrice}`);
  if (f.minBedrooms) partes.push(`${f.minBedrooms}+ ${f.minBedrooms === 1 ? "quarto" : "quartos"}`);
  if (f.petsOnly) partes.push("Aceita pets");
  if (f.petsOnly && f.petPorte) partes.push(`pet ${ROTULO_PORTE_CURTO[f.petPorte]}`);
  if (f.homeOfficeOnly) partes.push("Trabalhar de casa");
  if (f.readyToLiveOnly) partes.push("Pronto para Morar");
  for (const c of f.comodidades) partes.push(ROTULO_COMODIDADE[c]);
  return partes.length ? partes.join(" · ") : "Qualquer preço · todos os imóveis";
}
