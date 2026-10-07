import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { aceitaEsforco, aceitaReserva, modeloViva } from "@/lib/atendimento/viva-custo";
import { inicioDoDiaBrasilia, modeloAgentes, SCHEMA_REUNIAO, TIMEOUT_MS, type Agente, type Conversa, type Ordem, type Ronda } from "@/lib/agentes/central";
import type { Deps } from "@/lib/agentes/motor";
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

  return {
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
