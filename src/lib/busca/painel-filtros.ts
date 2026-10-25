/*
  Folha de filtros da /buscar (ordem 314f764e; Prompt 40: celular de baixo para
  cima, computador na lateral) — PURO. A folha edita um RASCUNHO; "Mostrar N
  imóveis" conta com o rascunho e só ao aplicar a lista muda. Uma regra só para
  a contagem e para a lista (os mesmos campos que a /buscar já filtra e lê da URL).
  Só campos que existem no banco; sem escolha = filtro desligado (nunca
  "Qualquer", "Ambos", "Indiferente" ou "Tanto faz" como opção).
*/
import type { Nivel, NivelOuAdequacao } from "../../config/niveis.ts";
import { nivelAoMenos } from "../niveis/regras.ts";
import { rotuloFiltroNivel } from "./filtro-nivel.ts";
import { ROTULO_COMODIDADE, comodidadesValidas, passaComodidades, type ComodidadeAntiga, type ComodidadeFiltro } from "./filtro-comodidades.ts";
import { aceitaPorte, type PortePet, type RegrasPets } from "../anuncio/pets-regras.ts";
import { PROPERTY_TYPES } from "../amenities.ts";
import { passaBloqueios, passaEntrada } from "./datas-flexiveis.ts";
import { filtroInternetLigado, informadaNaoMedida, passaInternet, rotuloFiltroInternet, type ImovelComInternet } from "./filtro-internet.ts";
import { calcularTudoIncluido, type CamposTotalMes } from "../precos.ts";
import type { LimpezaEstadia } from "../anuncio/limpeza-estadia.ts";

export interface FiltrosPainel {
  maxPrice: number; // 0 = qualquer
  minBedrooms: number; // 0 = qualquer
  petsOnly: boolean;
  /** Porte do pet ("" = qualquer); só vale com "Aceita pets" ligado. */
  petPorte: PortePet | "";
  homeOfficeOnly: boolean;
  readyToLiveOnly: boolean;
  /** Garagem, máquina de lavar (ordem 583d2e71): precisa ter todas. A antiga "wifi" é ignorada (Adendo 3, E39). */
  comodidades: (ComodidadeFiltro | ComodidadeAntiga)[];
  /** Estadia (dias): 60 = 1–2 meses, 120 = 3–4, 180 = 5–6; 0 = desligado. Compara com min_period_days e max_period_days. */
  periodo: number;
  /** Tipo do imóvel (property_type, chave de PROPERTY_TYPES); "" = desligado. */
  tipo: string;
  /** Garantia aceita ("caucao" | "seguro_fianca" | chaves antigas); "" = desligado. */
  garantia: string;
  /** Só quem emite nota fiscal (o chip só aparece com SELO_NF_UI). */
  notaOnly: boolean;
  /**
   * @deprecated Adendo 3 (E43): saiu do painel, da /buscar e da URL — `?seguro=1` (URL e buscas salvas) vira
   * `garantia=seguro_fianca` no parser (seguroDaUrlLegada). Nada mais liga este campo; ele só sobrevive como APELIDO da
   * garantia "Seguro-fiança" (mesmo critério, conta 1 junto com ela) até o teste de estilo da Pista A largar o campo.
   */
  seguroOnly?: boolean;
  /** Só imóveis com gestor profissional (sublocação autorizada). */
  gestorOnly: boolean;
  /** Prompt 57, fase 2: download MEDIDO mínimo (50 | 100 | 300); 0 = desligado. */
  internetMin: number;
  /** "Só com internet medida" (dentro de "Para trabalhar de casa"). */
  soInternetMedida: boolean;
  /** Prompt 55 B2: data de entrada da busca (yyyy-mm-dd; "" = sem data). A folha não edita a data, só a flexibilidade. */
  entrada: string;
  /** "Datas flexíveis": aceita disponibilidade até FOLGA_DATAS_FLEXIVEIS_DIAS depois da entrada. */
  datasFlexiveis: boolean;
  /** Adendo 59.1: "a partir de" Conforto/Premium (`?nivel=`); "" = desligado. */
  nivelMin?: Nivel | "";
}

export const FILTROS_PAINEL_VAZIOS: FiltrosPainel = {
  maxPrice: 0,
  minBedrooms: 0,
  petsOnly: false,
  petPorte: "",
  homeOfficeOnly: false,
  readyToLiveOnly: false,
  comodidades: [],
  periodo: 0,
  tipo: "",
  garantia: "",
  notaOnly: false,
  gestorOnly: false,
  internetMin: 0,
  soInternetMedida: false,
  entrada: "",
  datasFlexiveis: false,
  nivelMin: "",
};

export const ROTULO_PORTE_CURTO: Record<PortePet, string> = { P: "pequeno", M: "médio", G: "grande" };
export const OPCOES_PORTE_PET: { valor: PortePet; rotulo: string }[] = [
  { valor: "P", rotulo: "Pequeno (até 10 kg)" },
  { valor: "M", rotulo: "Médio (até 25 kg)" },
  { valor: "G", rotulo: "Grande (acima de 25 kg)" },
];

export const OPCOES_PRECO: { valor: number; rotulo: string }[] = [
  { valor: 2500, rotulo: "Até R$ 2.500" },
  { valor: 3500, rotulo: "Até R$ 3.500" },
  { valor: 5000, rotulo: "Até R$ 5.000" },
];

export const OPCOES_QUARTOS: { valor: number; rotulo: string }[] = [
  { valor: 1, rotulo: "1+" },
  { valor: 2, rotulo: "2+" },
  { valor: 3, rotulo: "3+" },
];

/** Estadia (os mesmos valores do `?periodo=` da URL). */
export const OPCOES_ESTADIA: { valor: number; rotulo: string }[] = [
  { valor: 60, rotulo: "1–2 meses" },
  { valor: 120, rotulo: "3–4 meses" },
  { valor: 180, rotulo: "5–6 meses" },
];

/** Tipos do imóvel com os rótulos que o anúncio já usa (src/lib/amenities.ts). */
export const OPCOES_TIPO: { valor: string; rotulo: string }[] = PROPERTY_TYPES.map((t) => ({ valor: t.value, rotulo: t.label }));

/** Normaliza o tipo do imóvel (chave canônica ou rótulo legado, ex. "Apartamento") para a chave. */
export function tipoCanonico(pt: string): string {
  const low = (pt ?? "").toLowerCase();
  if (PROPERTY_TYPES.some((t) => t.value === low)) return low;
  const m = PROPERTY_TYPES.find((t) => t.label.toLowerCase() === low || t.label.toLowerCase().startsWith(low));
  return m?.value ?? low;
}

/** A estadia escolhida cabe no anúncio? Mínimo do anúncio ≤ fim da faixa e máximo (se houver) ≥ início da faixa. */
export function cabeNaEstadia(p: { minPeriodDays?: number; maxPeriodDays?: number | null }, periodo: number): boolean {
  if (!periodo) return true;
  if ((p.minPeriodDays ?? 0) > periodo) return false;
  if (p.maxPeriodDays && p.maxPeriodDays < periodo - 30) return false;
  return true;
}

type ImovelFiltravel = ImovelComInternet & {
  /** Disponível a partir de (yyyy-mm-dd); sem ela, a data de entrada não tira o imóvel. */
  availableFrom?: string | null;
  /** Prompt 53: datas bloqueadas de hoje em diante (do dono ou importadas). */
  bloqueios?: { inicio: string; fim: string }[];
  monthlyPrice: number;
  /** Total do mês anunciado no cartão; sem ele, a mesma conta do cartão (aluguel + condomínio + contas + limpeza). */
  totalMes?: number;
  condoFee?: number;
  utilitiesMode?: string;
  utilitiesEstimate?: number;
  limpezaEstadia?: LimpezaEstadia | null;
  bedrooms: number;
  petsAllowed?: boolean;
  petsRegras?: RegrasPets | null;
  tagHomeOffice: boolean;
  readyToLiveBadge?: boolean;
  amenities?: string[];
  comodidadesFiltro?: string[];
  parkingSpots?: number;
  minPeriodDays?: number;
  maxPeriodDays?: number | null;
  propertyType?: string;
  garantiasAceitas?: string[];
  acceptsInsurance?: boolean;
  issuesInvoice?: boolean;
  ownershipType?: string;
  subleaseAuthorized?: boolean;
  /** Adendo 59.1: nível gravado pelo servidor (elo mais fraco). */
  nivel?: NivelOuAdequacao | null;
};

/** Rótulo curto das garantias do filtro (resumo do topo). */
const ROTULO_GARANTIA: Record<string, string> = {
  caucao: "Caução",
  caucao_avista: "Caução à vista",
  caucao_parcelada: "Caução parcelada",
  titulo: "Título de capitalização",
  seguro_fianca: "Seguro-fiança",
};

/** O imóvel aceita a garantia pedida? "caucao" (filtro público unificado) casa qualquer modalidade de caução. */
export function aceitaGarantia(p: { garantiasAceitas?: string[]; acceptsInsurance?: boolean }, g: string): boolean {
  if (!g) return true;
  const arr = p.garantiasAceitas ?? [];
  if (g === "seguro_fianca") return arr.includes("seguro_fianca") || !!p.acceptsInsurance;
  if (g === "caucao") return arr.some((x) => x === "caucao" || x.startsWith("caucao_"));
  return arr.includes(g); // caucao_avista | caucao_parcelada | titulo
}

/**
 * Preço que a busca compara e mostra: o TOTAL do mês do cartão (ordem 826719b1, D1; FILTROS-1, E20). Antes, sem
 * `totalMes`, comparava o aluguel base (2.850) e o cartão mostrava o total (3.070): "Até R$ 3.000" deixava passar um
 * imóvel de R$ 3.070. Agora é a MESMA conta do cartão (calcularTudoIncluido).
 */
export function precoDeBusca(p: {
  monthlyPrice: number;
  totalMes?: number;
  condoFee?: number;
  utilitiesMode?: string;
  utilitiesEstimate?: number;
  limpezaEstadia?: LimpezaEstadia | null;
}): number {
  if (p.totalMes && p.totalMes > 0) return p.totalMes;
  return calcularTudoIncluido({
    monthlyPrice: p.monthlyPrice,
    condoFee: p.condoFee,
    utilitiesMode: p.utilitiesMode,
    utilitiesEstimate: p.utilitiesEstimate,
    limpezaEstadia: p.limpezaEstadia ?? undefined,
  } as CamposTotalMes).total;
}

/** O imóvel passa nos filtros do painel? `agora` só pesa na validade da medição de internet. */
export function passaNoPainel(p: ImovelFiltravel, f: FiltrosPainel, agora: Date = new Date()): boolean {
  if (f.maxPrice && precoDeBusca(p) > f.maxPrice) return false;
  if (f.minBedrooms && p.bedrooms < f.minBedrooms) return false;
  if (f.petsOnly && !p.petsAllowed) return false;
  if (f.petsOnly && f.petPorte && !aceitaPorte(p.petsAllowed, p.petsRegras, f.petPorte)) return false;
  if (f.homeOfficeOnly && !p.tagHomeOffice) return false;
  if (f.readyToLiveOnly && !p.readyToLiveBadge) return false;
  if (!passaComodidades(p, f.comodidades)) return false;
  if (f.periodo && !cabeNaEstadia(p, f.periodo)) return false;
  if (!passaEntrada(p.availableFrom, f.entrada, f.datasFlexiveis)) return false;
  // A faixa "1–2 meses" (60) começa em 30 dias: o bloqueio tira o imóvel só se nem a estadia mais curta da faixa cabe.
  if (!passaBloqueios(p.bloqueios, f.entrada, f.datasFlexiveis, f.periodo ? f.periodo - 30 : 30)) return false;
  if (f.tipo && tipoCanonico(p.propertyType ?? "") !== f.tipo) return false;
  if (f.garantia && !aceitaGarantia(p, f.garantia)) return false;
  if (f.notaOnly && !p.issuesInvoice) return false;
  // Apelido legado da garantia "Seguro-fiança" (ver seguroOnly): o MESMO critério, nunca um segundo filtro.
  if (f.seguroOnly && !aceitaGarantia(p, "seguro_fianca")) return false;
  if (f.gestorOnly && !(p.ownershipType !== "own" && p.subleaseAuthorized)) return false;
  if (!passaInternet(p, f, agora)) return false;
  if (f.nivelMin && !nivelAoMenos(p.nivel, f.nivelMin)) return false;
  return true;
}

/**
 * Prompt 57, fase 2: os que ficam de fora SÓ por não ter medição válida e têm internet informada no valor escolhido —
 * a linha "Mais N imóveis com internet informada, mas não medida". Filtro de internet desligado → nenhum.
 */
export function naoMedidosDoPainel<T extends ImovelFiltravel>(lista: readonly T[], f: FiltrosPainel, agora: Date = new Date()): T[] {
  if (!filtroInternetLigado(f)) return [];
  const semInternet: FiltrosPainel = { ...f, internetMin: 0, soInternetMedida: false };
  return lista.filter((p) => passaNoPainel(p, semInternet, agora) && informadaNaoMedida(p, f, agora));
}

/**
 * Adendo 3 (E43): o atalho antigo `?seguro=1` (URL, alerta e busca salva) vira a garantia "Seguro-fiança". Uma garantia
 * já escolhida vence (é a escolha mais nova). Devolve a garantia que vale.
 */
export function seguroDaUrlLegada(garantia: string | null | undefined, seguro: string | null | undefined): string {
  if (garantia) return garantia;
  return seguro === "1" ? "seguro_fianca" : "";
}

/** Quantos filtros do painel estão ligados (o número no botão "Filtros"). */
export function contarFiltrosPainel(f: FiltrosPainel): number {
  return (
    (f.maxPrice ? 1 : 0) +
    (f.minBedrooms ? 1 : 0) +
    (f.periodo ? 1 : 0) +
    (f.tipo ? 1 : 0) +
    // Seguro-fiança conta 1, venha da garantia ou do apelido legado seguroOnly.
    (f.garantia || f.seguroOnly ? 1 : 0) +
    (filtroInternetLigado(f) ? 1 : 0) +
    // A data de entrada conta fora da folha (chip "Entrada …"); aqui só a flexibilidade, e só com data.
    (f.entrada && f.datasFlexiveis ? 1 : 0) +
    (f.nivelMin ? 1 : 0) +
    // Adendo 3 (E43): "Pronto para Morar" é um estado só (readyToLiveOnly) — atalho e chip contam 1.
    [f.petsOnly, f.homeOfficeOnly, f.readyToLiveOnly, f.notaOnly, f.gestorOnly].filter(Boolean).length +
    comodidadesValidas(f.comodidades).length
  );
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
  if (f.periodo) partes.push(OPCOES_ESTADIA.find((o) => o.valor === f.periodo)?.rotulo ?? "Estadia");
  if (f.entrada && f.datasFlexiveis) partes.push("Datas flexíveis");
  if (f.tipo) partes.push(OPCOES_TIPO.find((o) => o.valor === f.tipo)?.rotulo ?? f.tipo);
  if (f.petsOnly) partes.push("Aceita pets");
  if (f.petsOnly && f.petPorte) partes.push(`pet ${ROTULO_PORTE_CURTO[f.petPorte]}`);
  if (f.homeOfficeOnly) partes.push("Trabalhar de casa");
  const internet = rotuloFiltroInternet(f);
  if (internet) partes.push(internet);
  if (f.readyToLiveOnly) partes.push("Pronto para Morar");
  const nivel = rotuloFiltroNivel(f.nivelMin);
  if (nivel) partes.push(nivel);
  for (const c of comodidadesValidas(f.comodidades)) partes.push(ROTULO_COMODIDADE[c]);
  if (f.garantia) partes.push(ROTULO_GARANTIA[f.garantia] ?? "Garantia");
  else if (f.seguroOnly) partes.push(ROTULO_GARANTIA.seguro_fianca);
  if (f.notaOnly) partes.push("Nota Fiscal");
  if (f.gestorOnly) partes.push("Gestor profissional");
  return partes.length ? partes.join(" · ") : "Qualquer preço · todos os imóveis";
}
