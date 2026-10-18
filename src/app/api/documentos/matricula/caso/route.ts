import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, DIA } from "@/lib/limites";
import { notify } from "@/lib/notifications";
import { adminsPorAviso } from "@/lib/notifications/push-admins";
import { VALORES_CASO } from "@/lib/documento/conferencia-matricula";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Prompt 19 — "o nome da matrícula não é o meu": o dono escolhe o caso (cônjuge, herança, empresa, gestor, compra
 * não registrada) e anexa o documento que comprova (enviado antes pelo MESMO /api/upload/documento, bucket privado).
 * Fica em revisão (até 48 h). Gestor/procurador também marca o anúncio como "Administro para o proprietário".
 * Só a PRÓPRIA conferência (user_id do login); a tabela só é gravada pelo servidor.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof corpo?.id === "string" && UUID_RE.test(corpo.id) ? corpo.id : null;
  const caso = typeof corpo?.caso === "string" && VALORES_CASO.includes(corpo.caso) ? corpo.caso : null;
  const path = typeof corpo?.path === "string" ? corpo.path : "";
  if (!id || !caso) return NextResponse.json({ error: "Escolha o seu caso." }, { status: 400 });
  if (!new RegExp(`^${user.id}/[0-9a-f-]{36}\\.(pdf|png|jpg)$`).test(path)) {
    return NextResponse.json({ error: "Anexe o documento do seu caso." }, { status: 400 });
  }
  if (!(await consumirLimite(`matricula-caso:${user.id}`, 10, DIA))) {
    return NextResponse.json({ error: "Muitos envios hoje. Tente novamente amanhã." }, { status: 429 });
  }

  const { data: check } = await admin
    .from("property_ownership_checks")
    .select("id, property_id, resultado")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!check) return NextResponse.json({ error: "Conferência não encontrada." }, { status: 404 });

  const { error } = await admin
    .from("property_ownership_checks")
    .update({ caso, caso_documento_path: path, resultado: "em_revisao", revisado_em: null, revisado_por: null })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Não foi possível salvar agora. Tente de novo." }, { status: 500 });

  if (caso === "gestor" && check.property_id) {
    await admin.from("properties").update({ ownership_type: "managed" }).eq("id", check.property_id).eq("owner_id", user.id);
  }

  try {
    const admins = await adminsPorAviso<{ email: string | null; full_name: string | null; notif_email: boolean | null }>("operacional", "email, full_name, notif_email");
    for (const a of admins) {
      if (a.email && a.notif_email !== false) await notify({ event: "documento_recebido", email: a.email, name: a.full_name ?? undefined, pushUrl: "/admin/documentos" });
    }
  } catch {
    /* best-effort */
  }
  return NextResponse.json({ ok: true, mensagem: "Documento recebido. A equipe confere em até 48 horas e avisa por e-mail." });
}
