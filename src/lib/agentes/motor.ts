/*
  Central de Agentes — o "miolo" das rotas /api/admin/agentes/{chat,reuniao}.
  Tudo que fala com banco ou modelo entra por `Deps`, para os testes rodarem
  sem rede (node --test). A rota só liga as dependências reais.
*/
import {
  LIMITE_DIA,
  MAX_TOKENS_CHAT,
  MAX_TOKENS_REUNIAO,
  REUNIAO_FALHOU,
  ataEmTexto,
  lerReuniao,
  systemChat,
  systemReuniao,
  type Agente,
  type Conversa,
  type Ordem,
  type Reuniao,
  type Ronda,
} from "./central.ts";
import { retratoEmTexto, type Retrato } from "./retrato.ts";

export interface Mensagem {
  role: "user" | "assistant";
  content: string;
}

export interface Deps {
  /** id do admin logado; null quando não há sessão ou não é admin. */
  adminId(): Promise<string | null>;
  /** Perguntas já feitas hoje por este admin (linhas papel='daniel'). */
  perguntasHoje(adminId: string): Promise<number>;
  agentes(): Promise<Agente[]>;
  rondas(slug: string, n: number): Promise<Ronda[]>;
  ordensAbertas(slug: string): Promise<Ordem[]>;
  historico(slug: string, n: number): Promise<Conversa[]>;
  gravar(linhas: { agente_slug: string | null; papel: Conversa["papel"]; autor_slug: string | null; texto: string }[]): Promise<void>;
  /** Retrato do momento (só contagens); null se a consulta falhar. */
  retrato(): Promise<Retrato | null>;
  modelo(p: { system: string; messages: Mensagem[]; maxTokens: number; json: boolean }): Promise<string>;
}

export interface Resposta {
  status: number;
  body: Record<string, unknown>;
}

const LIMITE_MSG = `Limite de ${LIMITE_DIA} perguntas por dia atingido. Volta amanhã, ou deixe uma ordem: o agente lê na próxima ronda.`;
const FALHA_MSG = "Não consegui falar com o agente agora. Tente de novo em instantes ou deixe uma ordem.";

async function guarda(d: Deps): Promise<{ adminId: string } | Resposta> {
  const adminId = await d.adminId();
  if (!adminId) return { status: 403, body: { erro: "Só admin." } };
  if ((await d.perguntasHoje(adminId)) >= LIMITE_DIA) return { status: 429, body: { erro: LIMITE_MSG } };
  return { adminId };
}

/** Histórico em turnos alternados, começando por "user" (exigência da API). */
export function montarMensagens(hist: Conversa[], pergunta: string): Mensagem[] {
  const ms: Mensagem[] = [];
  for (const c of hist) {
    if (c.papel === "sistema") continue;
    const role = c.papel === "daniel" ? "user" : "assistant";
    const ult = ms[ms.length - 1];
    if (ult && ult.role === role) ult.content += `\n\n${c.texto}`;
    else ms.push({ role, content: c.texto });
  }
  while (ms.length && ms[0].role !== "user") ms.shift();
  if (ms.length && ms[ms.length - 1].role === "user") ms[ms.length - 1].content += `\n\n${pergunta}`;
  else ms.push({ role: "user", content: pergunta });
  return ms;
}

export async function responderChat(d: Deps, entrada: unknown): Promise<Resposta> {
  const g = await guarda(d);
  if ("status" in g) return g;
  const { slug, texto } = (entrada ?? {}) as { slug?: unknown; texto?: unknown };
  const pergunta = typeof texto === "string" ? texto.trim() : "";
  if (typeof slug !== "string" || !pergunta || pergunta.length > 4000) return { status: 400, body: { erro: "Escreva a pergunta (até 4000 caracteres)." } };
  const agente = (await d.agentes()).find((a) => a.slug === slug);
  if (!agente) return { status: 404, body: { erro: "Agente não encontrado." } };

  const [rondas, ordens, hist, retrato] = await Promise.all([
    d.rondas(slug, 3),
    d.ordensAbertas(slug),
    d.historico(slug, 10),
    d.retrato().catch(() => null),
  ]);
  // A pergunta conta no limite mesmo se o modelo falhar.
  await d.gravar([{ agente_slug: slug, papel: "daniel", autor_slug: null, texto: pergunta }]);
  let resposta: string;
  try {
    resposta = (await d.modelo({ system: systemChat(agente, rondas, ordens, retratoEmTexto(retrato)), messages: montarMensagens(hist, pergunta), maxTokens: MAX_TOKENS_CHAT, json: false })).trim();
  } catch {
    return { status: 502, body: { erro: FALHA_MSG } };
  }
  if (!resposta) resposta = "Não consegui responder agora. Vou conferir na próxima ronda.";
  resposta = resposta.slice(0, 8000);
  await d.gravar([{ agente_slug: slug, papel: "agente", autor_slug: slug, texto: resposta }]);
  return { status: 200, body: { resposta } };
}

export async function responderReuniao(d: Deps, entrada: unknown): Promise<Resposta> {
  const g = await guarda(d);
  if ("status" in g) return g;
  const { pauta: p, participantes } = (entrada ?? {}) as { pauta?: unknown; participantes?: unknown };
  const pauta = typeof p === "string" ? p.trim() : "";
  if (!pauta || pauta.length > 2000) return { status: 400, body: { erro: "Escreva a pauta (até 2000 caracteres)." } };
  const todos = await d.agentes();
  const pedidos = new Set(Array.isArray(participantes) ? participantes.filter((s): s is string => typeof s === "string") : []);
  pedidos.add("moacir"); // o Moacir sempre participa e fala por último
  const escolhidos = todos.filter((a) => pedidos.has(a.slug) && a.status !== "planejado").slice(0, 8);
  if (escolhidos.length < 2) return { status: 400, body: { erro: "Escolha pelo menos um agente além do Moacir." } };

  const [ps, retrato] = await Promise.all([
    Promise.all(escolhidos.map(async (a) => ({ agente: a, rondas: await d.rondas(a.slug, 3) }))),
    d.retrato().catch(() => null),
  ]);
  await d.gravar([{ agente_slug: null, papel: "daniel", autor_slug: null, texto: `Pauta: ${pauta}` }]);
  let reuniao: Reuniao | null = null;
  try {
    const bruto = await d.modelo({ system: systemReuniao(ps, retratoEmTexto(retrato)), messages: [{ role: "user", content: `Pauta do Daniel: ${pauta}` }], maxTokens: MAX_TOKENS_REUNIAO, json: true });
    reuniao = lerReuniao(bruto, escolhidos.map((a) => a.slug));
  } catch {
    reuniao = null;
  }
  if (!reuniao) return { status: 200, body: { ...REUNIAO_FALHOU, fallback: true } };
  const nomes = Object.fromEntries(todos.map((a) => [a.slug, a.nome]));
  await d.gravar([{ agente_slug: null, papel: "sistema", autor_slug: "moacir", texto: ataEmTexto(pauta, reuniao, nomes) }]);
  return { status: 200, body: { ...reuniao } };
}
