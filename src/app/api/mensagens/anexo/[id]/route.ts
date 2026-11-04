import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_ANEXOS } from "@/lib/messages/anexos";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * E445 item 5 (backend): abre um anexo do chat. Só quem está na conversa encontra a linha (RLS "anexos das partes");
 * a resposta é um redirecionamento para URL assinada de 10 minutos. Nada público, nada em cache compartilhado.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });

  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return NextResponse.json({ error: "Indisponível no momento." }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  // Leitura com o cliente do usuário: a RLS só devolve o anexo a remetente ou destinatário.
  const { data: anexo, error } = await supabase.from("mensagens_anexos").select("caminho").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível abrir o anexo agora." }, { status: 500 });
  if (!anexo) return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });

  const { data: assinada, error: eUrl } = await admin.storage.from(BUCKET_ANEXOS).createSignedUrl(anexo.caminho, 600);
  if (eUrl || !assinada?.signedUrl) return NextResponse.json({ error: "Não foi possível abrir o anexo agora." }, { status: 500 });

  const res = NextResponse.redirect(assinada.signedUrl, 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
