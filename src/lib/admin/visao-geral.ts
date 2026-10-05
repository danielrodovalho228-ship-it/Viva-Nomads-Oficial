/*
  Visão geral do /admin — regras PURAS: período, variação, razões, MRR,
  indicadores (com a fórmula do "i") e CSV. Sem imports de servidor/cliente
  (testável com node --test). Os números vêm da função admin_visao_geral (0069).

  Regra de honestidade: sem dado → null → "—". Denominador zero → null, nunca
  0%, NaN ou Infinity.
*/
import { PLANOS } from "../../config/planos.ts";

// ── Período ──────────────────────────────────────────────────────────────────
export type PeriodoId = "7" | "30" | "90" | "ano" | "custom";

export const PERIODOS: { id: PeriodoId; rotulo: string }[] = [
  { id: "7", rotulo: "7 dias" },
  { id: "30", rotulo: "30 dias" },
  { id: "90", rotulo: "90 dias" },
  { id: "ano", rotulo: "Ano" },
  { id: "custom", rotulo: "Personalizado" },
];

export interface Periodo {
  id: PeriodoId;
  inicio: string; // AAAA-MM-DD (inclusivo)
  fim: string; // AAAA-MM-DD (inclusivo)
  dias: number;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 1100;

function paraDia(s: string): number {
  return Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / 86_400_000;
}
function deDia(n: number): string {
  return new Date(n * 86_400_000).toISOString().slice(0, 10);
}
function dataValida(s: unknown): s is string {
  if (typeof s !== "string" || !DATA.test(s)) return false;
  return deDia(paraDia(s)) === s; // recusa 2026-02-31
}

export function somarDias(data: string, n: number): string {
  return deDia(paraDia(data) + n);
}

/** Resolve o período da URL. Qualquer coisa inválida cai em 30 dias. */
export function resolverPeriodo(
  q: { periodo?: string | null; de?: string | null; ate?: string | null },
  hoje: string
): Periodo {
  const id = (PERIODOS.some((p) => p.id === q.periodo) ? q.periodo : "30") as PeriodoId;
  const fixo = (n: number): Periodo => ({ id: String(n) as PeriodoId, inicio: somarDias(hoje, -(n - 1)), fim: hoje, dias: n });
  if (id === "7") return fixo(7);
  if (id === "90") return fixo(90);
  if (id === "ano") {
    const inicio = `${hoje.slice(0, 4)}-01-01`;
    return { id, inicio, fim: hoje, dias: paraDia(hoje) - paraDia(inicio) + 1 };
  }
  if (id === "custom" && dataValida(q.de) && dataValida(q.ate)) {
    const fim = q.ate > hoje ? hoje : q.ate;
    const inicio = q.de;
    const dias = paraDia(fim) - paraDia(inicio) + 1;
    if (dias >= 1 && dias <= MAX_DIAS) return { id, inicio, fim, dias };
  }
  return fixo(30);
}

/** "01/09 a 30/09/2026" */
export function rotuloPeriodo(inicio: string, fim: string): string {
  const d = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
  return `${d(inicio)} a ${d(fim)}/${fim.slice(0, 4)}`;
}

// ── Números honestos ─────────────────────────────────────────────────────────
export type Num = number | null;

export function num(v: unknown): Num {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** n/d. Denominador 0 ou ausente → null (a tela mostra "—", nunca 0%). */
export function razao(n: Num, d: Num): Num {
  if (n === null || d === null || d <= 0) return null;
  const r = n / d;
  return Number.isFinite(r) ? r : null;
}

export interface Variacao {
  pct: Num;
  direcao: "sobe" | "desce" | "igual" | null;
  texto: string;
}

/** Variação contra o período anterior. Anterior 0 → sem % (não existe "∞%"). */
export function variacao(atual: Num, anterior: Num): Variacao {
  if (atual === null || anterior === null) return { pct: null, direcao: null, texto: "—" };
  if (anterior === 0) {
    if (atual === 0) return { pct: null, direcao: "igual", texto: "igual" };
    return { pct: null, direcao: atual > 0 ? "sobe" : "desce", texto: "antes: 0" };
  }
  const pct = Math.round(((atual - anterior) / Math.abs(anterior)) * 1000) / 10;
  if (pct === 0) return { pct: 0, direcao: "igual", texto: "igual" };
  const sinal = pct > 0 ? "+" : "";
  return { pct, direcao: pct > 0 ? "sobe" : "desce", texto: `${sinal}${pct.toLocaleString("pt-BR")}%` };
}

export function fmtInteiro(v: Num): string {
  return v === null ? "—" : Math.round(v).toLocaleString("pt-BR");
}
export function fmtPct(v: Num): string {
  return v === null ? "—" : `${(Math.round(v * 1000) / 10).toLocaleString("pt-BR")}%`;
}
export function fmtReais(v: Num): string {
  return v === null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}
export function fmtHoras(v: Num): string {
  if (v === null) return "—";
  if (v < 48) return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
  return `${Math.round(v / 24)} dias`;
}

// ── Receita recorrente ───────────────────────────────────────────────────────
/** MRR pelas assinaturas ATIVAS × preço da fonte única (config/planos.ts).
 *  Plano sob consulta (Gestor) não entra no valor: vai em `semPreco`. */
export function mrr(assinaturas: Record<string, unknown> | null | undefined): { valor: Num; ativas: number; semPreco: number } {
  if (!assinaturas) return { valor: null, ativas: 0, semPreco: 0 };
  let valor = 0;
  let ativas = 0;
  let semPreco = 0;
  for (const [plano, qtd] of Object.entries(assinaturas)) {
    const n = num(qtd) ?? 0;
    if (n <= 0) continue;
    ativas += n;
    const preco = PLANOS.find((p) => p.id === plano)?.precoMensal;
    if (preco == null) semPreco += n;
    else valor += preco * n;
  }
  return { valor, ativas, semPreco };
}

// ── Indicadores ──────────────────────────────────────────────────────────────
export type Metricas = Record<string, unknown>;
export type Formato = "inteiro" | "pct" | "reais" | "horas";

export interface Indicador {
  chave: string;
  rotulo: string;
  /** O "i": como o número é calculado, em português simples. */
  formula: string;
  formato: Formato;
  calc: (m: Metricas) => Num;
  /** Série diária para a sparkline (campo de `serie`), quando houver. */
  serie?: string;
  /** Subir é ruim (ex.: tempo de resposta) — inverte a cor da variação. */
  menorMelhor?: boolean;
  nota?: string;
}

export interface Bloco {
  id: string;
  titulo: string;
  indicadores: Indicador[];
}

const campo = (k: string) => (m: Metricas) => num(m[k]);
const soma = (...ks: string[]) => (m: Metricas) => {
  const vs = ks.map((k) => num(m[k]));
  return vs.some((v) => v === null) ? null : vs.reduce<number>((a, b) => a + (b as number), 0);
};

export const BLOCOS: Bloco[] = [
  {
    id: "crescimento",
    titulo: "Crescimento",
    indicadores: [
      {
        chave: "cadastros",
        rotulo: "Novos cadastros",
        formula: "Contas novas de proprietários e inquilinos criadas no período (contas excluídas não contam). O cadastro não tem cidade: com filtro de cidade aparece \"—\".",
        formato: "inteiro",
        calc: soma("novos_proprietarios", "novos_inquilinos"),
        serie: "cadastros",
      },
      {
        chave: "novos_proprietarios",
        rotulo: "Novos proprietários",
        formula: "Contas novas com papel proprietário no período.",
        formato: "inteiro",
        calc: campo("novos_proprietarios"),
      },
      {
        chave: "novos_inquilinos",
        rotulo: "Novos inquilinos",
        formula: "Contas novas com papel inquilino no período.",
        formato: "inteiro",
        calc: campo("novos_inquilinos"),
      },
      {
        chave: "conclusao_cadastro",
        rotulo: "Conclusão do cadastro",
        formula: "Cadastros concluídos ÷ formulários de cadastro abertos (eventos anônimos). Sem formulário aberto no período: \"—\".",
        formato: "pct",
        calc: (m) => razao(num(m.cadastros_concluidos), num(m.cadastros_iniciados)),
      },
    ],
  },
  {
    id: "oferta",
    titulo: "Oferta",
    indicadores: [
      {
        chave: "anuncios_novos",
        rotulo: "Anúncios novos no ar",
        formula: "Imóveis criados no período que hoje estão ativos (na busca).",
        formato: "inteiro",
        calc: campo("anuncios_novos"),
      },
      {
        chave: "conclusao_anuncio",
        rotulo: "Anúncios iniciados → publicados",
        formula: "Publicações ÷ anúncios começados no período (eventos anônimos). Sem anúncio começado: \"—\".",
        formato: "pct",
        calc: (m) => razao(num(m.anuncios_publicados_evento), num(m.anuncios_iniciados)),
      },
    ],
  },
  {
    id: "demanda",
    titulo: "Demanda",
    indicadores: [
      {
        chave: "buscas",
        rotulo: "Buscas",
        formula: "Buscas feitas no site e no app (1 por local pesquisado), registradas de forma anônima.",
        formato: "inteiro",
        calc: campo("buscas"),
        serie: "buscas",
      },
      {
        chave: "visualizacoes",
        rotulo: "Anúncios vistos",
        formula: "Aberturas de página de anúncio (anúncios de exemplo não contam).",
        formato: "inteiro",
        calc: campo("visualizacoes"),
        serie: "visualizacoes",
      },
      {
        chave: "candidaturas",
        rotulo: "Candidaturas",
        formula: "Candidaturas enviadas a imóveis no período (pela cidade do imóvel).",
        formato: "inteiro",
        calc: campo("candidaturas"),
        serie: "candidaturas",
      },
      {
        chave: "pedidos",
        rotulo: "Pedidos de Moradia",
        formula: "Pedidos de Moradia publicados por inquilinos no período.",
        formato: "inteiro",
        calc: campo("pedidos"),
        serie: "pedidos",
      },
    ],
  },
  {
    id: "liquidez",
    titulo: "Liquidez",
    indicadores: [
      {
        chave: "taxa_resposta",
        rotulo: "Candidaturas respondidas",
        formula: "Candidaturas do período que o proprietário aceitou ou recusou ÷ candidaturas do período.",
        formato: "pct",
        calc: (m) => razao(num(m.candidaturas_decididas), num(m.candidaturas)),
      },
      {
        chave: "taxa_aceite",
        rotulo: "Candidaturas aceitas",
        formula: "Candidaturas aceitas ÷ candidaturas do período.",
        formato: "pct",
        calc: (m) => razao(num(m.candidaturas_aceitas), num(m.candidaturas)),
      },
      {
        chave: "tempo_decisao",
        rotulo: "Tempo até a resposta",
        formula: "Mediana do tempo entre a candidatura e a resposta do proprietário (só as respondidas).",
        formato: "horas",
        calc: campo("horas_mediana_decisao"),
        menorMelhor: true,
      },
      {
        chave: "pedidos_respondidos",
        rotulo: "Pedidos com resposta",
        formula: "Pedidos de Moradia do período com ao menos uma resposta de proprietário ÷ pedidos do período.",
        formato: "pct",
        calc: (m) => razao(num(m.pedidos_com_resposta), num(m.pedidos)),
      },
    ],
  },
  {
    id: "receita",
    titulo: "Receita",
    indicadores: [
      {
        chave: "contratos",
        rotulo: "Contratos fechados",
        formula: "Contratos registrados no período (pela cidade do imóvel).",
        formato: "inteiro",
        calc: campo("contratos"),
        serie: "contratos",
      },
      {
        chave: "comissao_gerada",
        rotulo: "Comissão gerada",
        formula: "Soma da comissão dos contratos do período (cobrada só do proprietário, uma vez por contrato).",
        formato: "reais",
        calc: campo("comissao_gerada"),
      },
      {
        chave: "comissao_recebida",
        rotulo: "Comissão recebida",
        formula: "Soma das comissões com pagamento confirmado no período.",
        formato: "reais",
        calc: campo("comissao_recebida"),
      },
      {
        chave: "aluguel_contratado",
        rotulo: "Aluguel contratado",
        formula: "Soma do aluguel mensal dos contratos do período. É o valor contratado entre as partes e não passa pela plataforma.",
        formato: "reais",
        calc: campo("aluguel_contratado"),
        nota: "valor contratado entre as partes (não passa pela plataforma)",
      },
    ],
  },
  {
    id: "operacao",
    titulo: "Operação",
    indicadores: [
      {
        chave: "chamados",
        rotulo: "Chamados abertos",
        formula: "Chamados de manutenção abertos por inquilinos no período.",
        formato: "inteiro",
        calc: campo("chamados"),
      },
      {
        chave: "chamados_resolvidos",
        rotulo: "Chamados resolvidos",
        formula: "Chamados do período já resolvidos ÷ chamados do período.",
        formato: "pct",
        calc: (m) => razao(num(m.chamados_resolvidos), num(m.chamados)),
      },
      {
        chave: "tempo_1a_resposta",
        rotulo: "1ª resposta a chamado",
        formula: "Mediana do tempo entre a abertura do chamado e a 1ª resposta do proprietário.",
        formato: "horas",
        calc: campo("horas_mediana_1a_resposta"),
        menorMelhor: true,
      },
    ],
  },
];

export function formatar(v: Num, f: Formato): string {
  if (f === "pct") return fmtPct(v);
  if (f === "reais") return fmtReais(v);
  if (f === "horas") return fmtHoras(v);
  return fmtInteiro(v);
}

// ── Funil ────────────────────────────────────────────────────────────────────
export const FUNIL: { rotulo: string; calc: (m: Metricas) => Num }[] = [
  { rotulo: "Buscas", calc: campo("buscas") },
  { rotulo: "Anúncios vistos", calc: campo("visualizacoes") },
  { rotulo: "Começaram a candidatura", calc: campo("candidaturas_iniciadas") },
  { rotulo: "Candidaturas enviadas", calc: campo("candidaturas") },
  { rotulo: "Aceitas", calc: campo("candidaturas_aceitas") },
  { rotulo: "Contratos", calc: campo("contratos") },
];

/** Etapas do funil com % sobre a etapa anterior (null quando a anterior é 0). */
export function funil(m: Metricas): { rotulo: string; valor: Num; daAnterior: Num }[] {
  let anterior: Num = null;
  return FUNIL.map((e, i) => {
    const valor = e.calc(m);
    const daAnterior = i === 0 ? null : razao(valor, anterior);
    anterior = valor;
    return { rotulo: e.rotulo, valor, daAnterior };
  });
}

// ── "Precisa de você agora" ──────────────────────────────────────────────────
/** href null = ainda sem tela própria (chega nos PRs D/E). */
export const PRECISA: { chave: string; rotulo: string; detalhe: string; href: string | null }[] = [
  {
    chave: "documentos_pendentes",
    rotulo: "Documentos de imóvel para conferir",
    detalhe: "Só documento aprovado libera a publicação.",
    href: "/admin/documentos",
  },
  {
    chave: "candidaturas_sem_resposta_48h",
    rotulo: "Candidaturas sem resposta há mais de 48 h",
    detalhe: "O proprietário ainda não aceitou nem recusou.",
    href: null,
  },
  {
    chave: "chamados_urgentes_sem_resposta",
    rotulo: "Chamados urgentes sem resposta há mais de 4 h",
    detalhe: "Prioridade urgente e nenhuma resposta do proprietário.",
    href: null,
  },
  {
    chave: "comissoes_vencidas",
    rotulo: "Comissões vencidas",
    detalhe: "Cobrança de comissão que passou do vencimento.",
    href: null,
  },
  {
    chave: "pedidos_sem_resposta_expirando",
    rotulo: "Pedidos expirando sem nenhuma resposta",
    detalhe: "Pedidos ativos que vencem em até 3 dias.",
    href: "/admin/pedidos",
  },
];

// ── CSV ──────────────────────────────────────────────────────────────────────
/** CSV dos indicadores (separador ;, como o Excel em pt-BR espera). */
export function csvVisaoGeral(atual: Metricas, anterior: Metricas, periodo: Periodo, cidade: string | null): string {
  const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const cru = (v: Num) => (v === null ? "" : String(Math.round(v * 10000) / 10000).replace(".", ","));
  const linhas = ["bloco;indicador;atual;anterior;variacao;formula"];
  for (const b of BLOCOS) {
    for (const ind of b.indicadores) {
      const a = ind.calc(atual);
      const p = ind.calc(anterior);
      linhas.push(
        [esc(b.titulo), esc(ind.rotulo), cru(a), cru(p), esc(variacao(a, p).texto), esc(ind.formula)].join(";")
      );
    }
  }
  const cab = `# período ${periodo.inicio} a ${periodo.fim}${cidade ? ` · cidade: ${cidade}` : ""}`;
  return [cab, ...linhas].join("\n");
}
