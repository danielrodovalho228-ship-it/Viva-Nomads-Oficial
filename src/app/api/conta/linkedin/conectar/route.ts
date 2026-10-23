import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumirLimite, HORA } from "@/lib/limites";
import { SITE_URL } from "@/lib/site";
import { linkedinAtivo } from "@/lib/linkedin/chave";
import { configLinkedin, segredoLinkedin } from "@/lib/linkedin/servidor";
import { COOKIE_FLUXO, ESCOPO, VIDA_COOKIE_SEG, assinarCookie, desafioPkce, novoSegredoDoFluxo } from "@/lib/linkedin/regras";

export const dynamic = "force-dynamic";

const CONTA = "/dashboard/conta";

/**
 * 63-B — começa o "Conectar LinkedIn" (não é login): exige sessão Viva, 5 tentativas por hora por conta, gera state, nonce
 * e PKCE num cookie httpOnly assinado de 10 min e manda SÓ para o endereço de autorização do LinkedIn (no laboratório, o
 * OIDC simulado). Escopo "openid profile": nada de e-mail, foto ou contatos.
 */
export async function GET() {
  const volta = (motivo: string) => NextResponse.redirect(`${SITE_URL}${CONTA}?linkedin=${motivo}#confianca`, 303);
  if (!(await linkedinAtivo())) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  const supabase = await createClient();
  if (!supabase) return volta("indisponivel");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${SITE_URL}/auth?next=${encodeURIComponent(CONTA)}`, 303);
  const cfg = configLinkedin();
  const chave = segredoLinkedin("cookie");
  if (!cfg || !chave) return volta("indisponivel");
  if (!(await consumirLimite(`linkedin-conectar:${user.id}`, 5, HORA))) return volta("limite");

  const fluxo = novoSegredoDoFluxo(user.id);
  const url = new URL(cfg.autorizar);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clienteId,
    redirect_uri: cfg.retorno,
    scope: ESCOPO,
    state: fluxo.state,
    nonce: fluxo.nonce,
    code_challenge: desafioPkce(fluxo.verificador),
    code_challenge_method: "S256",
  }).toString();
  const res = NextResponse.redirect(url.toString(), 303);
  res.cookies.set(COOKIE_FLUXO, assinarCookie(fluxo, chave), {
    httpOnly: true,
    secure: SITE_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/api/conta/linkedin",
    maxAge: VIDA_COOKIE_SEG,
  });
  return res;
}
