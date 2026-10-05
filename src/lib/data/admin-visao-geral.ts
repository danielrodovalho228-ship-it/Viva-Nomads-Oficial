import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import type { Metricas } from "@/lib/admin/visao-geral";

/**
 * Visão geral do /admin (0069). Confere ADMIN no servidor e só então lê a
 * função agregada admin_visao_geral pelo cliente de serviço, com CACHE de 5
 * minutos por (período, cidade) — o painel abre rápido e o banco não é
 * consultado a cada clique. Nada de dado pessoal: só números.
 */
export interface VisaoGeral {
  periodo: { inicio: string; fim: string; dias: number; inicio_anterior: string; fim_anterior: string; cidade: string | null };
  atual: Metricas;
  anterior: Metricas;
  serie: Record<string, unknown>[];
  agora: Metricas & { assinaturas?: Record<string, unknown> | null };
  precisa: Record<string, { n: unknown; horas_mais_antigo: unknown } | null>;
  geradoEm: string;
}

export type ResultadoVisaoGeral =
  | { ok: true; dados: VisaoGeral }
  | { ok: false; motivo: "demo" | "sem_permissao" | "sem_chave" | "sem_migracao" | "erro" };

const lerCache = unstable_cache(
  async (inicio: string, fim: string, cidade: string | null): Promise<VisaoGeral | "sem_migracao" | "erro"> => {
    const admin = createAdminClient();
    if (!admin) return "erro";
    const { data, error } = await admin.rpc("admin_visao_geral", { p_inicio: inicio, p_fim: fim, p_cidade: cidade });
    if (error) {
      console.error("[admin] visão geral:", error.message);
      // Função ainda não existe (0069 não aplicada) → a tela explica.
      return error.code === "PGRST202" || /admin_visao_geral/.test(error.message) ? "sem_migracao" : "erro";
    }
    return { ...(data as Omit<VisaoGeral, "geradoEm">), geradoEm: new Date().toISOString() };
  },
  ["admin-visao-geral"],
  { revalidate: 300, tags: ["admin-visao-geral"] }
);

export async function getVisaoGeral(inicio: string, fim: string, cidade: string | null): Promise<ResultadoVisaoGeral> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, motivo: "demo" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return { ok: false, motivo: "sem_permissao" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, motivo: "sem_chave" };
  const r = await lerCache(inicio, fim, cidade);
  if (r === "sem_migracao" || r === "erro") return { ok: false, motivo: r };
  return { ok: true, dados: r };
}

/** Cidades com anúncio (para o filtro). Só admin. */
export async function cidadesComAnuncio(): Promise<string[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return [];
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin.from("properties").select("city").not("city", "is", null).limit(2000);
  const vistas = new Map<string, string>();
  for (const r of data ?? []) {
    const c = String(r.city ?? "").trim();
    const k = c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    if (c && !vistas.has(k)) vistas.set(k, c);
  }
  return [...vistas.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
