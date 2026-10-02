"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Registra/atualiza o token de push do dispositivo do usuário logado.
 * Chamado pelo app nativo (Capacitor) após o SO liberar as notificações.
 * Upsert por `token`: um token pertence a um aparelho/usuário.
 */
export async function registrarPushToken(
  token: string,
  platform: "android" | "ios" | "web"
): Promise<{ ok: boolean }> {
  if (!token) return { ok: false };
  const supabase = await createClient();
  if (!supabase) return { ok: true }; // modo demo (sem Supabase)

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase.from("push_tokens").upsert(
    { token, platform, user_id: user.id, updated_at: new Date().toISOString() },
    { onConflict: "token" }
  );
  if (error) {
    // Tabela ainda não migrada (0048) ou erro transitório: não quebra o app.
    console.error("[push] falha ao registrar token:", error.message);
    return { ok: false };
  }
  return { ok: true };
}

/**
 * Remove o token do APARELHO ao sair da conta (celular compartilhado): sem isso,
 * o próximo usuário receberia as notificações da conta anterior. RLS garante que
 * só se apaga um token do próprio usuário.
 */
export async function removerPushToken(token: string): Promise<{ ok: boolean }> {
  if (!token) return { ok: false };
  const supabase = await createClient();
  if (!supabase) return { ok: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("push_tokens")
    .delete()
    .eq("token", token)
    .eq("user_id", user.id);
  if (error) {
    console.error("[push] falha ao remover token:", error.message);
    return { ok: false };
  }
  return { ok: true };
}
