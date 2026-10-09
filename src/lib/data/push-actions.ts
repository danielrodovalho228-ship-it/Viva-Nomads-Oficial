"use server";

import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/data/admin-guard";
import { plataformaValida, podeEnviarTeste, tokenValido } from "@/lib/notifications/push-validacao";
import { sendPush } from "@/lib/notifications/push";

const historicoTeste = new Map<string, number[]>();

/**
 * Registra/atualiza o token de push do dispositivo do usuário logado.
 * Chamado pelo site dentro do app (Expo) depois que o celular libera as notificações.
 * Upsert por `token`: um token pertence a um aparelho/usuário.
 */
export async function registrarPushToken(
  token: string,
  platform: "android" | "ios" | "web"
): Promise<{ ok: boolean }> {
  if (!tokenValido(token) || !plataformaValida(platform)) return { ok: false };
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

/** /admin: push de teste para os aparelhos do PRÓPRIO admin. Só admin; 5 por hora. */
export async function enviarPushDeTeste(): Promise<{ ok: boolean; erro?: string; enviados?: number }> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, erro: "Indisponível em modo demonstração." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return { ok: false, erro: "Sem permissão." };
  if (!podeEnviarTeste(historicoTeste, user.id)) return { ok: false, erro: "Limite de 5 testes por hora. Tente mais tarde." };
  const r = await sendPush({
    userId: user.id,
    title: "Viva Nomads · teste",
    body: "Se você viu isto, o push está funcionando.",
    url: "/admin/agentes",
  });
  const enviados = "sent" in r ? r.sent : 0;
  return enviados > 0
    ? { ok: true, enviados }
    : { ok: false, erro: "Nenhum aparelho recebeu. Abra o app, toque em “Ativar notificações” e tente de novo." };
}
