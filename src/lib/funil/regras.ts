/*
  Prompt 50 — FUNIL de ativação. PURO. Cada número vem com a FÓRMULA escrita (a tela mostra a frase) e com a lista que
  ele conta (número clicável). Contas de teste (is_teste) ficam fora de tudo: quem chama já passa `teste` em cada linha
  e estas funções descartam.
  Roda: node --test src/lib/funil/regras.test.ts
*/

const H = 3_600_000;

export type ChaveFunil = "visita_conta" | "conta_intencao" | "busca_pedido" | "rascunho_publicado" | "solicitacao_aprovacao" | "verificacao";

export interface Etapa {
  chave: ChaveFunil;
  rotulo: string;
  /** A fórmula, escrita como a tela mostra. */
  formula: string;
  tipo: "percentual" | "horas";
  /** Valor (% de 0 a 100, ou horas medianas). null = sem base para calcular. */
  valor: number | null;
  /** Numerador e denominador (percentual) ou quantos tempos entraram (horas). */
  base: { de: number; total: number };
  /** Ids que entram no número (a lista que o clique abre). */
  ids: string[];
}

export const FORMULAS: Record<ChaveFunil, { rotulo: string; formula: string; tipo: Etapa["tipo"] }> = {
  visita_conta: { rotulo: "Visita → conta", formula: "contas criadas ÷ visitas (sessões distintas) no período", tipo: "percentual" },
  conta_intencao: { rotulo: "Conta → intenção", formula: "contas novas que responderam a intenção ÷ contas novas no período", tipo: "percentual" },
  busca_pedido: { rotulo: "Morador: busca → 1º pedido", formula: "mediana do tempo entre a 1ª busca e o 1º pedido enviado, de quem enviou o 1º pedido no período", tipo: "horas" },
  rascunho_publicado: { rotulo: "Proprietário: rascunho → publicado", formula: "anúncios iniciados no período que já foram publicados ÷ anúncios iniciados no período", tipo: "percentual" },
  solicitacao_aprovacao: { rotulo: "Parceiro: solicitação → resposta da Viva", formula: "mediana do tempo entre a solicitação e a decisão da Viva (aprovada ou recusada), das decididas no período", tipo: "horas" },
  verificacao: { rotulo: "Verificação de identidade", formula: "pessoas com identidade confirmada ÷ pessoas que iniciaram a verificação no período", tipo: "percentual" },
};

export const pct = (de: number, total: number): number | null => (total > 0 ? Math.round((de / total) * 1000) / 10 : null);

export function mediana(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const etapa = (chave: ChaveFunil, valor: number | null, base: Etapa["base"], ids: string[]): Etapa => ({ chave, ...FORMULAS[chave], valor, base, ids });
const dentro = (iso: string | null | undefined, p: Periodo) => !!iso && iso >= p.de && iso < p.ate;

export interface Periodo {
  de: string;
  ate: string;
}

export interface Conta {
  id: string;
  criadaEm: string;
  /** Respondeu a pergunta da intenção (inclusive "Agora não"). */
  respondeuIntencao: boolean;
  teste: boolean;
}

export interface Visita {
  sessao: string;
  em: string;
  teste: boolean;
}

export function visitaConta(visitas: readonly Visita[], contas: readonly Conta[], p: Periodo): Etapa {
  const sessoes = new Set(visitas.filter((v) => !v.teste && dentro(v.em, p)).map((v) => v.sessao));
  const novas = contas.filter((c) => !c.teste && dentro(c.criadaEm, p));
  return etapa("visita_conta", pct(novas.length, sessoes.size), { de: novas.length, total: sessoes.size }, novas.map((c) => c.id));
}

export function contaIntencao(contas: readonly Conta[], p: Periodo): Etapa {
  const novas = contas.filter((c) => !c.teste && dentro(c.criadaEm, p));
  const resp = novas.filter((c) => c.respondeuIntencao);
  return etapa("conta_intencao", pct(resp.length, novas.length), { de: resp.length, total: novas.length }, novas.filter((c) => !c.respondeuIntencao).map((c) => c.id));
}

export interface Morador {
  id: string;
  primeiraBuscaEm: string | null;
  primeiroPedidoEm: string | null;
  teste: boolean;
}

export function buscaPedido(moradores: readonly Morador[], p: Periodo): Etapa {
  const ok = moradores.filter((m) => !m.teste && m.primeiraBuscaEm && dentro(m.primeiroPedidoEm, p) && m.primeiroPedidoEm! >= m.primeiraBuscaEm);
  const horas = ok.map((m) => (Date.parse(m.primeiroPedidoEm!) - Date.parse(m.primeiraBuscaEm!)) / H);
  const med = mediana(horas);
  return etapa("busca_pedido", med == null ? null : Math.round(med * 10) / 10, { de: ok.length, total: ok.length }, ok.map((m) => m.id));
}

export interface Anuncio {
  id: string;
  iniciadoEm: string;
  publicadoEm: string | null;
  teste: boolean;
}

export function rascunhoPublicado(anuncios: readonly Anuncio[], p: Periodo): Etapa {
  const iniciados = anuncios.filter((a) => !a.teste && dentro(a.iniciadoEm, p));
  const pub = iniciados.filter((a) => !!a.publicadoEm);
  return etapa("rascunho_publicado", pct(pub.length, iniciados.length), { de: pub.length, total: iniciados.length }, iniciados.filter((a) => !a.publicadoEm).map((a) => a.id));
}

export interface Solicitacao {
  id: string;
  criadaEm: string;
  decididaEm: string | null;
  teste: boolean;
}

export function solicitacaoAprovacao(sols: readonly Solicitacao[], p: Periodo): Etapa {
  const decididas = sols.filter((s) => !s.teste && dentro(s.decididaEm, p));
  const med = mediana(decididas.map((s) => (Date.parse(s.decididaEm!) - Date.parse(s.criadaEm)) / H));
  return etapa("solicitacao_aprovacao", med == null ? null : Math.round(med * 10) / 10, { de: decididas.length, total: decididas.length }, decididas.map((s) => s.id));
}

export interface Verificacao {
  usuarioId: string;
  /** Tentativas no período, em ordem: true = aprovada. */
  tentativas: { em: string; ok: boolean }[];
  /** Foi para a fila humana (2ª reprovação automática). */
  filaHumana: boolean;
  teste: boolean;
}

export interface DegrauVerificacao {
  degrau: "iniciou" | "aprovada_1a" | "aprovada_2a" | "fila_humana";
  rotulo: string;
  n: number;
  /** % de quem iniciou. */
  pct: number | null;
}

/** Verificação % por degrau: iniciou → aprovada na 1ª → aprovada na 2ª → fila humana. */
export function verificacaoPorDegrau(vs: readonly Verificacao[], p: Periodo): { etapa: Etapa; degraus: DegrauVerificacao[] } {
  const ini = vs.filter((v) => !v.teste && v.tentativas.some((t) => dentro(t.em, p)));
  const a1 = ini.filter((v) => v.tentativas[0]?.ok);
  const a2 = ini.filter((v) => !v.tentativas[0]?.ok && v.tentativas[1]?.ok);
  const fila = ini.filter((v) => v.filaHumana);
  const conf = ini.filter((v) => v.tentativas.some((t) => t.ok));
  const d = (degrau: DegrauVerificacao["degrau"], rotulo: string, n: number): DegrauVerificacao => ({ degrau, rotulo, n, pct: pct(n, ini.length) });
  return {
    etapa: etapa("verificacao", pct(conf.length, ini.length), { de: conf.length, total: ini.length }, ini.filter((v) => !v.tentativas.some((t) => t.ok)).map((v) => v.usuarioId)),
    degraus: [
      d("iniciou", "Iniciaram", ini.length),
      d("aprovada_1a", "Aprovadas na 1ª tentativa", a1.length),
      d("aprovada_2a", "Aprovadas na 2ª tentativa", a2.length),
      d("fila_humana", "Na análise de uma pessoa", fila.length),
    ],
  };
}

/** Piorou? Para % menor é pior; para horas, maior é pior. Devolve a variação "ruim" (positiva = piorou). */
export function piora(e: Etapa, anterior: Etapa | undefined): number | null {
  if (e.valor == null || !anterior || anterior.valor == null) return null;
  return e.tipo === "percentual" ? anterior.valor - e.valor : e.valor - anterior.valor;
}

/**
 * "Decisões primeiro": a etapa com a MAIOR queda na semana vai para o topo. Percentuais comparam pontos; horas,
 * a variação relativa (para não comparar horas com pontos).
 */
export function ordenarPorQueda(atual: readonly Etapa[], anterior: readonly Etapa[]): (Etapa & { queda: number | null })[] {
  const ant = new Map(anterior.map((e) => [e.chave, e]));
  const norm = (e: Etapa) => {
    const a = ant.get(e.chave);
    const q = piora(e, a);
    if (q == null) return null;
    return e.tipo === "horas" ? (a!.valor ? (q / a!.valor) * 100 : null) : q;
  };
  return atual
    .map((e) => ({ ...e, queda: norm(e) }))
    .sort((x, y) => (y.queda ?? -Infinity) - (x.queda ?? -Infinity) || x.chave.localeCompare(y.chave));
}

/** As duas semanas que o topo compara (Brasília): [de, ate) desta semana e da anterior, terminando em `agora`. */
export function semanas(agora: Date): { atual: Periodo; anterior: Periodo } {
  const ate = agora.toISOString();
  const de = new Date(agora.getTime() - 7 * 24 * H).toISOString();
  const deAnt = new Date(agora.getTime() - 14 * 24 * H).toISOString();
  return { atual: { de, ate }, anterior: { de: deAnt, ate: de } };
}
