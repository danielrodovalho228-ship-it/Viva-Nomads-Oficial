/*
  Central de Agentes v2 — regras PURAS da tela (sem banco, sem DOM): status da
  última ronda, rede de quem passa trabalho para quem, roteiro do briefing e
  camadas do Raio-X. Tudo sai das tabelas reais (agentes, agentes_rondas);
  nada inventado. Imports relativos com .ts: roda direto no node --test.
*/
import { prioridadesDe, proximaRonda, tempoRelativo, type Achado, type Agente, type Conversa, type Ronda } from "./central.ts";

// ── Última ronda e status ──────────────────────────────────────────────────
export type CorRonda = "ok" | "alerta" | "falhou" | "sem";

export const COR_RONDA_HEX: Record<CorRonda, string> = { ok: "#7FD321", alerta: "#FFB547", falhou: "#FF5470", sem: "#5B6894" };

/** Última ronda de cada agente (as rondas podem vir em qualquer ordem). */
export function ultimaPorAgente(rondas: Ronda[]): Record<string, Ronda> {
  const out: Record<string, Ronda> = {};
  for (const r of rondas) {
    const atual = out[r.agente_slug];
    if (!atual || new Date(r.iniciada_em).getTime() > new Date(atual.iniciada_em).getTime()) out[r.agente_slug] = r;
  }
  return out;
}

export function corDaRonda(r: Pick<Ronda, "status"> | undefined): CorRonda {
  return r ? r.status : "sem";
}

/** Nó pisca quando a última ronda começou há menos de 15 min. */
export const JANELA_RECENTE_MIN = 15;
export function rondaRecente(r: Pick<Ronda, "iniciada_em"> | undefined, agora: Date): boolean {
  if (!r) return false;
  const idade = agora.getTime() - new Date(r.iniciada_em).getTime();
  return idade >= 0 && idade < JANELA_RECENTE_MIN * 60_000;
}

/** Resumo de card: 160 caracteres, cortando no espaço e com reticências. */
export function resumoCurto(texto: string, max = 160): string {
  const t = texto.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > max * 0.6 ? corte.slice(0, espaco) : corte).replace(/[,;:.\s]+$/, "")}…`;
}

export function achadosDaPrioridade(r: Pick<Ronda, "achados"> | undefined, ...prioridades: string[]): Achado[] {
  if (!r || !Array.isArray(r.achados)) return [];
  const quer = new Set(prioridades.map((p) => p.toUpperCase()));
  return r.achados.filter((a) => quer.has(String(a?.prioridade ?? "").toUpperCase()));
}

export interface Indicadores {
  ativos: number;
  rondas24h: number;
  falhas: number;
  p1: number;
}

/** Números do topo: ativos, rondas nas últimas 24 h, últimas rondas que falharam, P1 em aberto (últimas rondas). */
export function indicadores(agentes: Agente[], rondas: Ronda[], agora: Date): Indicadores {
  const ultimas = ultimaPorAgente(rondas);
  const desde = agora.getTime() - 24 * 3600_000;
  const ativos = agentes.filter((a) => a.status === "ativo");
  return {
    ativos: ativos.length,
    rondas24h: rondas.filter((r) => new Date(r.iniciada_em).getTime() >= desde).length,
    falhas: ativos.filter((a) => ultimas[a.slug]?.status === "falhou").length,
    p1: ativos.reduce((n, a) => n + (ultimas[a.slug] ? prioridadesDe(ultimas[a.slug]).filter((p) => p === "P1").length : 0), 0),
  };
}

// ── Rede ao vivo ───────────────────────────────────────────────────────────
export interface NoRede {
  id: string;
  rotulo: string;
  doc?: boolean;
  /** Posição relativa (0–1) no quadro largo e no quadro estreito (celular). */
  pos: [number, number];
  posEstreito: [number, number];
}

export type TipoFluxo = "achados" | "pendencias" | "relatorio" | "pacote";
export const COR_FLUXO: Record<TipoFluxo, string> = { achados: "#38BDF8", pendencias: "#FFB547", relatorio: "#8C9AC4", pacote: "#7FD321" };

/** Documentos e pessoas que não são linhas da tabela agentes. */
const NOS_FIXOS: NoRede[] = [
  { id: "daniel", rotulo: "Daniel", pos: [0.43, 0.08], posEstreito: [0.38, 0.04] },
  // Dono ao lado do Daniel (ordem 2f80c58a). Sem permissão de admin no código: o Moacir promove no banco.
  { id: "rogerio", rotulo: "Rogério", pos: [0.57, 0.08], posEstreito: [0.62, 0.04] },
  { id: "fila", rotulo: "Fila de correções", doc: true, pos: [0.2, 0.62], posEstreito: [0.2, 0.62] },
  { id: "pendencias", rotulo: "Pendências", doc: true, pos: [0.78, 0.5], posEstreito: [0.8, 0.6] },
  // Rede ao vivo real: chamados chegam do site; PRs e deploys vêm do GitHub.
  { id: "site", rotulo: "Site", doc: true, pos: [0.08, 0.1], posEstreito: [0.74, 0.07] },
  { id: "github", rotulo: "GitHub", doc: true, pos: [0.3, 0.2], posEstreito: [0.3, 0.12] },
];

const POS_AGENTE: Record<string, { pos: [number, number]; posEstreito: [number, number] }> = {
  moacir: { pos: [0.5, 0.28], posEstreito: [0.5, 0.22] },
  otavio: { pos: [0.3, 0.42], posEstreito: [0.2, 0.42] },
  bruno: { pos: [0.06, 0.4], posEstreito: [0.1, 0.8] },
  marina: { pos: [0.08, 0.84], posEstreito: [0.2, 0.96] },
  rafael: { pos: [0.4, 0.66], posEstreito: [0.5, 0.5] },
  luana: { pos: [0.6, 0.66], posEstreito: [0.15, 0.24] },
  carla: { pos: [0.7, 0.18], posEstreito: [0.86, 0.2] },
  helena: { pos: [0.92, 0.3], posEstreito: [0.86, 0.4] },
  thiago: { pos: [0.94, 0.72], posEstreito: [0.88, 0.8] },
  sergio: { pos: [0.72, 0.86], posEstreito: [0.7, 0.96] },
  renato: { pos: [0.36, 0.9], posEstreito: [0.44, 0.8] },
  viva: { pos: [0.16, 0.3], posEstreito: [0.68, 0.34] },
};

/** Quem passa trabalho para quem (pedido do Daniel, out/2026). O Renato
 * (engenheiro) recebe o pacote do Otávio e a revisão do Moacir e entrega PRs
 * para o Daniel mesclar. */
export const FLUXOS: [string, string, TipoFluxo][] = [
  ["bruno", "fila", "achados"],
  ["marina", "fila", "achados"],
  ["rafael", "fila", "achados"],
  ["fila", "otavio", "achados"],
  ["otavio", "renato", "pacote"],
  ["moacir", "renato", "relatorio"],
  ["renato", "daniel", "pacote"],
  ["helena", "pendencias", "pendencias"],
  ["thiago", "pendencias", "pendencias"],
  ["sergio", "pendencias", "pendencias"],
  ["pendencias", "daniel", "pendencias"],
  ["luana", "moacir", "relatorio"],
  ["rafael", "moacir", "relatorio"],
  ["carla", "daniel", "relatorio"],
  ["moacir", "daniel", "relatorio"],
  ["moacir", "rogerio", "relatorio"],
];

/** Donos da Viva (nós de pessoa, não agentes): mesmo estilo, sem cor de ronda nem pulso. */
export const DONOS_REDE: readonly string[] = ["daniel", "rogerio"];

/** Nós da rede: os fixos + os agentes ATIVOS que existem no banco e têm posição. */
export function nosDaRede(agentes: Pick<Agente, "slug" | "nome" | "status">[]): NoRede[] {
  const ag = agentes
    .filter((a) => a.status === "ativo" && POS_AGENTE[a.slug])
    .map((a) => ({ id: a.slug, rotulo: a.nome, ...POS_AGENTE[a.slug] }));
  return [...NOS_FIXOS, ...ag];
}

export function fluxosDaRede(nos: NoRede[]): [string, string, TipoFluxo][] {
  const ids = new Set(nos.map((n) => n.id));
  return FLUXOS.filter(([a, b]) => ids.has(a) && ids.has(b));
}

// ── Briefing animado ───────────────────────────────────────────────────────
export interface PassoBriefing {
  no: string;
  titulo: string;
  texto: string;
  cor: CorRonda;
}

/** Ordem em que a câmera percorre o mapa: segue o caminho do trabalho. */
export const ORDEM_BRIEFING = ["bruno", "marina", "rafael", "otavio", "renato", "helena", "thiago", "sergio", "luana", "carla", "moacir"];

/** Um passo por agente ativo, com o resumo REAL da última ronda (ou "sem ronda"). */
export function roteiroBriefing(agentes: Agente[], rondas: Ronda[], agora: Date): PassoBriefing[] {
  const ultimas = ultimaPorAgente(rondas);
  const porSlug = Object.fromEntries(agentes.map((a) => [a.slug, a]));
  const passos: PassoBriefing[] = [];
  for (const slug of ORDEM_BRIEFING) {
    const a = porSlug[slug];
    if (!a || a.status !== "ativo") continue;
    const r = ultimas[slug];
    let texto: string;
    if (!r) texto = `Ainda sem ronda registrada.${a.rotina_texto ? ` Rotina: ${a.rotina_texto}.` : ""}`;
    else {
      const p1 = achadosDaPrioridade(r, "P0", "P1").length;
      const st = r.status === "ok" ? "" : r.status === "alerta" ? " Terminou com alerta." : " A ronda falhou.";
      texto = `Última ronda ${tempoRelativo(r.iniciada_em, agora)}.${st} ${resumoCurto(r.resumo || "Sem resumo.", 220)}${p1 ? ` ${p1} achado${p1 > 1 ? "s" : ""} P1.` : ""}`;
    }
    passos.push({ no: slug, titulo: `${a.nome} · ${a.cargo}`, texto, cor: corDaRonda(r) });
  }
  passos.push({ no: "daniel", titulo: "Daniel", texto: "Os agentes preparam; você decide e aprova.", cor: "sem" });
  return passos;
}

// ── Raio-X da Viva ─────────────────────────────────────────────────────────
export interface Camada {
  id: string;
  nome: string;
  sub: string;
  cor: string;
  descricao: string;
  quem: string[];
  /** Palavras que puxam um achado para esta camada. */
  chave: RegExp;
}

export const CAMADAS: Camada[] = [
  {
    id: "vitrine",
    nome: "Vitrine",
    sub: "site · busca · anúncios · SEO · Instagram",
    cor: "#3D7BFF",
    descricao: "O que o mundo vê: site público, busca de imóveis mobiliados, preços, Google e Instagram.",
    quem: ["rafael", "luana", "bruno"],
    chave: /seo|google|sitemap|robots|indexa|vitrine|p[áa]gina p[úu]blica|busca|anúncio|anuncio|instagram|post|landing|llms/i,
  },
  {
    id: "app",
    nome: "App",
    sub: "inquilino · proprietário · chamados · vistoria",
    cor: "#7FD321",
    descricao: "O que inquilinos e proprietários usam: pedidos, contratos, chamados, rascunho do anúncio e vistoria.",
    quem: ["marina", "renato", "otavio", "viva", "vitoria"],
    chave: /\bapp\b|tela|rascunho|pedido|chamado|vistoria|dashboard|painel|modo|login|cadastro|formul/i,
  },
  {
    id: "dinheiro",
    nome: "Dinheiro e contratos",
    sub: "Asaas · ZapSign · recibos · Caução",
    cor: "#FFB547",
    descricao: "Cobrança, assinatura, recibos e o Caução. Uma garantia só por contrato.",
    quem: ["sergio", "carla", "igor", "caio"],
    chave: /cau[çc][ãa]o|contrato|recibo|cobran|asaas|zapsign|pagamento|comiss|plano|assinatura|nota fiscal|imposto|cnpj/i,
  },
  {
    id: "banco",
    nome: "Banco e segurança",
    sub: "Supabase · RLS · rotinas · migrações",
    cor: "#38BDF8",
    descricao: "O núcleo: dados, permissões por usuário, rotinas de prazos e migrações. É onde um erro custa mais caro.",
    quem: ["bruno", "renato", "otavio"],
    chave: /supabase|rls|banco|migra|sql|fun[çc][ãa]o|security|seguran|senha|exclus|lgpd|vazad|policy|grant/i,
  },
  {
    id: "parceiros",
    nome: "Parceiros",
    sub: "seguradoras · contador · advogada",
    cor: "#FF7A6B",
    descricao: "Quem está fora do código, mas dentro do negócio: seguradoras, contador e jurídico.",
    quem: ["thiago", "sergio", "helena"],
    chave: /segurador|easycover|chubb|pottencial|porto|parceir|contador|advogad|jur[íi]dic|dra\.? beatriz/i,
  },
];

export interface PontoAtencao {
  prioridade: string;
  titulo: string;
  agente: string;
  quando: string;
}

/**
 * Achados P0–P2 das ÚLTIMAS rondas que caem nesta camada: pela palavra-chave
 * ou, sem palavra de outra camada, por virem de quem cuida dela.
 */
export function atencaoDaCamada(c: Camada, rondas: Ronda[], max = 4): PontoAtencao[] {
  const ultimas = Object.values(ultimaPorAgente(rondas));
  const out: PontoAtencao[] = [];
  for (const r of ultimas) {
    for (const a of achadosDaPrioridade(r, "P0", "P1", "P2")) {
      const texto = `${a.titulo ?? ""} ${a.detalhe ?? ""}`;
      const daCamada = c.chave.test(texto);
      const deOutra = CAMADAS.some((o) => o.id !== c.id && o.chave.test(texto));
      if (daCamada || (!deOutra && c.quem.includes(r.agente_slug))) {
        out.push({ prioridade: String(a.prioridade).toUpperCase(), titulo: String(a.titulo ?? a.detalhe ?? "").trim(), agente: r.agente_slug, quando: r.iniciada_em });
      }
    }
  }
  const peso = (p: string) => Number(p.replace(/\D/g, "")) || 9;
  return out
    .filter((p) => p.titulo)
    .sort((x, y) => peso(x.prioridade) - peso(y.prioridade) || new Date(y.quando).getTime() - new Date(x.quando).getTime())
    .slice(0, max);
}

/** Próxima ronda de um agente ativo (texto), ou null. */
export function proximaDoAgente(a: Pick<Agente, "status" | "rotina_texto">, agora: Date): string | null {
  return a.status === "ativo" ? proximaRonda(a.rotina_texto, agora) : null;
}

/**
 * Mescla as conversas gravadas (vêm do servidor, com id próprio) com as
 * mensagens otimistas da tela (ids p-/r-/t-, que nunca batem com os gravados).
 * Depois do router.refresh() a mesma mensagem chega dos dois lados: a otimista
 * é descartada quando já existe uma gravada igual (agente, papel, texto),
 * uma gravada para cada otimista, então perguntas repetidas de verdade ficam.
 */
export function mesclarConversas(salvas: Conversa[], extra: Conversa[]): Conversa[] {
  const chave = (c: Conversa) => `${c.agente_slug}|${c.papel}|${c.texto.trim()}`;
  const ids = new Set(salvas.map((c) => c.id));
  const disponiveis = new Map<string, number>();
  for (const c of salvas) disponiveis.set(chave(c), (disponiveis.get(chave(c)) ?? 0) + 1);
  const novas = extra.filter((c) => {
    if (ids.has(c.id)) return false;
    const n = disponiveis.get(chave(c)) ?? 0;
    if (n > 0) {
      disponiveis.set(chave(c), n - 1);
      return false;
    }
    return true;
  });
  return [...salvas, ...novas];
}
