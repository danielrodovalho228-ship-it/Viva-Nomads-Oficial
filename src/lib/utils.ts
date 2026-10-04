import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina classes condicionais e resolve conflitos do Tailwind. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata um valor numérico em reais (R$). */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Distância em km entre duas coordenadas (fórmula de Haversine). */
export function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const R = 6371; // raio da Terra em km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Normaliza um slug de cidade ("uberlandia" -> "Uberlândia"). */
export function cityFromSlug(slug: string): string {
  const map: Record<string, string> = {
    uberlandia: "Uberlândia",
    "sao-paulo": "São Paulo",
    "rio-de-janeiro": "Rio de Janeiro",
    "belo-horizonte": "Belo Horizonte",
    curitiba: "Curitiba",
    goiania: "Goiânia",
  };
  return (
    map[slug] ??
    slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

/** Fuso de referência das datas da plataforma (o mercado é o Brasil). */
export const FUSO_BR = "America/Sao_Paulo";

/** "AAAA-MM-DD" de um instante, no horário de Brasília (não em UTC). */
export function isoDiaBR(instante: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_BR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
}

/** "Hoje" no horário de Brasília (AAAA-MM-DD). Às 22h de Brasília ainda é hoje. */
export function hojeBR(agora: Date = new Date()): string {
  return isoDiaBR(agora);
}

/**
 * Data no formato brasileiro (10/07/2026). "AAAA-MM-DD" (só data) é lido como
 * está — "2026-07-10" não vira dia 09. Data COM HORA (timestamp) é convertida
 * para o horário de Brasília: "2026-10-20T02:00:00Z" é dia 19 em Brasília.
 */
export function dataBR(iso: string | null | undefined): string {
  const txt = String(iso ?? "");
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(txt)) {
    const d = new Date(txt.replace(" ", "T"));
    if (!Number.isNaN(d.getTime())) {
      const [a, m, dia] = isoDiaBR(d).split("-");
      return `${dia}/${m}/${a}`;
    }
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(txt);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

/** Número com vírgula decimal (pt-BR): numBR(18.4123, 2) → "18,41". */
export function numBR(v: number, casas = 1): string {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
