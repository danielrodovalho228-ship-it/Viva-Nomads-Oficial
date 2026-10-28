"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarBoasVindas } from "@/lib/notifications/boas-vindas-servidor";
import { normalizarIntencoes, type Intencao } from "@/lib/auth/entrada";

/**
 * Prompt 49 — intenção (profiles.intencao): camada, não papel. Grava a intenção e, SÓ no primeiro acesso (intenção
 * e papel ativo ainda vazios), o papel inicial que ela aponta. PAPEL-B: depois disso, mudar a intenção na Conta não
 * troca o papel ativo (a troca é explícita: selo do topo ou "Usar este"). Nunca toca em role nem em permissão.
 * RLS: só o próprio perfil (update da coluna liberado na 0214).
 */

/** null = ainda não respondeu; [] = "Agora não". */
export async function getMinhaIntencao(): Promise<Intencao[] | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("intencao").eq("id", user.id).maybeSingle();
  const v = (data as { intencao?: unknown } | null)?.intencao;
  return v == null ? null : normalizarIntencoes(v);
}

export async function salvarMinhaIntencao(bruto: unknown, modo: "owner" | "tenant" | null): Promise<{ ok: boolean; error?: string; papelAplicado?: "owner" | "tenant" | null }> {
  const intencao = normalizarIntencoes(bruto);
  const supabase = await createClient();
  if (!supabase) return { ok: true }; // demo/preview: sem servidor
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada. Entre de novo." };
  const { data: antes } = await supabase.from("profiles").select("intencao, papel_ativo").eq("id", user.id).maybeSingle();
  const primeiroAcesso = (antes as { intencao?: unknown } | null)?.intencao == null && (antes as { papel_ativo?: unknown } | null)?.papel_ativo == null;
  const { error } = await supabase.from("profiles").update({ intencao }).eq("id", user.id);
  if (error) return { ok: false, error: "Não foi possível salvar agora." };
  let papelAplicado: "owner" | "tenant" | null = null;
  if (primeiroAcesso && (modo === "owner" || modo === "tenant")) {
    await supabase.from("profiles").update({ preferred_mode: modo, papel_ativo: modo === "owner" ? "proprietario" : "morador" }).eq("id", user.id);
    papelAplicado = modo;
  }
  // E205-B (a): a primeira entrada manda as boas-vindas (uma vez por conta; a chave de envio segura repetições).
  if (primeiroAcesso) {
    const uid = user.id;
    after(async () => {
      const admin = createAdminClient();
      if (admin) await enviarBoasVindas(admin, uid, intencao, modo);
    });
  }
  revalidatePath("/dashboard/conta");
  return { ok: true, papelAplicado };
}
