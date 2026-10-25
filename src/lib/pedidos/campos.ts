/*
  Pedido de moradia (Prompt 30) — campos novos, validade e textos do cartão. Módulo PURO (node --test).
  A regra de compatibilidade com estes campos mora no banco (compatibilidade_pedidos, 0184); aqui ficam as listas, a
  validação do servidor e os textos que o inquilino e o dono leem.
*/
import { chaveCidade } from "../cidades.ts";
import { INTERNET } from "../../config/internet.ts";

// ── Campos ────────────────────────────────────────────────────────────────────────────────────────────────────
export const BAIRROS_MAX = 3;
/** Texto do bairro quando a pessoa não escolhe nenhum (o mesmo campo vale para o Prompt 26). */
export const QUALQUER_BAIRRO = "Qualquer bairro";

export const QUARTOS_OPCOES = [
  { valor: 0, rotulo: "Estúdio" },
  { valor: 1, rotulo: "1 quarto" },
  { valor: 2, rotulo: "2 quartos" },
  { valor: 3, rotulo: "3 ou mais" },
] as const;

export const NECESSIDADES = [
  { valor: "home_office", rotulo: "Home office" },
  { valor: "garagem", rotulo: "Garagem" },
  { valor: "mobiliado_completo", rotulo: "Mobiliado completo" },
  { valor: "aceita_dividir", rotulo: "Aceito dividir" },
  { valor: "acessibilidade", rotulo: "Acessibilidade" },
] as const;
export type Necessidade = (typeof NECESSIDADES)[number]["valor"];

export const PORTES_PET_PEDIDO = [
  { valor: "pequeno", rotulo: "Pequeno" },
  { valor: "medio", rotulo: "Médio" },
  { valor: "grande", rotulo: "Grande" },
] as const;
export type PortePetPedido = (typeof PORTES_PET_PEDIDO)[number]["valor"];

export interface CamposNovos {
  bairros?: string[];
  quartosMin?: number | null;
  orcamentoMin?: number | null;
  necessidades?: string[];
  portePet?: string | null;
  /** Prompt 57 fase 2: download medido mínimo (50, 100 ou 300 Mbps); nulo = sem exigência. */
  internetMinMbps?: number | null;
}

export interface CamposNovosValidos {
  bairros: string[];
  quartosMin: number | null;
  orcamentoMin: number | null;
  necessidades: Necessidade[];
  portePet: PortePetPedido | null;
  internetMinMbps: number | null;
}

/** Limpa um bairro digitado: sem controle, espaços simples, até 60 caracteres. */
export function limparBairro(b: string): string {
  return String(b ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/**
 * Validação do SERVIDOR (fonte da verdade). Bairros: até 3, sem repetidos (sem acento/maiúscula); vazio = qualquer
 * bairro. Faixa de valor: mínimo ≤ máximo. Porte do pet só com pet.
 */
export function validarCamposNovos(
  c: CamposNovos,
  contexto: { orcamentoMax: number; pets: boolean },
): { ok: true; valor: CamposNovosValidos } | { ok: false; erro: string } {
  const vistos = new Set<string>();
  const bairros: string[] = [];
  for (const b of c.bairros ?? []) {
    const limpo = limparBairro(b);
    const k = chaveCidade(limpo);
    if (!k || vistos.has(k)) continue;
    vistos.add(k);
    bairros.push(limpo);
  }
  if (bairros.length > BAIRROS_MAX) return { ok: false, erro: `Escolha até ${BAIRROS_MAX} bairros (ou "${QUALQUER_BAIRRO}").` };

  let quartosMin: number | null = null;
  if (c.quartosMin != null) {
    const q = Number(c.quartosMin);
    if (!Number.isInteger(q) || q < 0 || q > 3) return { ok: false, erro: "Escolha o número de quartos." };
    quartosMin = q;
  }

  let orcamentoMin: number | null = null;
  if (c.orcamentoMin != null && Number(c.orcamentoMin) > 0) {
    const m = Number(c.orcamentoMin);
    if (!Number.isFinite(m) || m < 0) return { ok: false, erro: "Valor mínimo inválido." };
    if (m > contexto.orcamentoMax) return { ok: false, erro: "O valor mínimo precisa ser menor que o máximo." };
    orcamentoMin = Math.round(m);
  }

  const validas = new Set<string>(NECESSIDADES.map((n) => n.valor));
  const necessidades = [...new Set(c.necessidades ?? [])].filter((n): n is Necessidade => validas.has(n));
  if ((c.necessidades ?? []).some((n) => !validas.has(n))) return { ok: false, erro: "Necessidade inválida." };

  let portePet: PortePetPedido | null = null;
  if (contexto.pets && c.portePet) {
    const p = PORTES_PET_PEDIDO.find((x) => x.valor === c.portePet);
    if (!p) return { ok: false, erro: "Escolha o porte do pet." };
    portePet = p.valor;
  }
  let internetMinMbps: number | null = null;
  if (c.internetMinMbps != null && Number(c.internetMinMbps) > 0) {
    const v = Number(c.internetMinMbps);
    if (!(INTERNET.chipsBusca as readonly number[]).includes(v)) return { ok: false, erro: "Escolha a internet medida mínima." };
    internetMinMbps = v;
  }
  return { ok: true, valor: { bairros, quartosMin, orcamentoMin, necessidades, portePet, internetMinMbps } };
}

// ── Textos do cartão ──────────────────────────────────────────────────────────────────────────────────────────
const brl = (v: number) => `R$ ${Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

/** "R$ 2.500 a R$ 3.500" ou "até R$ 3.500". */
export function textoFaixaValor(min: number | null | undefined, max: number): string {
  return min && min > 0 ? `${brl(min)} a ${brl(max)}` : `até ${brl(max)}`;
}
export function textoQuartos(q: number | null | undefined): string {
  if (q == null) return "Qualquer tamanho";
  return QUARTOS_OPCOES.find((o) => o.valor === q)?.rotulo ?? "Qualquer tamanho";
}
export function textoBairros(bairros: string[] | null | undefined): string {
  return bairros && bairros.length ? bairros.join(", ") : QUALQUER_BAIRRO;
}
export function textoNecessidades(ns: string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const n of ns ?? []) {
    const r = NECESSIDADES.find((x) => x.valor === n)?.rotulo;
    if (r) out.push(r);
  }
  return out;
}
export function textoPortePet(p: string | null | undefined): string {
  const r = PORTES_PET_PEDIDO.find((x) => x.valor === p)?.rotulo;
  return r ? `Pet de porte ${r.toLowerCase()}` : "Com pet";
}

// ── Validade (espelha pedido_expira_calculado, 0184) ─────────────────────────────────────────────────────────
export const DIAS_VALIDADE = 30;
export const DIAS_AVISO_RENOVAR = 5;

/** Fim do dia de Brasília (23:59:59 −03:00) da data AAAA-MM-DD, em ms. */
function fimDoDiaBrasilia(dataISO: string): number {
  return Date.parse(`${dataISO}T23:59:59-03:00`);
}

/** Expira 30 dias depois de publicar/renovar e nunca antes do fim do dia da entrada. ISO. */
export function expiraEmPedido(dataInicioISO: string, baseISO: string): string {
  const base = Date.parse(baseISO);
  const trinta = base + DIAS_VALIDADE * 86_400_000;
  return new Date(Math.max(trinta, fimDoDiaBrasilia(dataInicioISO))).toISOString();
}

/** Aviso de renovação: a partir de 5 dias antes de expirar, uma vez por ciclo (renovar zera). */
export function deveAvisarRenovar(p: { status: string; expiraEm: string | null; avisoRenovarEm: string | null; renovadoEm: string | null }, agora: Date): boolean {
  if (p.status !== "ativo" || !p.expiraEm) return false;
  const exp = Date.parse(p.expiraEm);
  const t = agora.getTime();
  if (!(exp > t && exp - t <= DIAS_AVISO_RENOVAR * 86_400_000)) return false;
  if (!p.avisoRenovarEm) return true;
  // Já avisou neste ciclo? (depois da última renovação)
  return !!p.renovadoEm && Date.parse(p.avisoRenovarEm) < Date.parse(p.renovadoEm);
}
export const TEXTO_AVISO_RENOVAR = "Ainda procurando? Renove com um clique";

/** "dd/mm/aaaa" no fuso de Brasília. */
export function dataPedidoBR(iso: string | null | undefined): string {
  const d = new Date(String(iso ?? ""));
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
}

/** Prompt 57 fase 2: o que o dono lê no cartão do pedido ("Internet medida 100+ Mbps"); sem exigência → null. */
export function textoInternetPedido(mbps: number | null | undefined): string | null {
  return mbps && mbps > 0 ? `Internet medida ${mbps}+ Mbps` : null;
}
