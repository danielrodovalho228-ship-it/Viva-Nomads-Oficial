import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { contaEhDeTeste } from "@/lib/contas-de-teste";
import { LISTA_MAX } from "@/lib/notifications/caixa-teste";

export const dynamic = "force-dynamic";

/**
 * Caixa de e-mails de teste da PRÓPRIA conta de teste (ordem ee7d27b8, item 3): o QA lê o código de
 * assinatura sem acesso de admin. Só a sessão decide quem é; só linhas com usuario_id = ela; conta real recebe 200 sem e-mails (um 404 aparecia como erro no console de toda tela Conta; lab t48).
 */
export async function GET() {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await contaEhDeTeste(admin, user.id))) return NextResponse.json({ emails: null }, { headers: { "Cache-Control": "no-store" } });

  const { data } = await admin
    .from("emails_teste")
    .select("id, criado_em, evento, assunto, corpo")
    .eq("usuario_id", user.id)
    .order("criado_em", { ascending: false })
    .limit(LISTA_MAX);
  return NextResponse.json({ emails: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
