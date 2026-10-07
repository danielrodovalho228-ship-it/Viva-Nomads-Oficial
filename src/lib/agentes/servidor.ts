import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/data/admin-guard";
import { aceitaEsforco, aceitaReserva, modeloViva } from "@/lib/atendimento/viva-custo";
import { inicioDoDiaBrasilia, modeloAgentes, SCHEMA_REUNIAO, TIMEOUT_MS, type Agente, type Conversa, type Ordem, type Ronda } from "@/lib/agentes/central";
import type { Deps } from "@/lib/agentes/motor";

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
