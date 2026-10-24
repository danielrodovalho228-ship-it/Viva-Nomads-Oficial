import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOKEN_FORMATO } from "@/lib/niveis/prova-camera";
import { hashDoToken } from "@/lib/niveis/prova-servidor";

/**
 * FOTO-NA-HORA-B — o link "Continuar no celular" (QR ou e-mail). Uso único, 30 minutos, ligado ao dono: abre a tela de
 * prova do item (Nível, ruído e extras) no celular, já logado como o DONO. Nunca entra como outra conta: celular com
 * outra conta aberta é recusado (sem consumir o link). Token nunca vai a log; resposta sem cache e sem referrer.
 */
function para(request: Request, destino: string) {
  const res = NextResponse.redirect(new URL(destino, request.url), 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  if (!TOKEN_FORMATO.test(token)) return para(request, "/prova/celular/aviso?m=invalido");
  const admin = createAdminClient();
  const supabase = await createClient();
  if (!admin || !supabase) return para(request, "/prova/celular/aviso?m=invalido");

  const { data: link } = await admin.from("prova_links_celular").select("id, owner_id, property_id, chave, expira_em, usado_em").eq("token_hash", hashDoToken(token)).maybeSingle();
  if (!link || link.usado_em || !(Date.now() < Date.parse(link.expira_em as string))) return para(request, "/prova/celular/aviso?m=invalido");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && user.id !== link.owner_id) return para(request, "/prova/celular/aviso?m=outra-conta");

  // Uso único, atômico: só a primeira abertura consome o link.
  const { data: consumido } = await admin.from("prova_links_celular").update({ usado_em: new Date().toISOString() }).eq("id", link.id).is("usado_em", null).select("id");
  if (!consumido?.length) return para(request, "/prova/celular/aviso?m=invalido");

  if (!user) {
    const { data: pessoa } = await admin.auth.admin.getUserById(link.owner_id as string);
    const email = pessoa?.user?.email;
    const { data: magic } = email ? await admin.auth.admin.generateLink({ type: "magiclink", email }) : { data: null };
    const hash = magic?.properties?.hashed_token;
    const { error } = hash ? await supabase.auth.verifyOtp({ token_hash: hash, type: "magiclink" }) : { error: true };
    if (error) return para(request, "/prova/celular/aviso?m=invalido");
  }
  return para(request, `/dashboard/imoveis/${link.property_id}/nivel?fotografar=${encodeURIComponent(link.chave as string)}#nivel-itens`);
}
