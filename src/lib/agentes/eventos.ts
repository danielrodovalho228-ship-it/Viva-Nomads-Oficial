/*
  Rede ao vivo REAL — eventos das últimas 24 h, montados do banco (rondas,
  ordens, chamados) e do GitHub (PRs e deploys). Uma linha da rede só acende
  quando houve evento de verdade entre as duas pontas. Regras PURAS (node --test).
*/
import type { Achado, Ordem, Ronda } from "./central.ts";
import { FLUXOS } from "./painel.ts";
import { PREFIXO_MOACIR } from "./gerente.ts";

export type TipoEvento = "ronda" | "repasse" | "ordem" | "retorno" | "chamado" | "pr" | "deploy";

export interface EventoRede {
  em: string;
  de: string;
  para: string;
  tipo: TipoEvento;
  texto: string;
  link?: string | null;
}

export const COR_EVENTO: Record<TipoEvento, string> = {
  ronda: "#38BDF8",
  repasse: "#FF7A6B",
  ordem: "#7FD321",
  retorno: "#7FD321",
  chamado: "#FFB547",
  pr: "#C084FC",
  deploy: "#8C9AC4",
};

export const ROTULO_EVENTO: Record<TipoEvento, string> = {
  ronda: "ronda",
  repasse: "repasse entre agentes",
  ordem: "ordem",
  retorno: "retorno",
  chamado: "chamado",
  pr: "PR",
  deploy: "deploy",
};

export const JANELA_EVENTOS_H = 24;
/** Atualização da Rede ao vivo. */
export const ATUALIZA_REDE_MS = 30_000;

export interface ChamadoEvento {
  acao: string;
  ator_tipo: string;
  criado_em: string;
  numero: string | null;
}

export interface PrGithub {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  merged_at: string | null;
}

export interface DeployGithub {
  sha: string;
  created_at: string;
  environment: string;
}

export interface FontesRede {
  nomes: Record<string, string>;
  rondas: Pick<Ronda, "agente_slug" | "iniciada_em" | "status" | "achados" | "link_sessao">[];
  ordens: (Pick<Ordem, "agente_slug" | "texto" | "criada_em" | "status" | "origem_slug" | "origem_ronda" | "retorno_de" | "prioridade" | "disparada_em"> & { atualizada_em?: string | null })[];
  chamados: ChamadoEvento[];
  prs: PrGithub[];
  deploys: DeployGithub[];
}

const dentro = (iso: string | null | undefined, desde: number) => !!iso && new Date(iso).getTime() >= desde;

/** Para onde vai a ronda de cada agente (o primeiro fluxo dele); o Moacir manda o boletim ao Daniel. */
export function alvoDaRonda(slug: string): string {
  if (slug === "moacir") return "daniel";
  return FLUXOS.find(([a]) => a === slug)?.[1] ?? "moacir";
}

/** Quem pediu: a origem (agente), o Moacir (prefixo) ou o Daniel. */
export function quemPediu(o: Pick<Ordem, "origem_slug" | "texto">): string {
  if (o.origem_slug) return o.origem_slug;
  return o.texto.startsWith(PREFIXO_MOACIR) ? "moacir" : "daniel";
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function prioridadesTexto(achados: Achado[]): string {
  const ps = [...new Set(achados.map((a) => String(a?.prioridade ?? "").toUpperCase()).filter((p) => /^P[0-3]$/.test(p)))].sort();
  return ps.length ? ` (${ps.join(", ")})` : "";
}

/** Eventos das últimas 24 h, do mais novo para o mais antigo. */
export function montarEventos(f: FontesRede, agora: Date): EventoRede[] {
  const desde = agora.getTime() - JANELA_EVENTOS_H * 3600_000;
  const nome = (s: string) => f.nomes[s] ?? (s === "daniel" ? "Daniel" : s);
  const ev: EventoRede[] = [];

  for (const r of f.rondas) {
    if (!dentro(r.iniciada_em, desde)) continue;
    const achados = (Array.isArray(r.achados) ? r.achados : []).filter((a) => a && typeof a === "object") as (Achado & { para?: unknown })[];
    const porDestino = new Map<string, Achado[]>();
    for (const a of achados) {
      const para = typeof a.para === "string" ? a.para.trim().toLowerCase() : "";
      if (para && para !== r.agente_slug && f.nomes[para]) porDestino.set(para, [...(porDestino.get(para) ?? []), a]);
    }
    const st = r.status === "ok" ? "" : r.status === "alerta" ? " com alerta" : " — falhou";
    ev.push({
      em: r.iniciada_em,
      de: r.agente_slug,
      para: alvoDaRonda(r.agente_slug),
      tipo: "ronda",
      texto: `${nome(r.agente_slug)} fez ronda${st}${achados.length ? `: ${plural(achados.length, "achado", "achados")}${prioridadesTexto(achados)}` : ""}`,
      link: r.link_sessao,
    });
    for (const [para, lista] of porDestino) {
      ev.push({
        em: r.iniciada_em,
        de: r.agente_slug,
        para,
        tipo: "repasse",
        texto: `${nome(r.agente_slug)} → ${nome(para)}: ${plural(lista.length, "achado", "achados")}${prioridadesTexto(lista)}`,
      });
    }
  }

  for (const o of f.ordens) {
    const pediu = quemPediu(o);
    const retorno = !!o.retorno_de;
    // O repasse que nasceu de achado já aparece no evento da ronda.
    const deAchado = !!o.origem_ronda && !retorno;
    if (!deAchado && dentro(o.criada_em, desde)) {
      ev.push({
        em: o.criada_em,
        de: pediu,
        para: o.agente_slug,
        tipo: retorno ? "retorno" : "ordem",
        texto: retorno
          ? `${nome(pediu)} → ${nome(o.agente_slug)}: retorno do que foi repassado`
          : `${nome(pediu)} → ${nome(o.agente_slug)}: ordem criada${o.disparada_em ? " (disparo na hora)" : ""}`,
      });
    }
    if ((o.status === "lida" || o.status === "concluida") && dentro(o.atualizada_em, desde) && o.atualizada_em !== o.criada_em) {
      const concluiu = o.status === "concluida";
      ev.push({
        em: o.atualizada_em!,
        de: concluiu ? o.agente_slug : pediu,
        para: concluiu ? pediu : o.agente_slug,
        tipo: retorno ? "retorno" : "ordem",
        texto: concluiu
          ? `${nome(o.agente_slug)} → ${nome(pediu)}: ${retorno ? "retorno lido e fechado" : o.origem_slug ? "repasse concluído" : "ordem concluída"}`
          : `${nome(o.agente_slug)} leu a ${retorno ? "resposta" : "ordem"} de ${nome(pediu)}`,
      });
    }
  }

  for (const c of f.chamados) {
    if (!dentro(c.criado_em, desde)) continue;
    const n = c.numero ?? "chamado";
    if (c.acao === "aberto") ev.push({ em: c.criado_em, de: "site", para: "viva", tipo: "chamado", texto: `Chamado ${n} aberto` });
    else if (c.acao === "respondido_viva") ev.push({ em: c.criado_em, de: "viva", para: "site", tipo: "chamado", texto: `Viva respondeu ${n} sozinha` });
    else if (c.ator_tipo === "admin" && ["respondido", "sugestao_aprovada", "sugestao_editada"].includes(c.acao))
      ev.push({ em: c.criado_em, de: "daniel", para: "site", tipo: "chamado", texto: `Equipe respondeu ${n}` });
  }

  for (const p of f.prs) {
    if (dentro(p.created_at, desde)) ev.push({ em: p.created_at, de: "github", para: "daniel", tipo: "pr", texto: `PR #${p.number} aberto: ${p.title.slice(0, 80)}`, link: p.html_url });
    if (dentro(p.merged_at, desde)) ev.push({ em: p.merged_at!, de: "daniel", para: "github", tipo: "pr", texto: `Daniel mesclou o PR #${p.number}`, link: p.html_url });
  }

  for (const d of f.deploys) {
    if (dentro(d.created_at, desde)) ev.push({ em: d.created_at, de: "github", para: "site", tipo: "deploy", texto: `Deploy em ${d.environment} (${d.sha.slice(0, 7)})` });
  }

  return ev.sort((a, b) => new Date(b.em).getTime() - new Date(a.em).getTime());
}

export interface LinhaAcesa {
  de: string;
  para: string;
  tipo: TipoEvento;
  quantos: number;
  ultimo: string;
}

/** Uma linha por par de pontas (sem direção) com o tipo do evento mais recente. */
export function linhasAcesas(eventos: EventoRede[]): LinhaAcesa[] {
  const m = new Map<string, LinhaAcesa>();
  for (const e of eventos) {
    if (e.de === e.para) continue;
    const chave = [e.de, e.para].sort().join("|");
    const l = m.get(chave);
    if (!l) m.set(chave, { de: e.de, para: e.para, tipo: e.tipo, quantos: 1, ultimo: e.em });
    else {
      l.quantos++;
      if (new Date(e.em).getTime() > new Date(l.ultimo).getTime()) Object.assign(l, { de: e.de, para: e.para, tipo: e.tipo, ultimo: e.em });
    }
  }
  return [...m.values()];
}

/** Lê a resposta da API do GitHub (pulls) sem confiar no formato. */
export function lerPrs(json: unknown): PrGithub[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((p) => p && typeof p.number === "number" && typeof p.title === "string" && typeof p.created_at === "string")
    .map((p) => ({
      number: p.number,
      title: p.title,
      html_url: typeof p.html_url === "string" && p.html_url.startsWith("https://github.com/") ? p.html_url : "",
      created_at: p.created_at,
      merged_at: typeof p.merged_at === "string" ? p.merged_at : null,
    }));
}

/** Lê a resposta da API do GitHub (deployments) sem confiar no formato. */
export function lerDeploys(json: unknown): DeployGithub[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((d) => d && typeof d.sha === "string" && typeof d.created_at === "string")
    .map((d) => ({ sha: d.sha, created_at: d.created_at, environment: typeof d.environment === "string" ? d.environment : "produção" }));
}
