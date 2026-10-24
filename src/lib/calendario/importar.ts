/**
 * Calendário sincronizado (ordens 7f905568 / 7d961c3e, parte 2: IMPORTAÇÃO, só a base pura).
 * O dono cola o link .ics do Airbnb/Booking/Vrbo; aqui ficam as regras que não tocam em rede nem banco:
 * quais links aceitamos e como ler o arquivo. Só DATAS saem daqui — nome, descrição e contato de hóspedes
 * de outras plataformas são descartados na leitura.
 */

export const LIMITE_BYTES_ICS = 1_000_000;
export const LIMITE_EVENTOS_ICS = 2000;
/** Prompt 53: até 3 links por imóvel (Airbnb, Booking e mais um). */
export const LIMITE_LINKS_POR_IMOVEL = 3;

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

// ── Prompt 53: o resto das regras da importação (puras) ─────────────────────────────────────────────────────────

export type OrigemLink = "airbnb" | "booking" | "vrbo" | "outro";

/** De onde vem o link (pelo domínio). Só para o rótulo da tela. */
export function origemDoLink(url: string): OrigemLink {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "outro";
  }
  if (/(^|\.)airbnb\.[a-z.]+$/.test(host)) return "airbnb";
  if (/(^|\.)booking\.com$/.test(host)) return "booking";
  if (/(^|\.)(vrbo|homeaway)\.[a-z.]+$/.test(host)) return "vrbo";
  return "outro";
}

/** O que a tela mostra do link: só o domínio (o link inteiro dá acesso ao calendário e não volta à tela). */
export function dominioDoLink(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export const ROTULO_ORIGEM: Record<OrigemLink, string> = { airbnb: "Airbnb", booking: "Booking", vrbo: "Vrbo", outro: "Outro site" };

/** A resposta é um calendário? text/calendar (com ou sem charset). */
export function tipoDeCalendario(contentType: string | null | undefined): boolean {
  return /^\s*text\/calendar\b/i.test(contentType ?? "");
}

const chave = (b: { inicio: string; fim: string }) => `${b.inicio}|${b.fim}`;

/**
 * Sincronia de UMA importação: o que entra e o que sai dos bloqueios dela. Só datas de hoje em diante entram; o que
 * sumiu do outro site sai daqui. Bloqueio manual do dono nunca está em `atuais` (só os desta importação), então nunca
 * é apagado.
 */
export function planoDeSincronia(
  atuais: { id: string; inicio: string; fim: string }[],
  lidos: BloqueioExterno[],
  hoje: string,
): { inserir: BloqueioExterno[]; apagar: string[] } {
  const futuros = new Map<string, BloqueioExterno>();
  for (const b of lidos) if (b.fim >= hoje) futuros.set(chave(b), b);
  const atuaisPorChave = new Map(atuais.map((a) => [chave(a), a]));
  return {
    inserir: [...futuros.values()].filter((b) => !atuaisPorChave.has(chave(b))).sort((a, b) => a.inicio.localeCompare(b.inicio)),
    apagar: atuais.filter((a) => !futuros.has(chave(a))).map((a) => a.id),
  };
}

/** Intervalos (dias inclusivos) se cruzam? */
export const cruzam = (a: { inicio: string; fim: string }, b: { inicio: string; fim: string }) => a.inicio <= b.fim && b.inicio <= a.fim;

/**
 * Conflito: data importada ocupada que cai num compromisso da Viva (candidatura, proposta ou contrato). Só AVISA o dono
 * (a decisão é dele); nada é cancelado.
 */
export function conflitosComViva<T extends { inicio: string; fim: string; tipo: string }>(importados: BloqueioExterno[], viva: T[]): { importado: BloqueioExterno; compromisso: T }[] {
  const out: { importado: BloqueioExterno; compromisso: T }[] = [];
  for (const i of importados) for (const v of viva) if (cruzam(i, v)) out.push({ importado: i, compromisso: v });
  return out;
}

/** Falhas seguidas que geram o aviso ao dono (uma vez por sequência). */
export const FALHAS_PARA_AVISAR = 3;
export const avisarFalha = (falhasSeguidas: number) => falhasSeguidas === FALHAS_PARA_AVISAR;

/** A causa em palavras do dono, a partir do erro técnico da leitura. */
export function causaDaFalha(erro: string, origem: OrigemLink): string {
  const site = origem === "outro" ? "no outro site" : `no ${ROTULO_ORIGEM[origem]}`;
  if (/404|410|403|401/.test(erro)) return `O link deixou de responder: gere um novo ${site} e cole aqui.`;
  if (/calend|ics|VCALENDAR/i.test(erro)) return `O link não devolve um calendário: confira se copiou o link de exportação (.ics) ${site}.`;
  if (/grande|eventos demais/i.test(erro)) return "O calendário é grande demais para importar.";
  return `Não conseguimos ler o link: gere um novo ${site} e cole aqui.`;
}

/** Leitura a cada 3 h (o cron roda de hora em hora e lê só o que passou disso). */
export const HORAS_ENTRE_LEITURAS = 3;
export function precisaLer(ultimaLeitura: string | null, agora: Date): boolean {
  if (!ultimaLeitura) return true;
  return agora.getTime() - Date.parse(ultimaLeitura) >= HORAS_ENTRE_LEITURAS * 3_600_000 - 10 * 60_000;
}
