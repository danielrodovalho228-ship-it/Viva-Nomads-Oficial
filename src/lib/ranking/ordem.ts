/*
  ORDEM DOS IMÓVEIS (Prompt 33) — PURO e testável, sem banco e sem tela.

  Regra única da Viva para "quem aparece primeiro":
    1) compatibilidade com a busca (datas, prazo, valor, pessoas, pet, bairro) — sempre primeiro;
    2) distância ao ponto da busca, em faixas (quando houver ponto);
    3) nota de qualidade (0–100) com motivos;
    4) desempate estável pelo id.
  Destaque é MERECIDO: nenhum campo de pagamento, plano ou assinatura entra aqui (teste de guarda).
*/
import { faixaMinutos } from "../rotas/tempo.ts";

export const DIA_MS = 86_400_000;

/** Sinais de UM anúncio. Só o que está aqui pode influenciar a ordem. */
export interface SinaisAnuncio {
  id: string;
  donoId: string;
  ehExemplo: boolean;
  ehTeste: boolean;
  // Anúncio
  fotosTotal: number;
  comodosDistintos: number; // cômodos diferentes marcados nas fotos
  fotosDeParceiro: boolean; // entregues por fotógrafo parceiro (Prompt 31b)
  descricaoPalavras: number;
  regrasCompletas: boolean;
  enderecoExato: boolean;
  calendarioConfirmadoEm: string | null; // ISO
  // Confiança
  identidadeConfirmada: boolean; // estadoIdentidade do dono
  matriculaConferida: boolean; // property_ownership_checks aprovado
  // Desempenho
  conversas: number;
  conversasRespondidas: number;
  respostaMediaMin: number | null;
  avaliacoesQtd: number;
  avaliacoesMedia: number | null; // 1..5
  cancelamentosDono12m: number;
  // Preço
  precoJusto: boolean;
}

export interface Motivo {
  codigo: string;
  texto: string;
  pontos: number; // positivo soma, negativo tira
}

export interface NotaQualidade {
  nota: number; // 0..100, inteiro
  motivos: Motivo[]; // do que mais pesou ao que menos pesou
}

export const PESOS = {
  comodos: 12, // proporcional até 6 cômodos diferentes
  fotosParceiro: 6,
  descricao: 6, // 60+ palavras
  regras: 4,
  endereco: 4,
  calendario14: 8, // confirmado nos últimos 14 dias
  calendario30: 4, // 15–30 dias
  identidade: 12,
  matricula: 13,
  resposta: 10,
  avaliacoes: 10,
  semCancelamento: 5,
  precoJusto: 10,
} as const;

export const MIN_COMODOS_CHEIO = 6;
export const MIN_PALAVRAS = 60;
export const MIN_CONVERSAS_RESPOSTA = 3;
export const RESPONDE_RAPIDO = { proporcaoMin: 0.9, mediaMin: 240 } as const;
/** Média bayesiana: anúncio novo começa neutro (4,5 com peso de 3 avaliações), sem punição por ser novo. */
export const PRIOR_AVALIACAO = { media: 4.5, peso: 3 } as const;

const diasDesde = (iso: string | null, agora: Date) =>
  iso ? Math.floor((agora.getTime() - Date.parse(iso)) / DIA_MS) : Number.POSITIVE_INFINITY;

export function respondeRapido(s: Pick<SinaisAnuncio, "conversas" | "conversasRespondidas" | "respostaMediaMin">): boolean {
  if (s.conversas < MIN_CONVERSAS_RESPOSTA || s.respostaMediaMin == null) return false;
  return s.conversasRespondidas / s.conversas >= RESPONDE_RAPIDO.proporcaoMin && s.respostaMediaMin <= RESPONDE_RAPIDO.mediaMin;
}

export function notaQualidade(s: SinaisAnuncio, agora: Date): NotaQualidade {
  const m: Motivo[] = [];
  /** Motivo com 0 ponto também aparece (é o "o que falta" do painel e do admin). */
  const add = (codigo: string, texto: string, pontos: number) => {
    m.push({ codigo, texto, pontos: Math.round(pontos * 10) / 10 });
  };

  // Anúncio (até 40)
  const comodos = Math.min(Math.max(0, s.comodosDistintos), MIN_COMODOS_CHEIO);
  add("comodos", `${s.comodosDistintos} cômodos diferentes nas fotos`, (PESOS.comodos * comodos) / MIN_COMODOS_CHEIO);
  add("fotos_parceiro", s.fotosDeParceiro ? "Fotos profissionais" : "Sem fotos de fotógrafo parceiro", s.fotosDeParceiro ? PESOS.fotosParceiro : 0);
  add("descricao", s.descricaoPalavras >= MIN_PALAVRAS ? "Descrição completa" : `Descrição curta (${s.descricaoPalavras} palavras)`, s.descricaoPalavras >= MIN_PALAVRAS ? PESOS.descricao : 0);
  add("regras", s.regrasCompletas ? "Regras da casa completas" : "Regras da casa incompletas", s.regrasCompletas ? PESOS.regras : 0);
  add("endereco", s.enderecoExato ? "Endereço exato cadastrado" : "Falta o endereço exato", s.enderecoExato ? PESOS.endereco : 0);
  const dCal = diasDesde(s.calendarioConfirmadoEm, agora);
  if (dCal <= 14) add("calendario", "Calendário confirmado nos últimos 14 dias", PESOS.calendario14);
  else if (dCal <= 30) add("calendario", "Calendário confirmado há mais de 14 dias", PESOS.calendario30);
  else add("calendario_velho", "Calendário sem confirmação há mais de 30 dias", 0);

  // Confiança (até 25)
  add("identidade", s.identidadeConfirmada ? "Proprietário com identidade confirmada" : "Identidade do proprietário não confirmada", s.identidadeConfirmada ? PESOS.identidade : 0);
  add("matricula", s.matriculaConferida ? "Matrícula conferida" : "Matrícula não conferida", s.matriculaConferida ? PESOS.matricula : 0);

  // Desempenho (até 25)
  if (respondeRapido(s)) add("resposta", "Responde rápido", PESOS.resposta);
  else if (s.conversas >= MIN_CONVERSAS_RESPOSTA && s.conversasRespondidas / s.conversas >= 0.7)
    add("resposta", "Responde a maioria das conversas", PESOS.resposta / 2);
  else if (s.conversas < MIN_CONVERSAS_RESPOSTA) add("resposta_novo", "Ainda poucas conversas (neutro)", PESOS.resposta / 2);
  else add("resposta", "Responde menos de 70% das conversas", 0);
  const bayes =
    (PRIOR_AVALIACAO.media * PRIOR_AVALIACAO.peso + (s.avaliacoesMedia ?? 0) * s.avaliacoesQtd) /
    (PRIOR_AVALIACAO.peso + s.avaliacoesQtd);
  add("avaliacoes", s.avaliacoesQtd ? `Avaliações ${bayes.toFixed(1)} (${s.avaliacoesQtd})` : "Sem avaliações ainda (neutro)", (PESOS.avaliacoes * Math.max(0, bayes - 3)) / 2);
  if (s.cancelamentosDono12m === 0) add("cancelamento", "Sem cancelamentos pelo proprietário", PESOS.semCancelamento);
  else add("cancelamento", `${s.cancelamentosDono12m} cancelamento(s) pelo proprietário em 12 meses`, -5 * s.cancelamentosDono12m);

  // Preço (até 10)
  add("preco_justo", s.precoJusto ? "Preço justo" : "Sem selo de preço justo", s.precoJusto ? PESOS.precoJusto : 0);

  const soma = m.reduce((t, x) => t + x.pontos, 0);
  const nota = Math.max(0, Math.min(100, Math.round(soma)));
  m.sort((a, b) => Math.abs(b.pontos) - Math.abs(a.pontos) || a.codigo.localeCompare(b.codigo));
  return { nota, motivos: m };
}

/** Selos públicos, sempre com o motivo (o "porquê"). */
export interface Selo {
  codigo: "proprietario_verificado" | "responde_rapido" | "fotos_profissionais" | "preco_justo";
  rotulo: string;
  motivo: string;
}

export function selosDoAnuncio(s: SinaisAnuncio): Selo[] {
  const out: Selo[] = [];
  if (s.identidadeConfirmada && s.matriculaConferida)
    out.push({ codigo: "proprietario_verificado", rotulo: "Proprietário verificado", motivo: "Identidade confirmada e matrícula do imóvel conferida pela Viva." });
  if (respondeRapido(s))
    out.push({ codigo: "responde_rapido", rotulo: "Responde rápido", motivo: `Respondeu ${Math.round((s.conversasRespondidas / s.conversas) * 100)}% das conversas, em média em ${s.respostaMediaMin} min.` });
  if (s.fotosDeParceiro) out.push({ codigo: "fotos_profissionais", rotulo: "Fotos profissionais", motivo: "Fotos feitas por fotógrafo parceiro da Viva." });
  if (s.precoJusto) out.push({ codigo: "preco_justo", rotulo: "Preço justo", motivo: "Valor mensal abaixo do equivalente em estadias curtas informado pelo proprietário (critério em /como-funciona#preco-justo)." });
  return out;
}

/** Compatibilidade já calculada pela busca (regra existente), em faixas. */
export type FaixaCompat = "exata" | "parcial" | "fora";
const ORDEM_COMPAT: Record<FaixaCompat, number> = { exata: 0, parcial: 1, fora: 2 };
const faixaDistancia = (km: number | null) => (km == null ? 0 : km <= 2 ? 0 : km <= 5 ? 1 : km <= 10 ? 2 : 3);

export interface ItemBusca {
  sinais: SinaisAnuncio;
  compat: FaixaCompat;
  distanciaKm: number | null;
  /** Com destino escolhido (37): minutos até o destino; as faixas de minutos substituem as de km. */
  minutos?: number | null;
}

export interface Posicao {
  id: string;
  nota: number;
  motivos: Motivo[];
  compat: FaixaCompat;
}

/** Ordem da busca pública: teste e exemplo-quando-há-real ficam fora; "fora" nunca aparece na frente. */
export function ordenarBusca(itens: ItemBusca[], agora: Date, opcoes: { porMinutos?: boolean } = {}): Posicao[] {
  const temReal = itens.some((i) => !i.sinais.ehExemplo && !i.sinais.ehTeste);
  const visiveis = itens.filter((i) => !i.sinais.ehTeste && !(temReal && i.sinais.ehExemplo));
  const comNota = visiveis.map((i) => ({ i, q: notaQualidade(i.sinais, agora) }));
  const faixa = (i: ItemBusca) => (opcoes.porMinutos ? faixaMinutos(i.minutos) : faixaDistancia(i.distanciaKm));
  comNota.sort(
    (a, b) =>
      ORDEM_COMPAT[a.i.compat] - ORDEM_COMPAT[b.i.compat] ||
      Number(a.i.sinais.ehExemplo) - Number(b.i.sinais.ehExemplo) ||
      faixa(a.i) - faixa(b.i) ||
      b.q.nota - a.q.nota ||
      a.i.sinais.id.localeCompare(b.i.sinais.id),
  );
  return comNota.map(({ i, q }) => ({ id: i.sinais.id, nota: q.nota, motivos: q.motivos, compat: i.compat }));
}

export const NOTA_MIN_DESTAQUE = 70;

/** PRNG determinístico (mulberry32) — rodízio reprodutível por semente (ex.: a data do dia). */
export function prng(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * "Imóveis em destaque" da home: só real (nunca exemplo nem teste), nota ≥ 70, calendário ≤ 30 dias,
 * no máximo 1 por dono/gestor (o melhor de cada), rodízio ponderado pela nota com semente do dia.
 */
export function destaquesHome(todos: SinaisAnuncio[], n: number, agora: Date, semente: number): Posicao[] {
  const elegiveis = todos
    .filter((s) => !s.ehExemplo && !s.ehTeste && diasDesde(s.calendarioConfirmadoEm, agora) <= 30)
    .map((s) => ({ s, q: notaQualidade(s, agora) }))
    .filter((x) => x.q.nota >= NOTA_MIN_DESTAQUE);
  const melhorPorDono = new Map<string, (typeof elegiveis)[number]>();
  for (const x of elegiveis) {
    const atual = melhorPorDono.get(x.s.donoId);
    if (!atual || x.q.nota > atual.q.nota || (x.q.nota === atual.q.nota && x.s.id < atual.s.id)) melhorPorDono.set(x.s.donoId, x);
  }
  const pool = [...melhorPorDono.values()].sort((a, b) => a.s.id.localeCompare(b.s.id));
  const r = prng(semente);
  const escolhidos: typeof pool = [];
  while (escolhidos.length < n && pool.length) {
    const total = pool.reduce((t, x) => t + x.q.nota, 0);
    let alvo = r() * total;
    let k = 0;
    while (k < pool.length - 1 && alvo >= pool[k].q.nota) alvo -= pool[k++].q.nota;
    escolhidos.push(pool.splice(k, 1)[0]);
  }
  return escolhidos.map((x) => ({ id: x.s.id, nota: x.q.nota, motivos: x.q.motivos, compat: "exata" }));
}
