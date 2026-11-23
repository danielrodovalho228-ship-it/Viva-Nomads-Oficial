import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { contaEhDeTeste } from "@/lib/contas-de-teste";
import { LISTA_MAX, corpoSemUrlDeFoto } from "@/lib/notifications/caixa-teste";

export const dynamic = "force-dynamic";

const NAO_LIDA = { error: "Não foi possível ler a caixa agora." };

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
  // E1134: "não li" não é "não tem". Se não deu para conferir a conta, a resposta é 503 (antes: "conta real", e a caixa
  // sumia para a conta de teste).
  let deTeste: boolean;
  try {
    deTeste = await contaEhDeTeste(admin, user.id);
  } catch {
    return NextResponse.json(NAO_LIDA, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!deTeste) return NextResponse.json({ emails: null }, { headers: { "Cache-Control": "no-store" } });

  const { data, error } = await admin
    .from("emails_teste")
    .select("id, criado_em, evento, assunto, corpo")
    .eq("usuario_id", user.id)
    .order("criado_em", { ascending: false })
    .limit(LISTA_MAX);
  // E1134: a leitura falhada não vira caixa vazia ("Nenhum e-mail ainda").
  if (error) return NextResponse.json(NAO_LIDA, { status: 503, headers: { "Cache-Control": "no-store" } });
  // E434: a URL crua da foto do cartão (e-mails guardados antes) nunca vai no corpo devolvido.
  const emails = (data ?? []).map((e) => ({ ...e, corpo: corpoSemUrlDeFoto(String(e.corpo ?? "")) }));
  return NextResponse.json({ emails }, { headers: { "Cache-Control": "no-store" } });
}
