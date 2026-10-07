/*
  Central de Agentes — o "miolo" das rotas /api/admin/agentes/{chat,reuniao}.
  Tudo que fala com banco ou modelo entra por `Deps`, para os testes rodarem
  sem rede (node --test). A rota só liga as dependências reais.
*/
import {
  LIMITE_DIA,
  LIMITE_DISPAROS_DIA,
  URL_DISPARO,
  destinoDaOrdem,
  pedeAcao,
  prometeAcao,
  respostaSessaoReal,
  textoDisparo,
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
import { CONTEXTO_VIVA, SLUG_GERENTE } from "./central.ts";
import { investigar, systemGerente, type DepsGerente, type ModeloGerente } from "./gerente.ts";

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
  /** Moacir gerente: modelo com ferramentas + consultas ao vivo. Sem ele, o Moacir conversa como os outros. */
  gerente?: { modelo: ModeloGerente; ferramentas: DepsGerente };
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
  const todos = await d.agentes();
  const agente = todos.find((a) => a.slug === slug);
  if (!agente) return { status: 404, body: { erro: "Agente não encontrado." } };

  // Moacir gerente: investiga (banco ao vivo, pergunta aos colegas, dispara quem faz).
  if (slug === SLUG_GERENTE && d.gerente) {
    await d.gravar([{ agente_slug: slug, papel: "daniel", autor_slug: null, texto: pergunta }]);
    let out: { resposta: string; trilha: { autor: string; texto: string }[] };
    try {
      out = await investigar(pergunta, systemGerente({ briefing: agente.briefing, agora: new Date(), contexto: CONTEXTO_VIVA }), d.gerente.modelo, d.gerente.ferramentas);
    } catch {
      return { status: 502, body: { erro: FALHA_MSG } };
    }
    const resposta = out.resposta.slice(0, 8000);
    // Cada passo vira uma linha própria (inserts em sequência: ordem de criação = ordem da conversa).
    for (const p of out.trilha) await d.gravar([{ agente_slug: slug, papel: "agente", autor_slug: p.autor, texto: p.texto.slice(0, 8000) }]);
    await d.gravar([{ agente_slug: slug, papel: "agente", autor_slug: slug, texto: resposta }]);
    return { status: 200, body: { resposta, trilha: out.trilha } };
  }

  // Pedido de AÇÃO: o chat não faz nada no mundo. Resposta honesta, sem gastar
  // modelo, e a tela oferece "Executar agora" para o agente certo.
  const destino = todos.find((a) => a.slug === destinoDaOrdem(slug, pergunta, todos)) ?? agente;
  const acao = { slug: destino.slug, nome: destino.nome };
  if (pedeAcao(pergunta)) {
    const honesta = respostaSessaoReal(destino.nome);
    // Dois inserts em sequência: cada um ganha o próprio criado_em (a ordem na tela não troca).
    await d.gravar([{ agente_slug: slug, papel: "daniel", autor_slug: null, texto: pergunta }]);
    await d.gravar([{ agente_slug: slug, papel: "agente", autor_slug: slug, texto: honesta }]);
    return { status: 200, body: { resposta: honesta, acao } };
  }

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
  // Rede de segurança: se o modelo prometeu agir, troca pela resposta honesta.
  const prometeu = prometeAcao(resposta);
  if (prometeu) resposta = respostaSessaoReal(destino.nome);
  resposta = resposta.slice(0, 8000);
  await d.gravar([{ agente_slug: slug, papel: "agente", autor_slug: slug, texto: resposta }]);
  return { status: 200, body: prometeu ? { resposta, acao } : { resposta } };
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

// ── Executar agora ─────────────────────────────────────────────────────────
export interface DepsExecutar {
  adminId(): Promise<string | null>;
  agentes(): Promise<Agente[]>;
  /** Consome 1 do limite de disparos (24 h) do admin; false = estourou ou indisponível. */
  consumirDisparo(adminId: string): Promise<boolean>;
  criarOrdem(slug: string, texto: string): Promise<string | null>;
  registrarDisparo(ordemId: string, r: { sessao_url?: string | null; erro?: string }): Promise<void>;
  /** Token da rotina (só servidor); null = não configurado. */
  token(slug: string): string | null;
  disparar(url: string, token: string, texto: string): Promise<{ sessao_url: string | null }>;
}

/**
 * Grava a ordem e dispara na hora a rotina real do agente. Sem token ou com
 * falha no disparo, a ordem FICA gravada (o agente lê na próxima ronda) e a
 * tela mostra o motivo. Migração continua só com OK escrito do Daniel.
 */
export async function executarAgora(d: DepsExecutar, entrada: unknown): Promise<Resposta> {
  const adminId = await d.adminId();
  if (!adminId) return { status: 403, body: { erro: "Só admin." } };
  const { slug, texto: t } = (entrada ?? {}) as { slug?: unknown; texto?: unknown };
  const texto = typeof t === "string" ? t.trim() : "";
  if (typeof slug !== "string" || !texto || texto.length > 4000) return { status: 400, body: { erro: "Escreva a ordem (até 4000 caracteres)." } };
  const agente = (await d.agentes()).find((a) => a.slug === slug);
  if (!agente) return { status: 404, body: { erro: "Agente não encontrado." } };
  if (agente.status !== "ativo" || !agente.trigger_id) {
    return { status: 409, body: { erro: `${agente.nome} não tem rotina para disparar. Use "Deixar ordem".` } };
  }
  if (!(await d.consumirDisparo(adminId))) {
    return { status: 429, body: { erro: `Limite de ${LIMITE_DISPAROS_DIA} disparos em 24 h atingido. Use "Deixar ordem": o agente lê na próxima ronda.` } };
  }
  const ordemId = await d.criarOrdem(slug, texto);
  if (!ordemId) return { status: 500, body: { erro: "Não consegui gravar a ordem." } };

  const token = d.token(slug);
  if (!token) {
    await d.registrarDisparo(ordemId, { erro: "sem token da rotina" });
    return {
      status: 503,
      body: { ordemId, erro: `Falta o token da rotina do ${agente.nome} no servidor. A ordem ficou gravada: ele lê na próxima ronda (${agente.rotina_texto ?? "sem horário"}).` },
    };
  }
  try {
    const r = await d.disparar(URL_DISPARO(agente.trigger_id), token, textoDisparo({ id: ordemId, agente_slug: slug, texto }));
    await d.registrarDisparo(ordemId, { sessao_url: r.sessao_url });
    return { status: 200, body: { ordemId, sessao_url: r.sessao_url, aviso: `${agente.nome} começou agora. Acompanhe pelo link da sessão; a ordem fecha quando ele registrar a ronda.` } };
  } catch (e) {
    const motivo = e instanceof Error ? e.message.slice(0, 200) : "falha";
    await d.registrarDisparo(ordemId, { erro: motivo });
    return { status: 502, body: { ordemId, erro: `Não consegui disparar o ${agente.nome} (${motivo}). A ordem ficou gravada para a próxima ronda.` } };
  }
}
