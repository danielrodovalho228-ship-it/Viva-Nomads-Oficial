import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";

/**
 * /admin/financeiro (0071). Confere ADMIN no servidor e só então lê a função
 * agregada admin_financeiro pelo cliente de serviço, com cache de 5 minutos
 * por (período, cidade, recorte). Só números e a lista de comissões (sem dado pessoal).
 */
export type ResultadoFinanceiro =
  | { ok: true; dados: Record<string, unknown>; geradoEm: string }
  | { ok: false; motivo: "demo" | "sem_permissao" | "sem_chave" | "sem_migracao" | "erro" };

export type TipoFinanceiro = "real" | "teste" | "todos";

const lerCache = unstable_cache(
  async (inicio: string, fim: string, cidade: string | null, tipo: TipoFinanceiro) => {
    const admin = createAdminClient();
    if (!admin) return "erro" as const;
    // 0183: a mesma conta da 0071 com o recorte Real · Teste · Todos em cada parte.
    const { data, error } = await admin.rpc("admin_financeiro_recorte", { p_inicio: inicio, p_fim: fim, p_cidade: cidade, p_tipo: tipo });
    if (error) {
      console.error("[admin] financeiro:", error.message);
      return error.code === "PGRST202" || /admin_financeiro/.test(error.message) ? ("sem_migracao" as const) : ("erro" as const);
    }
    return { dados: data as Record<string, unknown>, geradoEm: new Date().toISOString() };
  },
  ["admin-financeiro-recorte"],
  { revalidate: 300, tags: ["admin-financeiro"] }
);

export async function getFinanceiro(inicio: string, fim: string, cidade: string | null, tipo: TipoFinanceiro = "real"): Promise<ResultadoFinanceiro> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, motivo: "demo" };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return { ok: false, motivo: "sem_permissao" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, motivo: "sem_chave" };
  const r = await lerCache(inicio, fim, cidade, tipo);
  if (r === "sem_migracao" || r === "erro") return { ok: false, motivo: r };
  return { ok: true, ...r };
}
