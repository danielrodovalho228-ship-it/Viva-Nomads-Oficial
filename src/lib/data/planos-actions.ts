"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { motivoTipoValido, type AccountType } from "@/lib/planos/gestor";
import { taxaDoDonoAgora } from "@/lib/cobranca/taxa-servidor";
import { ehUuid } from "@/lib/fotografos/regras";
import { erroBancoPT } from "@/lib/erros-banco";
import { recusaObservador } from "@/lib/qa/observador";

export interface TaxaDaConta {
  taxa: number;
  origem: "admin" | "faixa" | "faixa_com_queda_recente";
  imoveisAtivos: number;
}

/**
 * Prompt 078 — a taxa de serviço que vale HOJE para o proprietário logado (Conta › Plano): a MESMA leitura que congela
 * a taxa no aceite (taxaDoDonoAgora: faixa pelos imóveis ativos de verdade, queda de 30 dias e taxa fixada pelo admin).
 * O tipo da conta (administradora) não entra. Sem sessão ou com a leitura falhando: null (a tela mostra só a escada).
 */
export async function getTaxaDaConta(): Promise<TaxaDaConta | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const t = await taxaDoDonoAgora(admin, user.id).catch(() => null);
  return t ? { taxa: t.taxa, origem: t.origem, imoveisAtivos: t.imoveisAtivos } : null;
}

/**
 * Define o tipo da conta (admin-only, AUDITADO). Marca administradoras como
 * 'gestor' — o tipo só IDENTIFICA a administradora; desde o prompt 078 não muda a
 * taxa. Grava a trilha (quem, de/para, motivo). Usa service role só depois de confirmar que quem chama é admin.
 */
export async function definirAccountType(
  profileId: string,
  novoTipo: AccountType,
  motivo?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Indisponível." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para continuar." };

  const { data: adm } = await supabase.rpc("is_admin");
  if (adm !== true) return { ok: false, error: "Apenas administradores." };
  const recusaQa = await recusaObservador(user.id);
  if (recusaQa) return { ok: false, error: recusaQa };
  if (novoTipo !== "individual" && novoTipo !== "gestor")
    return { ok: false, error: "Tipo inválido." };
  if (!ehUuid(profileId)) return { ok: false, error: "Conta inválida." };
  // E224: a troca de tipo exige o motivo (fica na trilha account_type_audit).
  if (!motivoTipoValido(motivo)) return { ok: false, error: "Escreva o motivo da troca." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Serviço indisponível." };

  const { data: antes, error: erroAntes } = await admin
    .from("profiles")
    .select("account_type")
    .eq("id", profileId)
    .maybeSingle();
  // Sem o tipo anterior, a trilha account_type_audit gravaria "individual" no lugar do valor real: não troca.
  if (erroAntes) return { ok: false, error: "Não foi possível ler o tipo atual da conta. Tente de novo." };
  const old = (antes?.account_type as string) ?? "individual";

  const { error: uErr } = await admin
    .from("profiles")
    .update({ account_type: novoTipo })
    .eq("id", profileId);
  if (uErr) return { ok: false, error: erroBancoPT(uErr) };

  await admin.from("account_type_audit").insert({
    profile_id: profileId,
    old_type: old,
    new_type: novoTipo,
    changed_by: user.id,
    reason: (motivo ?? "").trim().slice(0, 500),
  });

  revalidatePath("/admin/usuarios");
  return { ok: true };
}
