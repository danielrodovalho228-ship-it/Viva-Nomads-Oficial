"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  gestorElegivel,
  faltamParaGestor,
  type AccountType,
} from "@/lib/planos/gestor";

export interface GestorElegibilidade {
  elegivel: boolean;
  accountType: AccountType;
  imoveisValidados: number;
  faltam: number;
}

/**
 * Elegibilidade do Gestor do proprietário logado (regra 1). Conta os imóveis com
 * documentação APROVADA (moderação) e lê o tipo da conta. Sem sessão → não
 * elegível (fail-closed). Usada pela UI para mostrar critérios/meta.
 */
export async function getGestorElegibilidade(): Promise<GestorElegibilidade> {
  const vazio: GestorElegibilidade = {
    elegivel: false,
    accountType: "individual",
    imoveisValidados: 0,
    faltam: 5,
  };
  const supabase = await createClient();
  if (!supabase) return vazio;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return vazio;

  const { data: perfil } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .maybeSingle();
  const accountType = ((perfil?.account_type as string) ?? "individual") as AccountType;

  // Imóveis com documentação aprovada (um checklist por imóvel).
  const { count } = await supabase
    .from("qualification_checklists")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("document_status", "approved");
  const imoveisValidados = count ?? 0;

  return {
    elegivel: gestorElegivel({ accountType, imoveisValidados }),
    accountType,
    imoveisValidados,
    faltam: faltamParaGestor(imoveisValidados),
  };
}

/**
 * Define o tipo da conta (admin-only, AUDITADO). Marca administradoras como
 * 'gestor' — libera o Gestor por elegibilidade. Grava a trilha (quem, de/para,
 * motivo). Usa service role só depois de confirmar que quem chama é admin.
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
  if (novoTipo !== "individual" && novoTipo !== "gestor")
    return { ok: false, error: "Tipo inválido." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Serviço indisponível." };

  const { data: antes } = await admin
    .from("profiles")
    .select("account_type")
    .eq("id", profileId)
    .maybeSingle();
  const old = (antes?.account_type as string) ?? "individual";

  const { error: uErr } = await admin
    .from("profiles")
    .update({ account_type: novoTipo })
    .eq("id", profileId);
  if (uErr) return { ok: false, error: uErr.message };

  await admin.from("account_type_audit").insert({
    profile_id: profileId,
    old_type: old,
    new_type: novoTipo,
    changed_by: user.id,
    reason: motivo?.trim()?.slice(0, 500) || null,
  });

  return { ok: true };
}
