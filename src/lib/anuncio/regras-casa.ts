/**
 * Regras da casa ESTRUTURADAS (CAMPOS-1, item 1 do adendo de campos de 23/10). Puro: sem banco, sem tela.
 * Silêncio (início/fim), fumo, festas e visitas (permitidas, até que horas, pernoite) e, desde o CAMPOS-3 (tela 06 dos
 * mockups do assistente), "Outras regras" em texto curto. Tudo opcional:
 * regra não definida não existe — nem no banco, nem no anúncio (sem "não informado").
 * A validação roda no servidor; o formulário só repete para avisar cedo.
 */

export const OPCOES_FUMO = [
  { valor: "proibido", rotulo: "Proibido" },
  { valor: "area_externa", rotulo: "Só na área externa" },
  { valor: "permitido", rotulo: "Permitido" },
] as const;
export const OPCOES_FESTAS = [
  { valor: "proibido", rotulo: "Proibidas" },
  { valor: "permitido", rotulo: "Permitidas" },
] as const;

export type Fumo = (typeof OPCOES_FUMO)[number]["valor"];
export type Festas = (typeof OPCOES_FESTAS)[number]["valor"];

export interface RegrasCasa {
  silencio?: { inicio: string; fim: string };
  fumo?: Fumo;
  festas?: Festas;
  visitas?: { permitidas: boolean; ate?: string; pernoite?: boolean };
  /** CAMPOS-3: "Outras regras (opcional)" da tela 06 — texto curto do dono, até MAX_OUTRAS_REGRAS caracteres. */
  outras?: string;
}

/** Tamanho máximo de "Outras regras": cabe numa linha da folha "Regras da casa" sem virar uma segunda descrição. */
export const MAX_OUTRAS_REGRAS = 280;

/** Texto livre limpo: sem caracteres de controle, espaços e quebras colapsados, cortado no máximo. Vazio = sem regra. */
export function limparOutrasRegras(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim()
    .slice(0, MAX_OUTRAS_REGRAS)
    .trim();
  return t.length > 0 ? t : undefined;
}

const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const hora = (v: unknown): string | undefined => (typeof v === "string" && HORA_RE.test(v.trim()) ? v.trim() : undefined);
const simNao = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

/** Aceita só o formato esperado; o que vier torto cai fora. Nada definido = null (a coluna fica nula). */
export function normalizarRegrasCasa(raw: unknown): RegrasCasa | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: RegrasCasa = {};

  const s = r.silencio as Record<string, unknown> | undefined;
  const inicio = s && typeof s === "object" ? hora(s.inicio) : undefined;
  const fim = s && typeof s === "object" ? hora(s.fim) : undefined;
  // Silêncio só vale com as duas pontas, e diferentes.
  if (inicio && fim && inicio !== fim) out.silencio = { inicio, fim };

  if (OPCOES_FUMO.some((o) => o.valor === r.fumo)) out.fumo = r.fumo as Fumo;
  if (OPCOES_FESTAS.some((o) => o.valor === r.festas)) out.festas = r.festas as Festas;

  const v = r.visitas as Record<string, unknown> | undefined;
  const permitidas = v && typeof v === "object" ? simNao(v.permitidas) : undefined;
  if (permitidas === false) out.visitas = { permitidas: false };
  else if (permitidas === true) {
    const ate = hora(v!.ate);
    const pernoite = simNao(v!.pernoite);
    out.visitas = { permitidas: true, ...(ate ? { ate } : {}), ...(pernoite !== undefined ? { pernoite } : {}) };
  }

  const outras = limparOutrasRegras(r.outras);
  if (outras) out.outras = outras;

  return Object.keys(out).length > 0 ? out : null;
}

/** "22:00" → "22h"; "22:30" → "22h30"; "08:00" → "8h". */
export function horaFalada(h: string): string {
  const [hh, mm] = h.split(":");
  return `${Number(hh)}h${mm === "00" ? "" : mm}`;
}

export type ChaveRegraCasa = "silencio" | "fumo" | "festas" | "visitas" | "outras";
export interface LinhaRegraCasa {
  chave: ChaveRegraCasa;
  texto: string;
}

const TEXTO_FUMO: Record<Fumo, string> = {
  proibido: "Não é permitido fumar no imóvel",
  area_externa: "Não fuma dentro de casa · só na área externa",
  permitido: "Pode fumar no imóvel",
};
const TEXTO_FESTAS: Record<Festas, string> = {
  proibido: "Festas não são permitidas",
  permitido: "Festas e eventos são permitidos",
};

/** Uma linha por regra DEFINIDA, em palavras simples, na ordem fixa silêncio → fumo → festas → visitas → outras. */
export function linhasRegrasCasa(r: RegrasCasa | null | undefined): LinhaRegraCasa[] {
  if (!r) return [];
  const l: LinhaRegraCasa[] = [];
  if (r.silencio) l.push({ chave: "silencio", texto: `Silêncio das ${horaFalada(r.silencio.inicio)} às ${horaFalada(r.silencio.fim)}` });
  if (r.fumo) l.push({ chave: "fumo", texto: TEXTO_FUMO[r.fumo] });
  if (r.festas) l.push({ chave: "festas", texto: TEXTO_FESTAS[r.festas] });
  if (r.visitas) {
    if (!r.visitas.permitidas) l.push({ chave: "visitas", texto: "Visitas não são permitidas" });
    else {
      const partes = [r.visitas.ate ? `Visitas até às ${horaFalada(r.visitas.ate)}` : "Visitas são permitidas"];
      if (r.visitas.pernoite === false) partes.push("não podem pernoitar");
      if (r.visitas.pernoite === true) partes.push("podem pernoitar");
      l.push({ chave: "visitas", texto: partes.join(" · ") });
    }
  }
  if (r.outras) l.push({ chave: "outras", texto: r.outras });
  return l;
}

/**
 * smoking_allowed (o fato antigo, usado por outras telas) acompanha o fumo estruturado quando ele é definido:
 * só "permitido" é fumar no imóvel. Sem fumo definido, o fato antigo fica como está (undefined = não mexe).
 */
export function fumoParaSmokingAllowed(r: RegrasCasa | null): boolean | undefined {
  return r?.fumo ? r.fumo === "permitido" : undefined;
}
