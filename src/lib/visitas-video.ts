/**
 * Visitas (ordem 6f964617, telas 8 e 9; prompt 23). Regras puras; a ação do servidor e as telas só usam isto.
 * Duas modalidades no mesmo fluxo: por VÍDEO (com o link da chamada) e PRESENCIAL (o endereço exato só aparece
 * para o morador depois da confirmação). Nada de WhatsApp nem contato direto: tudo pela plataforma.
 *
 * Fuso (prompt 23, P0): toda hora de visita é do fuso do imóvel — America/Sao_Paulo (Uberlândia) —, gravada como
 * timestamptz e mostrada com a etiqueta "horário de Brasília". O seletor interpreta a hora escolhida nesse fuso,
 * qualquer que seja o fuso do navegador (o QA marcou 15:00 num computador nos EUA e o dono viu 17:00).
 *
 *  - o morador propõe de 1 a 3 horários nos próximos 7 dias;
 *  - o proprietário confirma um horário e informa o link da chamada (Meet, Zoom, Teams ou chamada do WhatsApp);
 *  - wa.me e api.whatsapp.com ficam de fora: expõem o número. O link é só da chamada;
 *  - o proprietário nunca vê nome, telefone nem e-mail do morador (contato protegido até o aceite).
 */
export const MAX_HORARIOS = 3;
export const JANELA_DIAS = 7;

export type StatusVisita = "pedido" | "confirmado" | "remarcar" | "feito" | "cancelado";
export type QuemAge = "dono" | "morador";
export type ModalidadeVisita = "video" | "presencial";

export const STATUS_VISITA_ROTULO: Record<StatusVisita, string> = {
  pedido: "Pedida",
  confirmado: "Confirmada",
  remarcar: "Remarcar",
  feito: "Feita",
  cancelado: "Cancelada",
};

export const MODALIDADE_ROTULO: Record<ModalidadeVisita, string> = { video: "Por vídeo", presencial: "Presencial" };

export function ehModalidade(v: unknown): v is ModalidadeVisita {
  return v === "video" || v === "presencial";
}

/* ── Fuso do imóvel ─────────────────────────────────────────────────────────── */

export const FUSO_VISITA = "America/Sao_Paulo";
export const ROTULO_FUSO = "horário de Brasília";

/** Diferença (ms) entre a hora de parede em FUSO_VISITA e UTC, no instante dado (−3 h hoje; segue o Intl). */
function deslocamentoFuso(instante: number): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO_VISITA,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instante));
  const n = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - instante;
}

/**
 * Valor de <input type="datetime-local"> ("2026-10-21T15:00") lido como hora de BRASÍLIA → instante ISO (UTC).
 * Não usa o fuso do navegador. Valor inválido → null.
 */
export function campoBrasiliaParaIso(valor: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(valor.trim());
  if (!m) return null;
  const [, a, me, d, h, mi] = m.map(Number);
  const comoUtc = Date.UTC(a, me - 1, d, h, mi);
  if (new Date(comoUtc).getUTCMonth() !== me - 1 || h > 23 || mi > 59) return null;
  // Duas passadas: o deslocamento depende do próprio instante (troca de horário de verão, se voltar a existir).
  let t = comoUtc - deslocamentoFuso(comoUtc);
  t = comoUtc - deslocamentoFuso(t);
  return new Date(t).toISOString();
}

/** Instante → valor de <input type="datetime-local"> na hora de BRASÍLIA (para min/max e para mostrar). */
export function instanteParaCampoBrasilia(d: Date): string {
  const t = d.getTime() + deslocamentoFuso(d.getTime());
  return new Date(t).toISOString().slice(0, 16);
}

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
  pedido: { confirmado: ["dono"], remarcar: ["dono"], cancelado: ["dono", "morador"] },
  // Remarcar: o dono propôs outro horário; o morador aceita (vira Confirmada) ou cancela.
  remarcar: { confirmado: ["morador"], cancelado: ["dono", "morador"] },
  confirmado: { feito: ["dono"], remarcar: ["dono"], cancelado: ["dono", "morador"] },
  feito: {},
  cancelado: {},
};

export function podeTransicionar(de: StatusVisita, para: StatusVisita, quem: QuemAge): boolean {
  return TRANSICOES[de]?.[para]?.includes(quem) ?? false;
}

export type AcaoVisitaDono =
  | { acao: "confirmar"; horario: string; link?: string }
  | { acao: "remarcar"; horario: string; link?: string }
  | { acao: "aceitar_remarcacao" }
  | { acao: "cancelar"; motivo?: string }
  | { acao: "concluir" };

/** Janela para o dono confirmar ou propor um horário: de agora até 14 dias. */
export const CONFIRMAR_ATE_DIAS = 14;
export const MSG_HORARIO_CONFIRMAR = `Escolha um horário nos próximos ${CONFIRMAR_ATE_DIAS} dias.`;
export const MOTIVO_RECUSA_MIN = 3;
export const MOTIVO_RECUSA_MAX = 200;
export const MSG_MOTIVO_RECUSA = "Diga o motivo da recusa (ex.: imóvel já alugado nessas datas).";

/**
 * A mudança de status de um pedido, decidida aqui (puro) e só GRAVADA pela ação do servidor: o status novo, quem
 * pode e os campos validados — horário dentro da janela, link da chamada (só no vídeo), motivo da recusa (o dono
 * recusa um pedido sempre com motivo) e, ao aceitar a remarcação, o horário que o dono propôs.
 */
export function mudancaDeStatus(
  de: StatusVisita,
  quem: QuemAge,
  entrada: AcaoVisitaDono,
  agora: Date = new Date(),
  atual: { modalidade?: ModalidadeVisita; horarioProposto?: string | null; linkChamada?: string | null } = {},
): { ok: true; campos: Record<string, string | null> } | { ok: false; error: string } {
  const modalidade = atual.modalidade ?? "video";
  const para = statusAposAcao(entrada.acao);
  if (!podeTransicionar(de, para, quem)) return { ok: false, error: "Este pedido não pode mais ser alterado." };
  const campos: Record<string, string | null> = { status: para, atualizado_em: agora.toISOString() };

  if (entrada.acao === "confirmar" || entrada.acao === "remarcar") {
    const alvo = Date.parse(entrada.horario);
    const t = agora.getTime();
    if (!Number.isFinite(alvo) || alvo <= t || alvo > t + CONFIRMAR_ATE_DIAS * 24 * 3600_000) return { ok: false, error: MSG_HORARIO_CONFIRMAR };
    if (modalidade === "video") {
      const link = validarLinkChamada(entrada.link);
      if (!link.ok) return { ok: false, error: link.error };
      campos.link_chamada = link.url;
    }
    if (entrada.acao === "confirmar") {
      campos.horario_confirmado = new Date(alvo).toISOString();
      campos.horario_proposto = null;
    } else {
      campos.horario_proposto = new Date(alvo).toISOString();
      campos.horario_confirmado = null;
    }
  }
  if (entrada.acao === "aceitar_remarcacao") {
    if (!atual.horarioProposto) return { ok: false, error: "Não há horário proposto para aceitar." };
    if (Date.parse(atual.horarioProposto) <= agora.getTime()) return { ok: false, error: "O horário proposto já passou. Peça outro ao proprietário." };
    campos.horario_confirmado = atual.horarioProposto;
    campos.horario_proposto = null;
  }
  if (entrada.acao === "cancelar") {
    const motivo = typeof entrada.motivo === "string" ? entrada.motivo.replace(/\s+/g, " ").trim() : "";
    // O dono RECUSA um pedido (ou uma remarcação) sempre com motivo; o morador cancela sem precisar explicar.
    if (quem === "dono" && de !== "confirmado" && (motivo.length < MOTIVO_RECUSA_MIN || motivo.length > MOTIVO_RECUSA_MAX)) {
      return { ok: false, error: MSG_MOTIVO_RECUSA };
    }
    campos.motivo_recusa = motivo ? motivo.slice(0, MOTIVO_RECUSA_MAX) : null;
  }
  return { ok: true, campos };
}

/**
 * Status que o pedido passa a ter depois de uma ação aceita pelo servidor — a tela usa isto na hora, sem esperar o
 * recarregamento (t168, #842). Inclui as ações do prompt 23 (Remarcar e aceitar o novo horário).
 */
export function statusAposAcao(acao: AcaoVisitaDono["acao"]): StatusVisita {
  return acao === "confirmar" || acao === "aceitar_remarcacao"
    ? "confirmado"
    : acao === "remarcar"
      ? "remarcar"
      : acao === "concluir"
        ? "feito"
        : "cancelado";
}

export function ehStatusVisita(v: unknown): v is StatusVisita {
  return v === "pedido" || v === "confirmado" || v === "remarcar" || v === "feito" || v === "cancelado";
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

/** Igual, com a etiqueta do fuso: "qua., 21/10 às 15:00 (horário de Brasília)". */
export function formatarHorarioBrasilia(iso: string): string {
  const t = formatarHorario(iso);
  return t ? `${t} (${ROTULO_FUSO})` : "";
}
