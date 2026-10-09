import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite } from "@/lib/limites";
import { conferirTokenPonte, destinoPonteValido, segredoPonte } from "@/lib/app/ponte";

/**
 * Ponte app → navegador (ordem bc09134e, parte 2: TROCA). O navegador chega com ?t=<token>&u=<usuário>&d=<destino>.
 * Confere a assinatura (usuário + destino + prazo de 60 s), CONSOME o nonce uma única vez (reuso = recusado)
 * e abre a sessão desse usuário no navegador, indo direto ao destino. Qualquer falha cai em /auth sem
 * detalhes. Token nunca vai a log; a resposta não é guardada em cache nem repassa o endereço (referrer).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function recusar(request: Request) {
  const res = NextResponse.redirect(new URL("/auth", request.url), 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = params.get("t") ?? "";
  const usuario = params.get("u") ?? "";
  const destino = destinoPonteValido(params.get("d"));
  if (!destino || !UUID.test(usuario) || token.length > 100) return recusar(request);

  const nonce = conferirTokenPonte(token, usuario, destino, new Date(), segredoPonte());
  if (!nonce) return recusar(request);

  // Uso único: a primeira troca consome o nonce; a segunda estoura o limite e é recusada (falha fechada).
  if (!(await consumirLimite(`ponte-uso:${nonce}`, 1, 300))) return recusar(request);

  const admin = createAdminClient();
  const supabase = await createClient();
  if (!admin || !supabase) return recusar(request);

  const { data: pessoa } = await admin.auth.admin.getUserById(usuario);
  const email = pessoa?.user?.email;
  if (!email) return recusar(request);
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hash = link?.properties?.hashed_token;
  if (!hash) return recusar(request);
  const { error } = await supabase.auth.verifyOtp({ token_hash: hash, type: "magiclink" });
  if (error) return recusar(request);

  const res = NextResponse.redirect(new URL(destino, request.url), 303);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
