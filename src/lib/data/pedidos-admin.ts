"use server";

import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import { SITE_URL } from "@/lib/site";
import { textoEmail } from "@/lib/notifications/texto-seguro";
import { logModeracao } from "@/lib/data/moderacao-log";
import { metricasPedidos, type MetricasPedidos } from "@/lib/data/pedidos-compat";
import { ehAdmin } from "@/lib/data/admin-guard";

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

/** Números dos pedidos (últimos 30 dias) — só para admin. */
export async function getMetricasPedidosAdmin(): Promise<MetricasPedidos | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return null;
  return metricasPedidos(30);
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
  if (!(await ehAdmin(supabase, user.id))) return { ok: false, error: "Sem permissão." };
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

  await logModeracao(supabase, user.id, "ocultar_pedido", "pedido_moradia", pedidoId, motivoLimpo);

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
        detailsHtml: `<p style="margin:12px 0 0;color:#334155;">Motivo: ${textoEmail(motivoLimpo, 500)}</p>
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
  // Antes não conferia admin (o banco também passa a barrar — 0062).
  if (!(await ehAdmin(supabase, user.id))) return { ok: false, error: "Sem permissão." };
  const { error } = await supabase
    .from("pedidos_moradia")
    .update({ status: "ativo", removido_motivo: null })
    .eq("id", pedidoId);
  if (error) return { ok: false, error: error.message };
  await logModeracao(supabase, user.id, "reativar_pedido", "pedido_moradia", pedidoId);
  return { ok: true };
}
