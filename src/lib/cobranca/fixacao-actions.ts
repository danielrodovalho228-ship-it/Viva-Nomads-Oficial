"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessaoAal2 } from "@/lib/data/admin-guard";
import { recusaObservador } from "@/lib/qa/observador";
import { pctDaTaxa, validarFixacao } from "./fixacao-admin";

export type ResultadoFixacao = { ok: boolean; erro?: string; mensagem?: string };

async function exigirAdmin() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!(perfil?.role === "admin" && (await sessaoAal2(supabase)))) return null;
  const db = createAdminClient();
  return db ? { db, userId: user.id } : null;
}

/**
 * E977: o admin registra a taxa fixada de um proprietário (comissao_fixada_admin) — antes, só por SQL. Só insere: o
 * histórico nunca é apagado nem editado (0096). A linha nova, enquanto valer, passa a ser a que a cobrança usa
 * (taxaDoDonoAgora lê a mais recente dentro da validade).
 */
export async function registrarTaxaFixada(_: ResultadoFixacao | null, form: FormData): Promise<ResultadoFixacao> {
  const adm = await exigirAdmin();
  if (!adm) return { ok: false, erro: "Sem permissão." };
  const recusaQa = await recusaObservador(adm.userId);
  if (recusaQa) return { ok: false, erro: recusaQa };
  const v = validarFixacao(Object.fromEntries(form.entries()), new Date());
  if (!v.ok) return { ok: false, erro: v.erro };
  const f = v.fixacao;
  const { data: dono, error: e1 } = await adm.db.from("profiles").select("id, full_name").eq("email", f.email).maybeSingle();
  if (e1) return { ok: false, erro: "Não foi possível ler a conta. Tente de novo." };
  if (!dono) return { ok: false, erro: "Nenhuma conta com esse e-mail." };
  const { error } = await adm.db.from("comissao_fixada_admin").insert({
    owner_id: (dono as { id: string }).id,
    taxa: f.taxa,
    motivo: f.motivo,
    valido_ate: f.validoAte.toISOString(),
    criado_por: adm.userId,
  });
  if (error) {
    console.error("[registrarTaxaFixada]", error.code, error.message);
    return { ok: false, erro: "Não foi possível registrar a taxa." };
  }
  revalidatePath("/admin/taxas-fixadas");
  const nome = (dono as { full_name: string | null }).full_name ?? f.email;
  return { ok: true, mensagem: `Taxa de ${pctDaTaxa(f.taxa)} registrada para ${nome}. Vale até ${f.validoAte.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} nos contratos assinados nesse período.` };
}
