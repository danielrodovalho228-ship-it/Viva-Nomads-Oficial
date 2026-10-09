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
      `UID:${propertyId}-${compacta(o.inicio)}@vivanomads.com.br`,
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
