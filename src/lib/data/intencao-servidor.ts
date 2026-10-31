import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarBoasVindas } from "@/lib/notifications/boas-vindas-servidor";
import { intencaoAoAnunciar, normalizarIntencoes, type Intencao } from "@/lib/auth/entrada";
import { contaNoPrimeiroAcesso, registraIntencaoNova } from "@/lib/papel/papel-ativo";

/*
  O caminho ÚNICO de gravar a intenção (Prompt 49 + E205-B): a tela de intenção, a Conta › Papéis e — E268-B — o
  primeiro rascunho de anúncio passam por aqui. Grava a intenção; SÓ no primeiro acesso (intenção e papel ativo ainda
  vazios), o papel inicial; e — E283-B — as boas-vindas quando a intenção registrada agora estava vazia, com ou sem
  papel gravado pelo uso (uma por conta: a chave de envio segura repetições). Fora do "use server": nada aqui vira ação
  chamável pelo navegador.
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
  // E283-B (relay nº 20): o boas-vindas sai ao REGISTRAR uma intenção que estava vazia — a tela de intenção ou o 1º
  // rascunho —, mesmo que o uso já tenha gravado um papel. Uma vez por conta: a chave de envio segura repetições (quem
  // já recebeu o de morador não recebe o de dono). O papel inicial continua só no 1º acesso (acima).
  if (registraIntencaoNova(a?.intencao, intencao)) {
    after(async () => {
      const admin = createAdminClient();
      if (admin) await enviarBoasVindas(admin, userId, intencao, modo);
    });
  }
  return { ok: true, papelAplicado };
}

/**
 * E268-B — quem vira dono pelo anúncio: no primeiro rascunho (Passo 1 ou qualificação, o que vier primeiro), sem
 * "anunciar" na intenção, registra-a pelo MESMO caminho da tela de intenção. E283-B: se a intenção estava vazia, sai o
 * boas-vindas de dono (a menos que a conta já tenha recebido um). Conta que já respondeu a tela só ganha o "anunciar"
 * na intenção: nada de segundo boas-vindas. Best-effort: nunca derruba o salvar do rascunho.
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
