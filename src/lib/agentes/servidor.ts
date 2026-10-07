import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { aceitaEsforco, aceitaReserva, modeloViva } from "@/lib/atendimento/viva-custo";
import { LIMITE_DISPAROS_DIA, inicioDoDiaBrasilia, modeloAgentes, nomeVarToken, SCHEMA_REUNIAO, TIMEOUT_MS, type Agente, type Conversa, type Ordem, type Ronda } from "@/lib/agentes/central";
import { consumirLimite, DIA } from "@/lib/limites";
import { integracoesSimuladas, registrarSimulado } from "@/lib/integracoes";
import { executarAgora, type Deps, type DepsExecutar } from "@/lib/agentes/motor";
import { modeloGerenteSimulado, nomeDoOrganograma, PREFIXO_MOACIR, type Consulta, type DepsGerente, type ModeloGerente } from "@/lib/agentes/gerente";
import { horaBrasilia, retratoEmTexto } from "@/lib/agentes/retrato";
import { ultimaPorAgente } from "@/lib/agentes/painel";
import { systemChat } from "@/lib/agentes/central";
import type { Retrato } from "@/lib/agentes/retrato";

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
  deps.gerente = montarGerente(deps, supabase, modelo);
  return deps;
}

// ── Moacir gerente: consultas AO VIVO (prontas, sem SQL livre, sem dado pessoal) ──
const CONTATO = /\b[\w.+-]+@[\w-]+\.[\w.]+\b|\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g;
type Sessao = NonNullable<Awaited<ReturnType<typeof createClient>>>;

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
    return `Chamados abertos ${cab} — mais novos primeiro:\n${data
      .map(
        (x) =>
          `${x.numero_publico} · ${x.categoria} · ${String(x.prioridade).toUpperCase()} · ${x.status} · com ${x.responsavel_tipo === "ia" ? "a Viva" : "a equipe"} · aberto ${horaBrasilia(x.criado_em as string)}; prazo 1ª resposta ${horaBrasilia(x.prazo_primeira_resposta as string)}; ${x.primeira_resposta_em ? "já respondido" : "sem resposta ainda"}; SLA ${x.sla_estado}`
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
  return "Não consigo listar as migrações aplicadas daqui (o site não lê a tabela de migrações). Próximo passo: pedir ao Claude Code ou conferir no Supabase.";
}

/** Dados ao vivo da área de cada agente (para perguntar_agente). */
async function dadosDaArea(slug: string, supabase: Sessao): Promise<string> {
  if (slug === "viva") return consultaAoVivo("chamados_abertos", supabase);
  if (slug === "bruno" || slug === "otavio" || slug === "renato") return consultaAoVivo("rondas_recentes", supabase);
  if (slug === "helena") return consultaAoVivo("ordens_pendentes", supabase);
  return consultaAoVivo("contagens", supabase);
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
        const n = (area.match(/VN-\d+/g) ?? []).length;
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
  const simulado = integracoesSimuladas();
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
    token(slug) {
      const t = process.env[nomeVarToken(slug)]?.trim();
      if (t) return simulado ? "simulado" : t;
      return simulado ? "simulado" : null;
    },
    async disparar(url, token, texto) {
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
    },
  };
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
