"use server";

import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import { SITE_URL } from "@/lib/site";
import { textoEmail } from "@/lib/notifications/texto-seguro";
import { logModeracao } from "@/lib/data/moderacao-log";
import { metricasPedidos, type MetricasPedidos } from "@/lib/data/pedidos-compat";
import { ehAdmin } from "@/lib/data/admin-guard";
import { erroBancoPT } from "@/lib/erros-banco";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerChaveSms } from "@/lib/data/chave-sms";
import { PRAZO_CONFIRMAR_TELEFONE_DIAS, telefoneConfirmado, textoAvisoTelefone } from "@/lib/pedidos/confirmacao";

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
  if (error) return { ok: false, error: erroBancoPT(error) };
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
  if (error) return { ok: false, error: erroBancoPT(error) };
  await logModeracao(supabase, user.id, "reativar_pedido", "pedido_moradia", pedidoId);
  return { ok: true };
}

/**
 * Chave SMS_ATIVO (Prompt 30): a equipe liga ou desliga. Ligar grava a hora (os pedidos já publicados ganham 7 dias
 * para o telefone ser confirmado) e avisa por e-mail cada inquilino com pedido ativo e telefone não confirmado.
 * Desligar volta a valer só o e-mail confirmado. Fica no registro de moderação.
 */
export async function definirChaveSms(ligar: boolean): Promise<ActionResult & { avisados?: number }> {
  if (typeof ligar !== "boolean") return { ok: false, error: "Valor inválido." };
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  if (!(await ehAdmin(supabase, user.id))) return { ok: false, error: "Sem permissão." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Não foi possível salvar agora. Tente de novo." };
  const atual = await lerChaveSms();
  if (atual.ligada === ligar) return { ok: true, avisados: 0 };
  const agora = new Date().toISOString();
  const { error } = await admin
    .from("chaves_plataforma")
    .upsert({ chave: "SMS_ATIVO", ligada: ligar, ligada_em: ligar ? agora : null, alterada_em: agora, alterada_por: user.id });
  if (error) return { ok: false, error: erroBancoPT(error) };
  // O registro de moderação guarda quem mudou a chave (alvo = a própria pessoa da equipe; a chave vai no tipo).
  await logModeracao(supabase, user.id, ligar ? "sms_ativo_ligada" : "sms_ativo_desligada", "chave_sms", user.id, "SMS_ATIVO");
  if (!ligar) return { ok: true, avisados: 0 };

  // Aviso de 7 dias a quem tem pedido ativo e telefone não confirmado.
  const prazo = new Date(Date.parse(agora) + PRAZO_CONFIRMAR_TELEFONE_DIAS * 86_400_000).toISOString();
  const { data: pedidos } = await admin.from("pedidos_moradia").select("id, inquilino_id").eq("status", "ativo").gt("expira_em", agora).limit(2000);
  const porInquilino = new Map<string, string[]>();
  for (const p of (pedidos ?? []) as { id: string; inquilino_id: string }[]) porInquilino.set(p.inquilino_id, [...(porInquilino.get(p.inquilino_id) ?? []), p.id]);
  let avisados = 0;
  for (const [inqId, ids] of porInquilino) {
    try {
      const [{ data: u }, { data: tv }, { data: perfil }] = await Promise.all([
        admin.auth.admin.getUserById(inqId),
        admin.from("telefone_verificacao").select("verificado_em").eq("user_id", inqId).maybeSingle(),
        admin.from("profiles").select("email, full_name").eq("id", inqId).maybeSingle(),
      ]);
      const ok = telefoneConfirmado({
        emailConfirmadoEm: u?.user?.email_confirmed_at,
        telefoneConfirmadoEm: u?.user?.phone_confirmed_at,
        telefoneVerificadoEm: (tv?.verificado_em as string | null) ?? null,
      });
      if (ok || !perfil?.email) continue;
      const texto = textoAvisoTelefone(prazo);
      await notify({
        event: "pedido_confirmar_telefone",
        email: perfil.email as string,
        name: (perfil.full_name as string) ?? undefined,
        userId: inqId,
        pushUrl: "/dashboard/conta/perfil",
        detailsHtml: `<p style="margin:12px 0 0;color:#334155;">${textoEmail(texto, 300)}</p>
          <p style="margin:12px 0 0;"><a href="${SITE_URL}/dashboard/conta/perfil" style="color:#0f3d2e;font-weight:700;">Confirmar telefone →</a></p>`,
        detailsText: `${texto} ${SITE_URL}/dashboard/conta/perfil`,
      });
      await admin.from("pedidos_moradia").update({ aviso_telefone_em: agora }).in("id", ids);
      avisados += 1;
    } catch (e) {
      console.error("[definirChaveSms] aviso falhou:", e);
    }
  }
  return { ok: true, avisados };
}

/** Estado da chave para a tela da equipe. */
export async function getChaveSmsAdmin(): Promise<{ ligada: boolean; ligadaEm: string | null } | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return null;
  return lerChaveSms();
}
