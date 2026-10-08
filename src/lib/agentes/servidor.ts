import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { aceitaEsforco, aceitaReserva, modeloViva } from "@/lib/atendimento/viva-custo";
import { CHAVE_LIMITE_ENCAMINHAMENTO, LIMITE_DISPAROS_DIA, inicioDoDiaBrasilia, modeloAgentes, nomeVarToken, SCHEMA_REUNIAO, TIMEOUT_MS, type Agente, type Conversa, type Ordem, type Ronda } from "@/lib/agentes/central";
import { consumirLimite, DIA } from "@/lib/limites";
import { integracoesSimuladas, registrarSimulado } from "@/lib/integracoes";
import { dispararEncaminhamentos, executarAgora, type DepsMemoria, type Deps, type DepsExecutar, type DepsEncaminhamento, type ResultadoEncaminhamento } from "@/lib/agentes/motor";
import { modeloGerenteSimulado, nomeDoOrganograma, PREFIXO_MOACIR, type Consulta, type DepsGerente, type ModeloGerente } from "@/lib/agentes/gerente";
import { horaBrasilia, retratoEmTexto } from "@/lib/agentes/retrato";
import { ultimaPorAgente } from "@/lib/agentes/painel";
import { consultasDaArea, numeroMigracao, type Conferencia, type MigracaoAplicada } from "@/lib/agentes/ao-vivo";
import { chamadosEsperandoEquipe } from "@/lib/atendimento/escalonamento";
import { systemChat } from "@/lib/agentes/central";
import { MAX_MEMORIAS_POR_AGENTE, personaPermitida, type Memoria } from "@/lib/agentes/persona";
import type { Retrato } from "@/lib/agentes/retrato";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Dependências REAIS da Central de Agentes. Lê e grava só nas 4 tabelas da
 * 0078, com o cliente da SESSÃO (a RLS is_admin() decide) — sem service role,
 * sem outras tabelas, sem dado pessoal. O modelo não recebe ferramentas.
 */
export async function depsReais(): Promise<Deps | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const modelo = modeloAgentes(process.env.AGENTES_MODELO, modeloViva());

  const deps: Deps = {
    async adminId() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user && (await ehAdmin(supabase, user.id)) ? user.id : null;
    },
    async perguntasHoje(adminId) {
      const { count } = await supabase
        .from("agentes_conversas")
        .select("id", { count: "exact", head: true })
        .eq("usuario", adminId)
        .eq("papel", "daniel")
        .gte("criado_em", inicioDoDiaBrasilia(new Date()).toISOString());
      return count ?? 0;
    },
    async agentes() {
      const { data } = await supabase.from("agentes").select("slug, nome, cargo, esquadrao, rotina_texto, trigger_id, status, briefing, ordem").order("ordem");
      return (data ?? []) as Agente[];
    },
    async rondas(slug, n) {
      const { data } = await supabase
        .from("agentes_rondas")
        .select("id, agente_slug, iniciada_em, concluida_em, status, resumo, achados, link_sessao")
        .eq("agente_slug", slug)
        .order("iniciada_em", { ascending: false })
        .limit(n);
      return (data ?? []) as Ronda[];
    },
    async ordensAbertas(slug) {
      const { data } = await supabase
        .from("agentes_ordens")
        .select("id, agente_slug, texto, criada_em, status, resposta")
        .eq("agente_slug", slug)
        .in("status", ["pendente", "lida"])
        .order("criada_em")
        .limit(20);
      return (data ?? []) as Ordem[];
    },
    async historico(slug, n) {
      const { data } = await supabase
        .from("agentes_conversas")
        .select("id, agente_slug, papel, autor_slug, texto, criado_em")
        .eq("agente_slug", slug)
        .order("criado_em", { ascending: false })
        .limit(n);
      return ((data ?? []) as Conversa[]).reverse();
    },
    async retrato() {
      return retratoDoMomento();
    },
    // 0092: leitura tolerante — antes da migração entrar, devolve vazio e a conversa segue normal.
    async persona(slug) {
      if (personaPermitida(slug, "x") === null) return null;
      const { data, error } = await supabase.from("agentes").select("persona").eq("slug", slug).maybeSingle();
      return error ? null : personaPermitida(slug, (data as { persona?: string | null } | null)?.persona);
    },
    async memorias(slug, n) {
      const { data, error } = await supabase.from("agentes_memoria").select("id, agente_slug, fato, criado_em").eq("agente_slug", slug).order("criado_em", { ascending: false }).limit(n);
      return error ? [] : ((data ?? []) as Memoria[]);
    },
    async lembrar(slug, fatos) {
      const { count } = await supabase.from("agentes_memoria").select("id", { count: "exact", head: true }).eq("agente_slug", slug);
      if ((count ?? 0) + fatos.length > MAX_MEMORIAS_POR_AGENTE) return;
      await supabase.from("agentes_memoria").insert(fatos.map((fato) => ({ agente_slug: slug, fato })));
    },
    async gravar(linhas) {
      const { error } = await supabase.from("agentes_conversas").insert(linhas);
      if (error) throw new Error(error.message);
    },
    async modelo({ system, messages, maxTokens, json }) {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error("sem ANTHROPIC_API_KEY");
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: TIMEOUT_MS, maxRetries: 1 });
      const res = await client.beta.messages.create({
        model: modelo,
        max_tokens: maxTokens,
        ...(aceitaEsforco(modelo) || json
          ? {
              output_config: {
                ...(aceitaEsforco(modelo) ? { effort: "low" as const } : {}),
                ...(json ? { format: { type: "json_schema" as const, schema: SCHEMA_REUNIAO as unknown as Record<string, unknown> } } : {}),
              },
            }
          : {}),
        ...(aceitaReserva(modelo) ? { betas: ["server-side-fallback-2026-06-01"], fallbacks: [{ model: "claude-opus-4-8" }] } : {}),
        system,
        messages,
      });
      if (res.stop_reason === "refusal") return "";
      return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    },
  };
  // Todos os agentes: dados AO VIVO da área + conferência das pendências da ronda.
  deps.aoVivo = async (slug) => {
    const partes = await Promise.all(consultasDaArea(slug).map((c) => consultaAoVivo(c, supabase).catch(() => `(${c}: falhou agora)`)));
    const conferencia = await conferenciaAgora();
    return { dados: partes.join("\n\n").slice(0, 6000), conferencia };
  };
  deps.chatSimulado = integracoesSimuladas();
  deps.gerente = montarGerente(deps, supabase, modelo);
  return deps;
}

// ── Moacir gerente: consultas AO VIVO (prontas, sem SQL livre, sem dado pessoal) ──
const CONTATO = /\b[\w.+-]+@[\w-]+\.[\w.]+\b|\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g;
type Sessao = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/** Migrações aplicadas em produção (0088: só versão e nome, só o servidor lê). null = indisponível. */
async function migracoesAplicadas(): Promise<MigracaoAplicada[] | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.rpc("migracoes_aplicadas");
  return error ? null : ((data ?? []) as MigracaoAplicada[]);
}

/** Chamados resolvidos nos últimos 7 dias (sem dado pessoal). */
async function chamadosResolvidos(): Promise<{ numero_publico: string; resolvido_em: string | null; encerrado_em: string | null; nota_satisfacao: number | null; categoria: string }[] | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const desde = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const { data, error } = await admin
    .from("chamados")
    .select("numero_publico, resolvido_em, encerrado_em, nota_satisfacao, categoria")
    .in("status", ["resolvido", "encerrado"])
    .eq("simulacao", false)
    .or(`resolvido_em.gte.${desde},encerrado_em.gte.${desde}`)
    .order("resolvido_em", { ascending: false, nullsFirst: false })
    .limit(30);
  return error ? null : (data ?? []);
}

/** O que o banco diz AGORA, para conferir as pendências da última ronda de qualquer agente. */
async function conferenciaAgora(): Promise<Conferencia> {
  const admin = createAdminClient();
  const [migracoes, resolvidos, abertos] = await Promise.all([
    migracoesAplicadas(),
    chamadosResolvidos(),
    admin ? admin.from("chamados").select("numero_publico").not("status", "in", "(resolvido,encerrado)").limit(200) : Promise.resolve({ data: [] }),
  ]);
  return {
    migracoes: migracoes ?? [],
    resolvidos: (resolvidos ?? []).map((r) => ({ numero: r.numero_publico, quando: (r.resolvido_em ?? r.encerrado_em) as string, nota: r.nota_satisfacao })),
    abertos: ((abertos.data ?? []) as { numero_publico: string }[]).map((x) => x.numero_publico),
  };
}

async function consultaAoVivo(c: Consulta, supabase: Sessao): Promise<string> {
  const agora = new Date().toISOString();
  const cab = `(dados de ${horaBrasilia(agora)}, horário de Brasília)`;
  if (c === "contagens") return retratoEmTexto(await retratoDoMomento());
  if (c === "chamados_abertos") {
    const admin = createAdminClient();
    if (!admin) return "Não consegui consultar os chamados agora.";
    const { data } = await admin
      .from("chamados")
      .select("numero_publico, categoria, prioridade, status, responsavel_tipo, sla_estado, prazo_primeira_resposta, primeira_resposta_em, criado_em")
      .not("status", "in", "(resolvido,encerrado)")
      .eq("simulacao", false)
      .order("criado_em", { ascending: false })
      .limit(15);
    if (!data?.length) return `Nenhum chamado aberto ${cab}.`;
    // Esperando a equipe há 2 h+ (sem resposta humana) — 6 h+ é vermelho.
    const esperando = new Map((await chamadosEsperandoEquipe(admin)).map((x) => [x.numero_publico, x]));
    const alerta = (n: string) => {
      const e = esperando.get(n);
      return e ? ` · ${e.nivel === 6 ? "VERMELHO" : "ATENÇÃO"}: ${e.horas} h sem resposta da equipe` : "";
    };
    return `Chamados abertos ${cab} — mais novos primeiro:\n${data
      .map(
        (x) =>
          `${x.numero_publico} · ${x.categoria} · ${String(x.prioridade).toUpperCase()} · ${x.status} · com ${x.responsavel_tipo === "ia" ? "a Viva" : "a equipe"} · aberto ${horaBrasilia(x.criado_em as string)}; prazo 1ª resposta ${horaBrasilia(x.prazo_primeira_resposta as string)}; ${x.primeira_resposta_em ? "já respondido" : "sem resposta ainda"}; SLA ${x.sla_estado}${alerta(x.numero_publico as string)}`
      )
      .join("\n")}`;
  }
  if (c === "rondas_recentes") {
    const { data } = await supabase.from("agentes_rondas").select("id, agente_slug, iniciada_em, concluida_em, status, resumo, achados, link_sessao").order("iniciada_em", { ascending: false }).limit(60);
    const ult = Object.values(ultimaPorAgente((data ?? []) as Ronda[]));
    if (!ult.length) return `Nenhuma ronda registrada ${cab}.`;
    return `Última ronda de cada agente ${cab}:\n${ult
      .map((r) => {
        const ach = (Array.isArray(r.achados) ? r.achados : []).filter((a) => /^P[12]$/i.test(String(a?.prioridade ?? ""))).slice(0, 4).map((a) => `${a.prioridade}: ${a.titulo}`).join("; ");
        return `${r.agente_slug} · ${horaBrasilia(r.iniciada_em)} · ${r.status}: ${r.resumo.replace(CONTATO, "[contato]").replace(/\s+/g, " ").slice(0, 240)}${ach ? ` · achados ${ach}` : ""}`;
      })
      .join("\n")}`;
  }
  if (c === "ordens_pendentes") {
    const { data } = await supabase.from("agentes_ordens").select("agente_slug, texto, status, criada_em").in("status", ["pendente", "lida"]).order("criada_em", { ascending: false }).limit(20);
    if (!data?.length) return `Nenhuma ordem aberta ${cab}.`;
    return `Ordens abertas ${cab}:\n${data.map((o) => `${o.agente_slug} · ${o.status === "lida" ? "em execução" : "aguardando"} · ${horaBrasilia(o.criada_em as string)}: ${String(o.texto).slice(0, 160)}`).join("\n")}`;
  }
  if (c === "ultimo_deploy") {
    const sha = process.env.VERCEL_GIT_COMMIT_SHA;
    return sha
      ? `Versão no ar: commit ${sha.slice(0, 7)} — "${(process.env.VERCEL_GIT_COMMIT_MESSAGE ?? "").split("\n")[0].slice(0, 140)}" ${cab}.`
      : "Não consigo ver o deploy daqui (fora da Vercel). Próximo passo: conferir no painel da Vercel.";
  }
  if (c === "chamados_resolvidos") {
    const r = await chamadosResolvidos();
    if (!r) return "Não consegui consultar os chamados resolvidos agora.";
    if (!r.length) return `Nenhum chamado resolvido nos últimos 7 dias ${cab}.`;
    return `Chamados resolvidos nos últimos 7 dias ${cab}:\n${r
      .map((x) => `${x.numero_publico} · ${x.categoria} · resolvido ${horaBrasilia((x.resolvido_em ?? x.encerrado_em) as string)}${x.nota_satisfacao ? ` · nota ${x.nota_satisfacao}` : " · sem nota"}`)
      .join("\n")}`;
  }
  const m = await migracoesAplicadas();
  if (!m) return "Não consigo listar as migrações aplicadas agora (falta a 0088 ou o banco não respondeu). Próximo passo: conferir no Supabase.";
  const ultimas = m.slice(0, 15).map((x) => `${numeroMigracao(x) ?? x.version} · ${x.name}`);
  return `Migrações aplicadas em produção ${cab} — as 15 mais recentes:\n${ultimas.join("\n")}`;
}

/** Dados ao vivo da área de cada agente (para perguntar_agente). */
async function dadosDaArea(slug: string, supabase: Sessao): Promise<string> {
  const partes = await Promise.all(consultasDaArea(slug).map((c) => consultaAoVivo(c, supabase).catch(() => `(${c}: falhou agora)`)));
  return partes.join("\n\n").slice(0, 6000);
}

function montarGerente(base: Deps, supabase: Sessao, modelo: string): Deps["gerente"] {
  const simulado = integracoesSimuladas();
  if (!simulado && !process.env.ANTHROPIC_API_KEY) return undefined;
  let nomes: Record<string, string> = {};
  const ferramentas: DepsGerente = {
    nomeDe: (slug) => nomes[slug] ?? nomeDoOrganograma(slug),
    consultar: (c) => consultaAoVivo(c, supabase),
    async perguntarAgente(slug, pergunta) {
      const agentes = await base.agentes();
      nomes = Object.fromEntries(agentes.map((a) => [a.slug, a.nome]));
      const a = agentes.find((x) => x.slug === slug);
      if (!a) return { nome: slug, resposta: "Agente não encontrado." };
      const area = await dadosDaArea(slug, supabase);
      if (simulado) {
        // Primeiro bloco da área da Viva = chamados abertos (os resolvidos vêm depois).
        const n = (area.split("\n\n")[0].match(/VN-\d+/g) ?? []).length;
        const resposta =
          slug === "viva"
            ? n
              ? `Tenho ${n} chamado(s) aberto(s). O mais novo: ${area.split("\n")[1] ?? ""}. Os sensíveis (Caução, contrato, cobrança) ficam com o Daniel; deixei a resposta sugerida no chamado.`
              : "Nenhum chamado aberto agora."
            : `Pelos dados de agora: ${area.split("\n").slice(0, 2).join(" ")}`;
        return { nome: a.nome, resposta: resposta.slice(0, 1200) };
      }
      const [rondas, ordens] = await Promise.all([base.rondas(slug, 3), base.ordensAbertas(slug)]);
      const r = await base.modelo({
        system: `${systemChat(a, rondas, ordens)}\n\nDADOS AO VIVO DA SUA ÁREA:\n${area}\n\nQuem pergunta é o Moacir (gerente). Responda em até 4 linhas, só com o que está nos dados.`,
        messages: [{ role: "user", content: pergunta }],
        maxTokens: 600,
        json: false,
      });
      return { nome: a.nome, resposta: (r || "Não consegui responder agora.").slice(0, 1200) };
    },
    async executar(slug, ordem) {
      const d = await depsExecutarReais();
      if (!d) return { ok: false, texto: "Sem permissão." };
      const r = await executarAgora(d, { slug, texto: `${PREFIXO_MOACIR}${ordem}` });
      const b = r.body as { aviso?: string; erro?: string; sessao_url?: string | null; ordemId?: string };
      return r.status === 200
        ? { ok: true, texto: `${b.aviso ?? "Disparado."}${b.sessao_url ? ` Sessão: ${b.sessao_url}` : ""} (ordem ${b.ordemId})` }
        : { ok: false, texto: b.erro ?? "Não consegui disparar." };
    },
  };
  const modeloGerente: ModeloGerente = simulado
    ? modeloGerenteSimulado(new Date())
    : async ({ system, tools, messages }) => {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: TIMEOUT_MS, maxRetries: 1 });
        const res = await client.beta.messages.create({
          model: modelo,
          max_tokens: 1500,
          ...(aceitaEsforco(modelo) ? { output_config: { effort: "low" as const } } : {}),
          ...(aceitaReserva(modelo) ? { betas: ["server-side-fallback-2026-06-01"], fallbacks: [{ model: "claude-opus-4-8" }] } : {}),
          system,
          tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema as unknown as Anthropic.Beta.Messages.BetaTool.InputSchema })),
          messages: messages as Anthropic.Beta.Messages.BetaMessageParam[],
        });
        return res as unknown as Awaited<ReturnType<ModeloGerente>>;
      };
  return { modelo: modeloGerente, ferramentas };
}

/**
 * "Executar agora": grava a ordem com o cliente da SESSÃO (RLS is_admin()) e
 * dispara a rotina real pela API de rotinas do claude.ai. O token de cada
 * rotina fica SÓ no servidor, em AGENTE_TOKEN_<SLUG> (ex.: AGENTE_TOKEN_RENATO);
 * nunca vai para o navegador nem para o banco.
 */
export async function depsExecutarReais(): Promise<DepsExecutar | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  return {
    async adminId() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user && (await ehAdmin(supabase, user.id)) ? user.id : null;
    },
    async agentes() {
      const { data } = await supabase.from("agentes").select("slug, nome, cargo, esquadrao, rotina_texto, trigger_id, status, briefing, ordem").order("ordem");
      return (data ?? []) as Agente[];
    },
    async consumirDisparo(adminId) {
      return consumirLimite(`agentes-executar:${adminId}`, LIMITE_DISPAROS_DIA, DIA);
    },
    async criarOrdem(slug, texto) {
      const { data, error } = await supabase.from("agentes_ordens").insert({ agente_slug: slug, texto }).select("id").single();
      return error ? null : (data.id as string);
    },
    async registrarDisparo(ordemId, r) {
      // Colunas da 0085. Antes dela, o update falha e a ordem segue como "Aguardando ronda".
      await supabase
        .from("agentes_ordens")
        .update({ disparada_em: new Date().toISOString(), sessao_url: r.sessao_url ?? null, disparo_erro: r.erro ?? null })
        .eq("id", ordemId);
    },
    token: tokenDaRotina,
    disparar: dispararRotina,
  };
}

/** Token da rotina do agente (só servidor). No laboratório, "simulado". */
function tokenDaRotina(slug: string): string | null {
  const simulado = integracoesSimuladas();
  const t = process.env[nomeVarToken(slug)]?.trim();
  if (t) return simulado ? "simulado" : t;
  return simulado ? "simulado" : null;
}

/** Dispara a rotina pela API de rotinas do claude.ai (no laboratório, só registra). */
async function dispararRotina(url: string, token: string, texto: string): Promise<{ sessao_url: string | null }> {
  if (token === "simulado") {
    await registrarSimulado("rotina", { url, texto });
    return { sessao_url: "https://claude.ai/code/session_simulada" };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "anthropic-beta": "experimental-cc-routine-2026-04-01",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: texto }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json().catch(() => ({}))) as { claude_code_session_url?: unknown };
  const link = typeof j.claude_code_session_url === "string" && j.claude_code_session_url.startsWith("https://claude.ai/") ? j.claude_code_session_url : null;
  return { sessao_url: link };
}

/**
 * Encaminhamento entre agentes (0087): dispara na hora as ordens P0/P1 que um agente
 * encaminhou a outro. `db` é o cliente da sessão do admin (RLS is_admin()) ou o
 * de serviço (cron). Limite diário próprio, com o mesmo teto do Executar agora.
 */
export function depsEncaminhamento(db: SupabaseClient): DepsEncaminhamento {
  return {
    async candidatas() {
      const desde = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data, error } = await db
        .from("agentes_ordens")
        .select("id, agente_slug, texto, status, origem_slug, retorno_de, prioridade, disparada_em, disparo_erro")
        .not("origem_slug", "is", null)
        .is("retorno_de", null)
        .in("prioridade", ["P0", "P1"])
        .eq("status", "pendente")
        .is("disparada_em", null)
        .is("disparo_erro", null)
        .gte("criada_em", desde)
        .order("criada_em")
        .limit(20);
      // Antes da 0087 as colunas não existem: nada a disparar.
      return error ? [] : ((data ?? []) as Ordem[]);
    },
    async agentes() {
      const { data } = await db.from("agentes").select("slug, nome, status, trigger_id");
      return (data ?? []) as Agente[];
    },
    async reservar(ordemId) {
      const { data } = await db
        .from("agentes_ordens")
        .update({ disparada_em: new Date().toISOString() })
        .eq("id", ordemId)
        .is("disparada_em", null)
        .is("disparo_erro", null)
        .select("id");
      return (data ?? []).length === 1;
    },
    consumirDisparo: () => consumirLimite(CHAVE_LIMITE_ENCAMINHAMENTO, LIMITE_DISPAROS_DIA, DIA),
    async registrarDisparo(ordemId, r) {
      await db.from("agentes_ordens").update({ sessao_url: r.sessao_url ?? null, disparo_erro: r.erro ?? null }).eq("id", ordemId);
    },
    token: tokenDaRotina,
    disparar: dispararRotina,
  };
}

/** Dispara os encaminhamentos urgentes com o cliente da sessão (só admin). */
export async function dispararEncaminhamentosDaSessao(): Promise<ResultadoEncaminhamento | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return null;
  return dispararEncaminhamentos(depsEncaminhamento(supabase));
}

/** E-mails que parecem de teste/laboratório (heurística só para contar). */
const FILTRO_TESTE = "email.ilike.%test%,email.ilike.%example.%,email.ilike.%@t.com";

/**
 * Retrato do momento: SÓ contagens e status (nenhum nome, e-mail ou telefone
 * sai daqui). Usa a chave do servidor porque soma tabelas inteiras; só roda
 * depois da checagem de admin do motor (guarda). Consultas fixas, sem SQL livre.
 */
export async function retratoDoMomento(): Promise<Retrato | null> {
  const db = createAdminClient();
  if (!db) return null;
  const agora = new Date();
  const h24 = new Date(agora.getTime() - 24 * 3600_000).toISOString();
  const conta = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count, error } = await q;
    if (error) throw new Error("retrato");
    return count ?? 0;
  };
  const cab = { count: "exact" as const, head: true };
  try {
    const [owner, tenant, admins, total, pareceTeste, imoveis, publicados, pedidos, pedidos24, leads, leads24, contratos, chamados, rondas, ordens, agentes] =
      await Promise.all([
        conta(db.from("profiles").select("id", cab).eq("role", "owner")),
        conta(db.from("profiles").select("id", cab).eq("role", "tenant")),
        conta(db.from("profiles").select("id", cab).eq("role", "admin")),
        conta(db.from("profiles").select("id", cab)),
        conta(db.from("profiles").select("id", cab).or(FILTRO_TESTE)),
        conta(db.from("properties").select("id", cab)),
        conta(db.from("properties").select("id", cab).eq("status", "active")),
        conta(db.from("pedidos_moradia").select("id", cab)),
        conta(db.from("pedidos_moradia").select("id", cab).gte("criado_em", h24)),
        conta(db.from("leads").select("id", cab)),
        conta(db.from("leads").select("id", cab).gte("created_at", h24)),
        db.from("contratos").select("status").limit(5000),
        db.from("chamados").select("prioridade").not("status", "in", "(resolvido,encerrado)").limit(5000),
        db.from("agentes_rondas").select("agente_slug, status, iniciada_em, resumo").order("iniciada_em", { ascending: false }).limit(10),
        db.from("agentes_ordens").select("agente_slug").eq("status", "pendente").limit(1000),
        db.from("agentes").select("slug, nome, status, rotina_texto").order("ordem"),
      ]);
    for (const r of [contratos, chamados, rondas, ordens, agentes]) if (r.error) return null;
    const porCampo = (linhas: Record<string, unknown>[] | null, campo: string) =>
      (linhas ?? []).reduce<Record<string, number>>((acc, l) => {
        const k = String(l[campo] ?? "—");
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});
    const nomes = Object.fromEntries((agentes.data ?? []).map((a) => [a.slug as string, a.nome as string]));
    const pend = porCampo(ordens.data as Record<string, unknown>[], "agente_slug");
    return {
      em: agora.toISOString(),
      cadastros: { proprietarios: owner, inquilinos: tenant, admins, total, pareceTeste },
      imoveis: { total: imoveis, publicados },
      pedidos: { total: pedidos, ultimas24h: pedidos24 },
      leads: { total: leads, ultimas24h: leads24 },
      contratosPorStatus: porCampo(contratos.data as Record<string, unknown>[], "status"),
      chamadosAbertosPorPrioridade: porCampo(chamados.data as Record<string, unknown>[], "prioridade"),
      rondas: (rondas.data ?? []).map((r) => ({
        agente: nomes[r.agente_slug as string] ?? String(r.agente_slug),
        status: String(r.status),
        em: String(r.iniciada_em),
        resumo: String(r.resumo ?? ""),
      })),
      ordensPendentes: Object.entries(pend).map(([slug, n]) => ({ agente: nomes[slug] ?? slug, n })),
      agentes: (agentes.data ?? []).map((a) => ({ nome: a.nome as string, status: a.status as Retrato["agentes"][number]["status"], rotina_texto: (a.rotina_texto as string) ?? null })),
    };
  } catch {
    return null;
  }
}

/** "O que <nome> sabe sobre você": lista e apaga memórias com a sessão do admin (a RLS is_admin() decide). */
export async function depsMemoria(): Promise<DepsMemoria | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  return {
    async adminId() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user && (await ehAdmin(supabase, user.id)) ? user.id : null;
    },
    async listar(slug) {
      const { data, error } = await supabase.from("agentes_memoria").select("id, agente_slug, fato, criado_em").eq("agente_slug", slug).order("criado_em", { ascending: false }).limit(MAX_MEMORIAS_POR_AGENTE);
      return error ? [] : ((data ?? []) as Memoria[]);
    },
    async apagar(id) {
      const { data, error } = await supabase.from("agentes_memoria").delete().eq("id", id).select("id");
      return !error && (data?.length ?? 0) > 0;
    },
  };
}
