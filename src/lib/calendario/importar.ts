/**
 * Calendário sincronizado (ordens 7f905568 / 7d961c3e, parte 2: IMPORTAÇÃO, só a base pura).
 * O dono cola o link .ics do Airbnb/Booking/Vrbo; aqui ficam as regras que não tocam em rede nem banco:
 * quais links aceitamos e como ler o arquivo. Só DATAS saem daqui — nome, descrição e contato de hóspedes
 * de outras plataformas são descartados na leitura.
 */

export const LIMITE_BYTES_ICS = 1_000_000;
export const LIMITE_EVENTOS_ICS = 2000;
export const LIMITE_LINKS_POR_IMOVEL = 10;

export interface BloqueioExterno {
  inicio: string; // AAAA-MM-DD, primeiro dia ocupado
  fim: string; // AAAA-MM-DD, último dia ocupado (inclusive, como em property_blocks)
}

export type ResultadoIcs = { ok: true; bloqueios: BloqueioExterno[] } | { ok: false; erro: string };

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Só https, sem usuário/senha, porta padrão e sem endereço interno (evita que o servidor busque rede privada). */
export function urlIcalPermitida(entrada: unknown): { ok: true; url: string } | { ok: false; erro: string } {
  if (typeof entrada !== "string" || entrada.trim().length === 0 || entrada.length > 2048) {
    return { ok: false, erro: "Cole o link do calendário (.ics)." };
  }
  let u: URL;
  try {
    u = new URL(entrada.trim().replace(/^webcal:\/\//i, "https://"));
  } catch {
    return { ok: false, erro: "Esse link não parece válido." };
  }
  if (u.protocol !== "https:") return { ok: false, erro: "Use um link https." };
  if (u.username || u.password) return { ok: false, erro: "O link não pode ter usuário ou senha." };
  if (u.port && u.port !== "443") return { ok: false, erro: "Esse link usa uma porta não aceita." };
  const host = u.hostname.toLowerCase();
  const interno =
    !host.includes(".") ||
    host.startsWith("[") ||
    IPV4.test(host) ||
    host === "localhost" ||
    /\.(local|localhost|internal|lan|home|corp)$/.test(host);
  if (interno) return { ok: false, erro: "Esse endereço não é aceito. Use o link público do Airbnb, Booking ou Vrbo." };
  return { ok: true, url: u.toString() };
}

const dia = (v: string): string | null => {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(v.trim());
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
};

const menosUmDia = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** Lê o .ics e devolve só intervalos de datas. DTEND é exclusivo no iCal, então o último dia ocupado é DTEND − 1. */
export function lerIcs(texto: unknown): ResultadoIcs {
  if (typeof texto !== "string" || !/^\s*BEGIN:VCALENDAR/i.test(texto)) {
    return { ok: false, erro: "O arquivo não é um calendário .ics válido." };
  }
  if (texto.length > LIMITE_BYTES_ICS) return { ok: false, erro: "O calendário é grande demais." };

  const linhas = texto.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const bloqueios: BloqueioExterno[] = [];
  let atual: { inicio?: string; fim?: string; cancelado?: boolean } | null = null;
  let eventos = 0;

  for (const linha of linhas) {
    const l = linha.trim();
    if (/^BEGIN:VEVENT$/i.test(l)) {
      eventos += 1;
      if (eventos > LIMITE_EVENTOS_ICS) return { ok: false, erro: "O calendário tem eventos demais." };
      atual = {};
    } else if (/^END:VEVENT$/i.test(l)) {
      if (atual?.inicio && !atual.cancelado) {
        const ultimo = atual.fim && atual.fim > atual.inicio ? menosUmDia(atual.fim) : atual.inicio;
        bloqueios.push({ inicio: atual.inicio, fim: ultimo });
      }
      atual = null;
    } else if (atual) {
      const i = l.indexOf(":");
      if (i < 0) continue;
      const nome = l.slice(0, i).split(";")[0].toUpperCase();
      const valor = l.slice(i + 1);
      if (nome === "DTSTART") atual.inicio = dia(valor) ?? undefined;
      else if (nome === "DTEND") atual.fim = dia(valor) ?? undefined;
      else if (nome === "STATUS") atual.cancelado = /^CANCELLED$/i.test(valor.trim());
    }
  }
  return { ok: true, bloqueios };
}
