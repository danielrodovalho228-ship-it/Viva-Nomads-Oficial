/*
  Alerta de busca salva (ordem cb9a09e9) — PURO. Responde "este imóvel recém-
  publicado combina com esta busca salva?" com a MESMA regra da /buscar (os
  mesmos campos da URL), e monta o texto do e-mail. Sem banco, sem envio.

  Regra de ouro: sem a informação no imóvel, o filtro NÃO bate (não alertamos
  por palpite). Endereço/coordenada nunca entram no e-mail: só cidade e bairro
  (região aproximada), como na página pública.
*/
import { normalizarBusca, resumoDaBusca } from "./buscas-salvas.ts";
import { passaNoPainel } from "./painel-filtros.ts";
import { comodidadesDaUrl } from "./filtro-comodidades.ts";
import { PROPERTY_TYPES } from "../amenities.ts";
import type { PortePet, RegrasPets } from "../anuncio/pets-regras.ts";

export interface ImovelParaAlerta {
  id: string;
  title: string;
  city: string;
  neighborhood: string;
  propertyType: string;
  monthlyPrice: number;
  bedrooms: number;
  minPeriodDays: number;
  maxGuests?: number | null;
  availableFrom?: string | null;
  furnished?: boolean | null;
  petsAllowed?: boolean;
  petsRegras?: RegrasPets | null;
  tagHomeOffice: boolean;
  tagWorkLocated?: boolean;
  readyToLiveBadge?: boolean;
  issuesInvoice?: boolean;
  acceptsInsurance?: boolean;
  ownershipType?: "own" | "subleased" | "managed";
  subleaseAuthorized?: boolean;
  faixasAceitas?: string[];
  garantiasAceitas?: string[];
  amenities?: string[];
  comodidadesFiltro?: string[];
  parkingSpots?: number;
}

/** Máximo de e-mails de alerta por busca por dia (o resto vai no resumo). */
export const ALERTAS_POR_BUSCA_POR_DIA = 1;
/** Máximo de imóveis listados num mesmo e-mail (o resto vira "e mais N"). */
export const MAX_IMOVEIS_NO_EMAIL = 5;

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function tipoCanonico(pt: string): string {
  const low = pt.toLowerCase();
  if (PROPERTY_TYPES.some((t) => t.value === low)) return low;
  return PROPERTY_TYPES.find((t) => t.label.toLowerCase() === low || t.label.toLowerCase().startsWith(low))?.value ?? low;
}

function aceitaGarantia(p: ImovelParaAlerta, g: string): boolean {
  const arr = p.garantiasAceitas ?? [];
  if (g === "seguro_fianca") return arr.includes("seguro_fianca") || !!p.acceptsInsurance;
  if (g === "caucao") return arr.some((x) => x === "caucao" || x.startsWith("caucao_"));
  return arr.includes(g);
}

/** O imóvel combina com a busca salva (query string normalizada)? */
export function imovelBateComBusca(parametros: string, p: ImovelParaAlerta): boolean {
  const sp = new URLSearchParams(normalizarBusca(parametros));
  const on = (k: string) => sp.get(k) === "1";
  const num = (k: string) => Number(sp.get(k)) || 0;

  // Local: texto digitado (cidade/bairro). Busca por raio (lat/lng) sem texto não é avaliada aqui.
  const local = sp.get("local");
  if (local) {
    const alvo = semAcento(local);
    const cidade = semAcento(p.city);
    const regiao = semAcento(`${p.neighborhood} ${p.city}`);
    // "Uberlândia, MG" / "Uberlândia - MG": compara pelo primeiro trecho, como o usuário digita.
    const primeiro = alvo.split(/[,\-–]/)[0].trim();
    if (!(regiao.includes(alvo) || cidade === primeiro || regiao.includes(primeiro))) return false;
  } else if (sp.get("lat") && sp.get("lng")) {
    return false; // só por raio: sem como conferir sem coordenada exata → não alerta.
  }

  const orc = num("orcamento") || num("preco");
  const quartos = num("quartos");
  const porte = sp.get("porte");
  const painel = {
    maxPrice: orc >= 300 && orc <= 50000 ? orc : 0,
    minBedrooms: [1, 2, 3].includes(quartos) ? quartos : 0,
    petsOnly: on("pet"),
    petPorte: (on("pet") && (porte === "P" || porte === "M" || porte === "G") ? porte : "") as PortePet | "",
    homeOfficeOnly: on("homeoffice"),
    readyToLiveOnly: on("pronto"),
    comodidades: comodidadesDaUrl(sp.get("comod")),
  };
  if (!passaNoPainel(p, painel)) return false;

  const hospedes = (num("adultos") || 1) + num("criancas");
  if (p.maxGuests != null && p.maxGuests < hospedes) return false;

  const perMap: Record<number, number> = { 30: 60, 60: 60, 90: 120, 120: 120, 180: 180 };
  const periodo = perMap[num("periodo")];
  if (periodo && p.minPeriodDays > periodo) return false;

  const tipo = sp.get("tipo");
  if (tipo && tipoCanonico(p.propertyType) !== tipo) return false;
  const faixa = sp.get("faixa");
  if (faixa && !(p.faixasAceitas ?? []).includes(faixa)) return false;
  const entrada = sp.get("entrada");
  if (entrada && /^\d{4}-\d{2}-\d{2}$/.test(entrada) && p.availableFrom && p.availableFrom > entrada) return false;
  const garantia = sp.get("garantia");
  if (garantia && !aceitaGarantia(p, garantia)) return false;

  if (on("mobiliado") && !p.furnished) return false;
  if (on("localizado") && !p.tagWorkLocated) return false;
  if (on("nota") && !p.issuesInvoice) return false;
  if (on("seguro") && !p.acceptsInsurance) return false;
  if (on("gestor") && !(p.ownershipType && p.ownershipType !== "own" && p.subleaseAuthorized)) return false;
  return true;
}

// ── Link de desligar (sem login), assinado por HMAC — só no servidor ──────────

import crypto from "node:crypto";

/** Assinatura do link "Desligar este alerta" (um por busca; não expira, só desliga). */
export function assinarDesligarAlerta(buscaId: string, segredo: string): string {
  return crypto.createHmac("sha256", segredo).update(`alerta-busca:${buscaId}`).digest("base64url");
}

export function conferirDesligarAlerta(buscaId: string, assinatura: string, segredo: string): boolean {
  if (!/^[0-9a-f-]{36}$/i.test(buscaId) || !assinatura || !segredo) return false;
  const esperado = Buffer.from(assinarDesligarAlerta(buscaId, segredo));
  const recebido = Buffer.from(assinatura);
  return esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido);
}

// ── Texto do e-mail ───────────────────────────────────────────────────────────

export interface ImovelNoAlerta {
  id: string;
  title: string;
  city: string;
  neighborhood: string;
  monthlyPrice: number;
  bedrooms: number;
}

const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR")}`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Assunto: 1 imóvel → "Novo imóvel para sua busca"; vários → resumo com a contagem. */
export function assuntoDoAlerta(n: number): string {
  return n <= 1 ? "Novo imóvel para sua busca" : `${n} novos imóveis para sua busca`;
}

/** Linha de cada imóvel: "Studio no Centro · Uberlândia · R$ 2.400/mês · 1 quarto" (sem endereço, sem dono). */
export function linhaDoImovel(i: ImovelNoAlerta): string {
  const regiao = [i.neighborhood, i.city].filter(Boolean).join(", ");
  const q = i.bedrooms > 0 ? ` · ${i.bedrooms} ${i.bedrooms === 1 ? "quarto" : "quartos"}` : "";
  return `${i.title}${regiao ? ` — ${regiao}` : ""} · ${brl(i.monthlyPrice)}/mês${q}`;
}

export function montarAlerta(o: {
  buscaParametros: string;
  imoveis: ImovelNoAlerta[];
  siteUrl: string;
  desligarUrl: string | null;
  buscasUrl: string;
}): { subject: string; html: string; text: string } {
  const lista = o.imoveis.slice(0, MAX_IMOVEIS_NO_EMAIL);
  const resto = o.imoveis.length - lista.length;
  const resumo = resumoDaBusca(o.buscaParametros);
  const link = (i: ImovelNoAlerta) => `${o.siteUrl}/imoveis/${encodeURIComponent(i.id)}`;
  const desligar = o.desligarUrl ?? o.buscasUrl;
  const html = `
    <p style="margin:12px 0 4px;color:#334155;">Sua busca: <strong>${esc(resumo)}</strong></p>
    <ul style="margin:8px 0 0;padding:0;list-style:none;">
      ${lista
        .map(
          (i) => `<li style="margin:0 0 12px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:12px;">
        <div style="font-weight:700;color:#0f3d2e;">${esc(i.title)}</div>
        <div style="color:#475569;font-size:14px;margin-top:2px;">${esc([i.neighborhood, i.city].filter(Boolean).join(", "))} · ${brl(i.monthlyPrice)}/mês${i.bedrooms > 0 ? ` · ${i.bedrooms} ${i.bedrooms === 1 ? "quarto" : "quartos"}` : ""}</div>
        <a href="${link(i)}" style="display:inline-block;margin-top:10px;background:#1c6b3a;color:#fff;padding:10px 18px;border-radius:10px;font-weight:700;text-decoration:none;">Ver imóvel</a>
      </li>`
        )
        .join("")}
    </ul>
    ${resto > 0 ? `<p style="margin:4px 0 0;color:#475569;">…e mais ${resto} ${resto === 1 ? "imóvel" : "imóveis"} na sua busca: <a href="${o.siteUrl}/buscar${o.buscaParametros ? `?${esc(o.buscaParametros)}` : ""}" style="color:#0f3d2e;font-weight:700;">ver todos</a>.</p>` : ""}
    <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Você recebe no máximo 1 aviso por dia desta busca. <a href="${desligar}" style="color:#64748b;">Desligar o alerta desta busca</a>.</p>`;
  const text = [
    `Sua busca: ${resumo}`,
    "",
    ...lista.map((i) => `• ${linhaDoImovel(i)}\n  ${link(i)}`),
    resto > 0 ? `…e mais ${resto} na sua busca: ${o.siteUrl}/buscar${o.buscaParametros ? `?${o.buscaParametros}` : ""}` : "",
    "",
    `Você recebe no máximo 1 aviso por dia desta busca. Desligar o alerta desta busca: ${desligar}`,
  ]
    .filter((l, idx, arr) => l !== "" || arr[idx - 1] !== "")
    .join("\n");
  return { subject: assuntoDoAlerta(o.imoveis.length), html, text };
}
