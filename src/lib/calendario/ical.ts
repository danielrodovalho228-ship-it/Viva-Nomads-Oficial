import crypto from "node:crypto";

/**
 * Calendário sincronizado (ordem 7f905568, parte 1: EXPORTAÇÃO). O dono cola o link .ics no
 * Airbnb/Booking e as datas ocupadas por contratos Viva passam a bloquear lá. PURO (sem banco).
 * Privacidade: o evento é só "Ocupado" — nunca nome, contato ou valor do inquilino.
 * O link é secreto por imóvel: HMAC(imóvel) com segredo de servidor, sem migração.
 */

export interface Ocupacao {
  inicio: string; // AAAA-MM-DD
  fim: string; // AAAA-MM-DD (dia de saída; no iCal DTEND é exclusivo, então a noite do fim fica livre)
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export function segredoCalendario(env: Record<string, string | undefined> = process.env): string {
  return env.CALENDARIO_SEGREDO || env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function tokenCalendario(propertyId: string, segredo: string): string | null {
  if (!propertyId || !segredo) return null;
  return crypto.createHmac("sha256", `calendario:${segredo}`).update(propertyId).digest("hex").slice(0, 32);
}

export function tokenCalendarioValido(propertyId: string, token: unknown, segredo: string): boolean {
  const esperado = tokenCalendario(propertyId, segredo);
  if (!esperado || typeof token !== "string" || token.length !== esperado.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(esperado));
}

const compacta = (d: string) => d.replaceAll("-", "");

/** Dia seguinte (bloqueio do dono é inclusivo no último dia; no iCal o fim é exclusivo). */
function diaSeguinte(d: string): string {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

/**
 * E44: o que a exportação publica. Contratos ativos (fim = dia de saída, já exclusivo) e os bloqueios MANUAIS do dono
 * (o último dia bloqueado também fica ocupado → fim + 1). Bloqueio IMPORTADO de outro site não volta para fora: senão o
 * Airbnb recebe de volta as próprias datas e os calendários se realimentam.
 */
export function ocupacoesDaExportacao(e: {
  contratos: Ocupacao[];
  bloqueios: { inicio: string; fim: string; origem?: string | null }[];
}): Ocupacao[] {
  const manuais = e.bloqueios
    .filter((b) => (b.origem ?? "manual") === "manual" && DATA.test(b.inicio) && DATA.test(b.fim) && b.fim >= b.inicio)
    .map((b) => ({ inicio: b.inicio, fim: diaSeguinte(b.fim) }));
  return [...e.contratos, ...manuais].sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** Link de exportação que o dono cola no Airbnb/Booking; null sem segredo de servidor. */
export function urlExportacaoCalendario(siteUrl: string, propertyId: string, segredo: string): string | null {
  const t = tokenCalendario(propertyId, segredo);
  return t ? `${siteUrl.replace(/\/$/, "")}/api/calendario/${propertyId}/${t}.ics` : null;
}

/** Gera o .ics. Ocupações inválidas (data mal formada ou fim antes do início) são ignoradas. */
export function gerarIcs(propertyId: string, ocupacoes: Ocupacao[], agora: Date): string {
  const carimbo = agora.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Viva Nomads//Calendario//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const o of ocupacoes) {
    if (!DATA.test(o.inicio) || !DATA.test(o.fim) || o.fim <= o.inicio) continue;
    linhas.push(
      "BEGIN:VEVENT",
      `UID:${propertyId}-${compacta(o.inicio)}-${compacta(o.fim)}@vivanomads.com.br`,
      `DTSTAMP:${carimbo}`,
      `DTSTART;VALUE=DATE:${compacta(o.inicio)}`,
      `DTEND;VALUE=DATE:${compacta(o.fim)}`,
      "SUMMARY:Ocupado",
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  linhas.push("END:VCALENDAR");
  return linhas.join("\r\n") + "\r\n";
}
