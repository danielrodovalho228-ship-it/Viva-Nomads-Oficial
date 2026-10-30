import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarBoasVindas } from "@/lib/notifications/boas-vindas-servidor";
import { intencaoAoAnunciar, normalizarIntencoes, type Intencao } from "@/lib/auth/entrada";
import { contaNoPrimeiroAcesso } from "@/lib/papel/papel-ativo";

/*
  O caminho ÚNICO de gravar a intenção (Prompt 49 + E205-B): a tela de intenção, a Conta › Papéis e — E268-B — o
  primeiro rascunho de anúncio passam por aqui. Grava a intenção e, SÓ no primeiro acesso (intenção e papel ativo
  ainda vazios), o papel inicial e as boas-vindas (uma por conta: a chave de envio segura repetições). Fora do
  "use server": nada aqui vira ação chamável pelo navegador.
*/

export async function gravarIntencao(
  supabase: SupabaseClient,
  userId: string,
  intencao: Intencao[],
  modo: "owner" | "tenant" | null,
): Promise<{ ok: boolean; papelAplicado: "owner" | "tenant" | null }> {
  const { data: antes } = await supabase.from("profiles").select("intencao, papel_ativo").eq("id", userId).maybeSingle();
  const a = antes as { intencao?: unknown; papel_ativo?: unknown } | null;
  const primeiroAcesso = contaNoPrimeiroAcesso(a?.intencao, a?.papel_ativo);
  const { error } = await supabase.from("profiles").update({ intencao }).eq("id", userId);
  if (error) return { ok: false, papelAplicado: null };
  let papelAplicado: "owner" | "tenant" | null = null;
  if (primeiroAcesso && (modo === "owner" || modo === "tenant")) {
    await supabase.from("profiles").update({ preferred_mode: modo, papel_ativo: modo === "owner" ? "proprietario" : "morador" }).eq("id", userId);
    papelAplicado = modo;
  }
  // E205-B (a): a primeira entrada manda as boas-vindas (uma vez por conta; a chave de envio segura repetições).
  if (primeiroAcesso) {
    after(async () => {
      const admin = createAdminClient();
      if (admin) await enviarBoasVindas(admin, userId, intencao, modo);
    });
  }
  return { ok: true, papelAplicado };
}

/**
 * E268-B — quem vira dono pelo anúncio: no primeiro rascunho (Passo 1 ou qualificação, o que vier primeiro), sem
 * "anunciar" na intenção, registra-a pelo MESMO caminho da tela de intenção (as boas-vindas de dono saem se for o
 * primeiro acesso da conta). Conta que já respondeu a tela só ganha o "anunciar" na intenção: nada de segundo
 * boas-vindas. Best-effort: nunca derruba o salvar do rascunho.
 */
export async function registrarIntencaoDeAnunciar(supabase: SupabaseClient, userId: string): Promise<void> {
  try {
    const { data } = await supabase.from("profiles").select("intencao").eq("id", userId).maybeSingle();
    const bruto = (data as { intencao?: unknown } | null)?.intencao;
    const nova = intencaoAoAnunciar(bruto == null ? null : normalizarIntencoes(bruto));
    if (nova) await gravarIntencao(supabase, userId, nova, "owner");
  } catch {
    /* boas-vindas é complemento */
  }
}
