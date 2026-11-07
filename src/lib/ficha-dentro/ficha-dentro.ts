/*
  E660 — Ficha "o que tem dentro" (PURO). Evolui as comodidades "Roupa de cama e banho inclusas" (enxoval) e "Cozinha
  equipada" para uma ficha estruturada: camas por quarto, enxoval, cozinha equipada e ar-condicionado por quarto.
  Inventário numérico de pratos/talheres é OPCIONAL (decisão da coordenação: obrigatório viraria base de reclamação).
  A ficha do anúncio congela no contrato (contratos.ficha_dentro_congelada) e é o que se confere na entrada (E636–E640).
*/

export const VERSAO_FICHA_DENTRO = 1;

export const TIPOS_CAMA = [
  { valor: "casal", rotulo: "casal", plural: "casal" },
  { valor: "queen", rotulo: "queen", plural: "queen" },
  { valor: "king", rotulo: "king", plural: "king" },
  { valor: "solteiro", rotulo: "solteiro", plural: "solteiro" },
  { valor: "beliche", rotulo: "beliche", plural: "beliche" },
  { valor: "sofa_cama", rotulo: "sofá-cama", plural: "sofá-cama" },
] as const;

export type TipoCama = (typeof TIPOS_CAMA)[number]["valor"];

export interface CamaFicha {
  tipo: TipoCama;
  qtd: number;
}
export interface QuartoFicha {
  nome: string;
  camas: CamaFicha[];
  /** Só vale com 2+ solteiros no quarto: as camas de solteiro se juntam numa de casal? */
  solteirosJuntam: boolean | null;
  arCondicionado: boolean | null;
}
export interface FichaDentro {
  versao: number;
  quartos: QuartoFicha[];
  enxoval: boolean | null;
  cozinhaEquipada: boolean | null;
  /** OPCIONAL. Nunca entra nas faltas. */
  utensilios: { pratos: number | null; talheres: number | null } | null;
}

const NOME_MAX = 40;
const QTD_MAX = 10;
const UTENSILIO_MAX = 200;

export function fichaVazia(quartos: number): FichaDentro {
  const n = Math.max(1, Math.min(20, Math.floor(Number(quartos)) || 1));
  return {
    versao: VERSAO_FICHA_DENTRO,
    quartos: Array.from({ length: n }, (_, i) => ({ nome: `Quarto ${i + 1}`, camas: [], solteirosJuntam: null, arCondicionado: null })),
    enxoval: null,
    cozinhaEquipada: null,
    utensilios: null,
  };
}

const tipoValido = (v: unknown): v is TipoCama => TIPOS_CAMA.some((t) => t.valor === v);
const boolOuNull = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
const inteiro = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === "number" ? Math.round(v) : NaN;
  return Number.isFinite(n) && n >= min ? Math.min(n, max) : null;
};

/** Limpa o que vem do banco ou do rascunho (jsonb solto). Sem objeto → null. */
export function normalizarFicha(raw: unknown): FichaDentro | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const quartosRaw = Array.isArray(o.quartos) ? o.quartos : [];
  const quartos: QuartoFicha[] = quartosRaw.slice(0, 20).map((q, i) => {
    const r = (q && typeof q === "object" ? q : {}) as Record<string, unknown>;
    const camas: CamaFicha[] = (Array.isArray(r.camas) ? r.camas : []).flatMap((c) => {
      const x = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
      const qtd = inteiro(x.qtd, 1, QTD_MAX);
      return tipoValido(x.tipo) && qtd ? [{ tipo: x.tipo, qtd }] : [];
    });
    const nome = typeof r.nome === "string" ? r.nome.trim().slice(0, NOME_MAX) : "";
    return { nome: nome || `Quarto ${i + 1}`, camas, solteirosJuntam: boolOuNull(r.solteirosJuntam), arCondicionado: boolOuNull(r.arCondicionado) };
  });
  const u = o.utensilios && typeof o.utensilios === "object" ? (o.utensilios as Record<string, unknown>) : null;
  const utensilios = u ? { pratos: inteiro(u.pratos, 1, UTENSILIO_MAX), talheres: inteiro(u.talheres, 1, UTENSILIO_MAX) } : null;
  return {
    versao: VERSAO_FICHA_DENTRO,
    quartos,
    enxoval: boolOuNull(o.enxoval),
    cozinhaEquipada: boolOuNull(o.cozinhaEquipada),
    utensilios: utensilios && (utensilios.pratos || utensilios.talheres) ? utensilios : null,
  };
}

export const totalSolteiros = (q: QuartoFicha) => q.camas.filter((c) => c.tipo === "solteiro").reduce((s, c) => s + c.qtd, 0);

/** O que falta responder (frases para o dono). Utensílios nunca entram. */
export function faltasDaFicha(f: FichaDentro): string[] {
  const faltas: string[] = [];
  if (f.quartos.length === 0) faltas.push("informe os quartos");
  f.quartos.forEach((q) => {
    if (q.camas.length === 0) faltas.push(`${q.nome}: informe a cama (tipo e quantidade)`);
    else if (totalSolteiros(q) >= 2 && q.solteirosJuntam === null) faltas.push(`${q.nome}: diga se os solteiros juntam`);
    if (q.arCondicionado === null) faltas.push(`${q.nome}: diga se tem ar-condicionado`);
  });
  if (f.enxoval === null) faltas.push("diga se a roupa de cama e banho está inclusa");
  if (f.cozinhaEquipada === null) faltas.push("diga se tem cozinha equipada");
  return faltas;
}

export const fichaCompleta = (f: FichaDentro) => faltasDaFicha(f).length === 0;

/** Cópia profunda com data: é o que o contrato guarda (mudar o anúncio depois não muda a ficha assinada). */
export function congelarFicha(f: FichaDentro, quando: Date): { ficha: FichaDentro; congeladaEm: string } {
  return { ficha: JSON.parse(JSON.stringify(f)) as FichaDentro, congeladaEm: quando.toISOString() };
}

const rotuloCama = (c: CamaFicha) => {
  const t = TIPOS_CAMA.find((x) => x.valor === c.tipo)!;
  return `${c.qtd} ${c.tipo === "beliche" ? (c.qtd > 1 ? "beliches" : "beliche") : c.tipo === "sofa_cama" ? (c.qtd > 1 ? "sofás-cama" : "sofá-cama") : `${c.qtd > 1 ? "camas" : "cama"} de ${t.plural}`}`;
};

/** Linhas de texto para o contrato, a conferência de entrada e a página do imóvel. */
export function linhasDaFicha(f: FichaDentro): string[] {
  const linhas = f.quartos.map((q) => {
    const camas = q.camas.map(rotuloCama).join(" + ") || "sem cama informada";
    const juntam = totalSolteiros(q) >= 2 && q.solteirosJuntam ? " (juntam)" : "";
    const ar = q.arCondicionado === null ? "" : q.arCondicionado ? ", com ar-condicionado" : ", sem ar-condicionado";
    return `${q.nome}: ${camas}${juntam}${ar}`;
  });
  if (f.enxoval !== null) linhas.push(`Roupa de cama e banho: ${f.enxoval ? "inclusa" : "não inclusa"}`);
  if (f.cozinhaEquipada !== null) linhas.push(`Cozinha equipada: ${f.cozinhaEquipada ? "sim" : "não"}`);
  if (f.utensilios) {
    const p = f.utensilios.pratos ? `${f.utensilios.pratos} pratos` : null;
    const t = f.utensilios.talheres ? `${f.utensilios.talheres} talheres` : null;
    linhas.push(`Utensílios (informado pelo dono): ${[p, t].filter(Boolean).join(", ")}`);
  }
  return linhas;
}
