/**
 * CAMPOS-2 (adendo de campos do anúncio, 23/10): cinco grupos opcionais, cada um atrás de um toggle (padrão E56).
 * Puro: sem banco, sem tela. Tudo opcional; grupo desligado/vazio não existe no banco nem no anúncio.
 *   • incluído no preço — o que o valor mensal já cobre;
 *   • áreas do condomínio — o que o morador pode usar;
 *   • andar e elevador;
 *   • janela de entrada e saída — entrada das X às Y, saída até Z;
 *   • detalhe da vaga — coberta/descoberta, fixa/rotativa, observação curta.
 */
import { horaFalada } from "./regras-casa.ts";

export const ITENS_INCLUIDOS = [
  { chave: "agua", rotulo: "água" },
  { chave: "luz", rotulo: "luz" },
  { chave: "gas", rotulo: "gás" },
  { chave: "internet", rotulo: "internet" },
  { chave: "condominio", rotulo: "condomínio" },
  { chave: "iptu", rotulo: "IPTU" },
  { chave: "tv", rotulo: "TV por assinatura" },
] as const;

export const AREAS_CONDOMINIO = [
  { chave: "piscina", rotulo: "piscina" },
  { chave: "academia", rotulo: "academia" },
  { chave: "churrasqueira", rotulo: "churrasqueira" },
  { chave: "salao_festas", rotulo: "salão de festas" },
  { chave: "playground", rotulo: "playground" },
  { chave: "quadra", rotulo: "quadra" },
  { chave: "coworking", rotulo: "coworking" },
  { chave: "lavanderia", rotulo: "lavanderia" },
  { chave: "bicicletario", rotulo: "bicicletário" },
  { chave: "espaco_pet", rotulo: "espaço pet" },
] as const;

export const MAX_ANDAR = 200;
export const MAX_OBS_VAGA = 120;

export type ItemIncluido = (typeof ITENS_INCLUIDOS)[number]["chave"];
export type AreaCondominio = (typeof AREAS_CONDOMINIO)[number]["chave"];

export interface DetalhesAnuncio {
  incluidoNoPreco?: ItemIncluido[];
  areasCondominio?: AreaCondominio[];
  /** andar 0 = térreo. */
  andar?: { andar: number; elevador?: boolean };
  janela?: { entradaDe?: string; entradaAte?: string; saidaAte?: string };
  vaga?: { coberta?: boolean; tipo?: "fixa" | "rotativa"; observacao?: string };
}

export type ChaveGrupoDetalhe = keyof DetalhesAnuncio;
export const GRUPOS_DETALHE: { chave: ChaveGrupoDetalhe; titulo: string; descricao: string }[] = [
  { chave: "incluidoNoPreco", titulo: "Incluído no preço", descricao: "O que o valor mensal já cobre." },
  { chave: "areasCondominio", titulo: "Áreas do condomínio", descricao: "O que o morador pode usar no prédio." },
  { chave: "andar", titulo: "Andar e elevador", descricao: "Em que andar fica e se o prédio tem elevador." },
  { chave: "janela", titulo: "Janela de entrada e saída", descricao: "Horário em que o morador pode chegar e até quando sai." },
  { chave: "vaga", titulo: "Detalhe da vaga", descricao: "Como é a vaga de garagem." },
];

const HORA_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const hora = (v: unknown) => (typeof v === "string" && HORA_RE.test(v.trim()) ? v.trim() : undefined);
const simNao = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const daLista = <T extends string>(lista: readonly { chave: T }[], v: unknown): T[] => {
  if (!Array.isArray(v)) return [];
  const validas = new Set<string>(lista.map((i) => i.chave));
  // Na ordem da lista (estável), sem repetir.
  return lista.map((i) => i.chave).filter((c) => validas.has(c) && v.includes(c));
};

/** Aceita só o formato esperado; grupo torto ou vazio cai fora. Nada definido = null (a coluna fica nula). */
export function normalizarDetalhes(raw: unknown): DetalhesAnuncio | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: DetalhesAnuncio = {};

  const inc = daLista(ITENS_INCLUIDOS, r.incluidoNoPreco);
  if (inc.length) out.incluidoNoPreco = inc;
  const areas = daLista(AREAS_CONDOMINIO, r.areasCondominio);
  if (areas.length) out.areasCondominio = areas;

  const a = r.andar as Record<string, unknown> | undefined;
  if (a && typeof a === "object") {
    const n = typeof a.andar === "number" ? a.andar : typeof a.andar === "string" && a.andar.trim() !== "" ? Number(a.andar) : NaN;
    if (Number.isInteger(n) && n >= 0 && n <= MAX_ANDAR) {
      const elevador = simNao(a.elevador);
      out.andar = { andar: n, ...(elevador !== undefined ? { elevador } : {}) };
    }
  }

  const j = r.janela as Record<string, unknown> | undefined;
  if (j && typeof j === "object") {
    const entradaDe = hora(j.entradaDe);
    let entradaAte = hora(j.entradaAte);
    if (entradaDe && entradaAte && entradaAte <= entradaDe) entradaAte = undefined; // janela invertida: fica só o início
    const saidaAte = hora(j.saidaAte);
    if (entradaDe || entradaAte || saidaAte)
      out.janela = { ...(entradaDe ? { entradaDe } : {}), ...(entradaAte ? { entradaAte } : {}), ...(saidaAte ? { saidaAte } : {}) };
  }

  const v = r.vaga as Record<string, unknown> | undefined;
  if (v && typeof v === "object") {
    const coberta = simNao(v.coberta);
    const tipo = v.tipo === "fixa" || v.tipo === "rotativa" ? v.tipo : undefined;
    const obs =
      typeof v.observacao === "string" ? v.observacao.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_OBS_VAGA) : "";
    if (coberta !== undefined || tipo || obs)
      out.vaga = { ...(coberta !== undefined ? { coberta } : {}), ...(tipo ? { tipo } : {}), ...(obs ? { observacao: obs } : {}) };
  }

  return Object.keys(out).length > 0 ? out : null;
}

/** Grupo com o mínimo para aparecer no anúncio (o medidor de completude usa isto para os blocos ligados). */
export function grupoPreenchido(d: DetalhesAnuncio | null | undefined, chave: ChaveGrupoDetalhe): boolean {
  return !!normalizarDetalhes(d)?.[chave];
}

const lista = (itens: string[]) => (itens.length <= 1 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`);
const rotulos = (base: readonly { chave: string; rotulo: string }[], chaves: string[]) =>
  chaves.map((c) => base.find((b) => b.chave === c)?.rotulo ?? c);
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export interface LinhaDetalhe {
  chave: ChaveGrupoDetalhe;
  rotulo: string;
  texto: string;
}

/** Uma linha por grupo definido, em palavras simples (anúncio público: "Regras da estadia" e "Regras da casa"). */
export function linhasDetalhes(d: DetalhesAnuncio | null | undefined): LinhaDetalhe[] {
  const n = normalizarDetalhes(d);
  if (!n) return [];
  const l: LinhaDetalhe[] = [];
  if (n.incluidoNoPreco) l.push({ chave: "incluidoNoPreco", rotulo: "Incluído no preço", texto: maiuscula(lista(rotulos(ITENS_INCLUIDOS, n.incluidoNoPreco))) });
  if (n.areasCondominio) l.push({ chave: "areasCondominio", rotulo: "Áreas do condomínio", texto: maiuscula(lista(rotulos(AREAS_CONDOMINIO, n.areasCondominio))) });
  if (n.andar) {
    const andar = n.andar.andar === 0 ? "Térreo" : `${n.andar.andar}º andar`;
    const elev = n.andar.elevador === true ? " · com elevador" : n.andar.elevador === false ? " · sem elevador" : "";
    l.push({ chave: "andar", rotulo: "Andar", texto: andar + elev });
  }
  if (n.janela) {
    const { entradaDe, entradaAte, saidaAte } = n.janela;
    const partes: string[] = [];
    if (entradaDe && entradaAte) partes.push(`Entrada das ${horaFalada(entradaDe)} às ${horaFalada(entradaAte)}`);
    else if (entradaDe) partes.push(`Entrada a partir das ${horaFalada(entradaDe)}`);
    else if (entradaAte) partes.push(`Entrada até às ${horaFalada(entradaAte)}`);
    if (saidaAte) partes.push(`saída até às ${horaFalada(saidaAte)}`);
    l.push({ chave: "janela", rotulo: "Entrada e saída", texto: maiuscula(partes.join(" · ")) });
  }
  if (n.vaga) {
    const partes: string[] = [];
    if (n.vaga.coberta !== undefined) partes.push(n.vaga.coberta ? "coberta" : "descoberta");
    if (n.vaga.tipo) partes.push(n.vaga.tipo);
    const base = partes.length ? `Vaga ${partes.join(" e ")}` : "Vaga";
    l.push({ chave: "vaga", rotulo: "Vaga", texto: n.vaga.observacao ? `${base} · ${n.vaga.observacao}` : base });
  }
  return l;
}
