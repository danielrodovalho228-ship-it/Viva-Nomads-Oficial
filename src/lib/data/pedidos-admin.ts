"use server";

import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import { SITE_URL } from "@/lib/site";

type ActionResult = { ok: boolean; demo?: boolean; error?: string };

/**
 * Admin: lista TODOS os pedidos (a RLS `is_admin()` libera a leitura completa).
 * Para não-admin, a RLS devolve só os próprios — a página é gated pelo nav admin.
 */
export async function adminListPedidos(): Promise<Record<string, unknown>[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("pedidos_moradia")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(500);
  return data ?? [];
}

/** Registra a ação de moderação no log (quem, o quê, quando). Best-effort. */
async function logModeracao(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  adminId: string,
  acao: string,
  alvoId: string,
  motivo?: string
) {
  await supabase
    .from("moderacao_log")
    .insert({
      admin_id: adminId,
      acao,
      alvo_tipo: "pedido_moradia",
      alvo_id: alvoId,
      motivo: motivo ?? null,
    })
    .then(undefined, () => {});
}

/**
 * Admin OCULTA um pedido (status removido_admin) com motivo, registra no log e
 * NOTIFICA o inquilino. A RLS `is_admin()` permite o update e a leitura do
 * perfil do inquilino (política "admin lê perfis").
 */
export async function moderarPedido(pedidoId: string, motivo: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  const motivoLimpo = (motivo ?? "").trim();
  if (!motivoLimpo) return { ok: false, error: "Informe o motivo da moderação." };

  const { data: pedido, error } = await supabase
    .from("pedidos_moradia")
    .update({ status: "removido_admin", removido_motivo: motivoLimpo })
    .eq("id", pedidoId)
    .select("id, inquilino_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!pedido) return { ok: false, error: "Pedido não encontrado (ou sem permissão)." };

  await logModeracao(supabase, user.id, "ocultar_pedido", pedidoId, motivoLimpo);

  // Notifica o inquilino (admin lê o perfil dele via is_admin).
  try {
    const { data: inq } = await supabase
      .from("profiles")
      .select("full_name, email, phone, notif_email, notif_whatsapp")
      .eq("id", pedido.inquilino_id as string)
      .maybeSingle();
    if (inq?.email && inq.notif_email !== false) {
      await notify({
        event: "pedido_moderado",
        email: inq.email as string,
        name: (inq.full_name as string) ?? undefined,
        phone: inq.notif_whatsapp === false ? undefined : ((inq.phone as string) ?? undefined),
        detailsHtml: `<p style="margin:12px 0 0;color:#334155;">Motivo: ${motivoLimpo}</p>
          <p style="margin:12px 0 0;"><a href="${SITE_URL}/dashboard/pedidos" style="color:#0f3d2e;font-weight:700;">Ver meus pedidos →</a></p>`,
        detailsText: `Motivo: ${motivoLimpo}\n\nResponda pela plataforma: ${SITE_URL}/dashboard/pedidos`,
      });
    }
  } catch {
    /* best-effort */
  }
  return { ok: true };
}

/** Admin REATIVA um pedido ocultado (volta para ativo) e registra no log. */
export async function reativarPedido(pedidoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  const { error } = await supabase
    .from("pedidos_moradia")
    .update({ status: "ativo", removido_motivo: null })
    .eq("id", pedidoId);
  if (error) return { ok: false, error: error.message };
  await logModeracao(supabase, user.id, "reativar_pedido", pedidoId);
  return { ok: true };
}
