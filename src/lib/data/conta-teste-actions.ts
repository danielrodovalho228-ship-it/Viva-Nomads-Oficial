"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { logModeracao } from "@/lib/data/moderacao-log";
import { recusaObservador } from "@/lib/qa/observador";
import { mudarContaTeste, type ResContaTeste } from "@/lib/admin/conta-teste";

/**
 * Prompt 36, item 2: marca/desmarca profiles.is_teste pelo admin. Confere ehAdmin (papel + 2FA) pela sessão,
 * grava pelo cliente de serviço (o gatilho da 0135 ignora a mudança feita por uma sessão comum) e registra no
 * moderacao_log. A regra está em src/lib/admin/conta-teste.ts (testada com dependências falsas).
 */
export async function marcarContaTeste(perfilId: string, marcar: boolean): Promise<ResContaTeste> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, erro: "Indisponível no modo demonstração." };
  // QA-LOGIN-B v2: o admin observador da QA não marca nem desmarca conta de teste (seria transformar conta real em alvo).
  const recusaQa = await recusaObservador((await supabase.auth.getUser()).data.user?.id);
  if (recusaQa) return { ok: false, erro: recusaQa };
  const admin = createAdminClient();
  return mudarContaTeste(
    {
      usuarioId: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
      ehAdmin: (userId) => ehAdmin(supabase, userId),
      servico: admin
        ? {
            gravarIsTeste: async (id, valor) => {
              const { data, error } = await admin.from("profiles").update({ is_teste: valor }).eq("id", id).select("id");
              return !error && (data?.length ?? 0) > 0;
            },
            slugParceiro: async (id) => {
              const { data } = await admin.from("parceiros").select("slug").eq("user_id", id).maybeSingle();
              return (data?.slug as string | undefined) ?? null;
            },
          }
        : null,
      log: (adminId, acao, id) => logModeracao(supabase, adminId, acao, "perfil", id),
      revalidar: (caminho, tipo) => (tipo ? revalidatePath(caminho, tipo) : revalidatePath(caminho)),
    },
    perfilId,
    marcar
  );
}
