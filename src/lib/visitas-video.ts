/**
 * Visita por vídeo (ordem 6f964617, telas 8 e 9). Regras puras; a ação do servidor e as telas só usam isto.
 *
 *  - o morador propõe de 1 a 3 horários nos próximos 7 dias;
 *  - o proprietário confirma um horário e informa o link da chamada (Meet, Zoom, Teams ou chamada do WhatsApp);
 *  - wa.me e api.whatsapp.com ficam de fora: expõem o número. O link é só da chamada;
 *  - o proprietário nunca vê nome, telefone nem e-mail do morador (contato protegido até o aceite).
 */
export const MAX_HORARIOS = 3;
export const JANELA_DIAS = 7;

export type StatusVisita = "pedido" | "confirmado" | "feito" | "cancelado";
export type QuemAge = "dono" | "morador";

export const STATUS_VISITA_ROTULO: Record<StatusVisita, string> = {
  pedido: "Pedido enviado",
  confirmado: "Confirmada",
  feito: "Feita",
  cancelado: "Cancelada",
};

export const MSG_HORARIOS = `Escolha de 1 a ${MAX_HORARIOS} horários nos próximos ${JANELA_DIAS} dias.`;

export type ResultadoHorarios = { ok: true; horarios: string[] } | { ok: false; error: string };

/** Valida os horários vindos do navegador (ISO). Devolve ISO em UTC, ordenados e sem repetição. */
export function validarHorarios(entrada: unknown, agora: Date = new Date()): ResultadoHorarios {
  if (!Array.isArray(entrada) || entrada.length === 0 || entrada.length > MAX_HORARIOS) return { ok: false, error: MSG_HORARIOS };
  const limite = agora.getTime() + JANELA_DIAS * 24 * 3600_000;
  const vistos = new Set<number>();
  for (const h of entrada) {
    if (typeof h !== "string" || h.length > 40) return { ok: false, error: MSG_HORARIOS };
    const t = Date.parse(h);
    if (!Number.isFinite(t)) return { ok: false, error: MSG_HORARIOS };
    if (t <= agora.getTime()) return { ok: false, error: "Escolha horários que ainda não passaram." };
    if (t > limite) return { ok: false, error: MSG_HORARIOS };
    vistos.add(Math.floor(t / 60_000) * 60_000);
  }
  return { ok: true, horarios: [...vistos].sort((a, b) => a - b).map((t) => new Date(t).toISOString()) };
}

const HOSTS_CHAMADA = ["meet.google.com", "zoom.us", "teams.microsoft.com", "teams.live.com", "call.whatsapp.com"];

export type ResultadoLink = { ok: true; url: string } | { ok: false; error: string };

export const MSG_LINK =
  "Informe o link da chamada (Google Meet, Zoom, Teams ou chamada de vídeo do WhatsApp). Link com número de telefone não é aceito.";

export function validarLinkChamada(entrada: unknown): ResultadoLink {
  if (typeof entrada !== "string") return { ok: false, error: MSG_LINK };
  const texto = entrada.trim();
  if (!texto || texto.length > 300) return { ok: false, error: MSG_LINK };
  let u: URL;
  try {
    u = new URL(texto);
  } catch {
    return { ok: false, error: MSG_LINK };
  }
  if (u.protocol !== "https:" || u.username || u.password) return { ok: false, error: MSG_LINK };
  const host = u.hostname.toLowerCase();
  const confere = HOSTS_CHAMADA.some((h) => host === h || host.endsWith(`.${h}`));
  return confere ? { ok: true, url: u.toString() } : { ok: false, error: MSG_LINK };
}

const TRANSICOES: Record<StatusVisita, Partial<Record<StatusVisita, QuemAge[]>>> = {
  pedido: { confirmado: ["dono"], cancelado: ["dono", "morador"] },
  confirmado: { feito: ["dono"], cancelado: ["dono", "morador"] },
  feito: {},
  cancelado: {},
};

export function podeTransicionar(de: StatusVisita, para: StatusVisita, quem: QuemAge): boolean {
  return TRANSICOES[de]?.[para]?.includes(quem) ?? false;
}

export function ehStatusVisita(v: unknown): v is StatusVisita {
  return v === "pedido" || v === "confirmado" || v === "feito" || v === "cancelado";
}

/** "sáb., 18/10 às 14:30" no fuso de Brasília, igual no servidor e no navegador. */
export function formatarHorario(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("weekday")}, ${g("day")}/${g("month")} às ${g("hour")}:${g("minute")}`;
}
