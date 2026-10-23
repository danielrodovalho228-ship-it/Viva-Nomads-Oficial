import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/site";
import { notify } from "@/lib/notifications";
import { linkedinAtivo } from "@/lib/linkedin/chave";
import { configLinkedin, segredoLinkedin } from "@/lib/linkedin/servidor";
import { COOKIE_FLUXO, conferirIdToken, hashDoSub, lerCookie, nomeCompativel, retornoConfere, validoAte, type ChavePublica } from "@/lib/linkedin/regras";

export const dynamic = "force-dynamic";

const CONTA = "/dashboard/conta";

/**
 * 63-B — volta do LinkedIn. Confere a sessão Viva (a MESMA que começou), o state e o cookie de 10 min; troca o code no
 * SERVIDOR (com o PKCE); confere o id_token (JWKS, iss, aud, exp, nonce); confere o nome com o da conta; e grava só o
 * hash do `sub`, a data e a validade. Um LinkedIn por conta. O access token é descartado. Nunca cria conta nem entra.
 */
export async function GET(request: NextRequest) {
  const fim = (motivo: string) => {
    const r = NextResponse.redirect(`${SITE_URL}${CONTA}?linkedin=${motivo}#confianca`, 303);
    r.cookies.set(COOKIE_FLUXO, "", { path: "/api/conta/linkedin", maxAge: 0 });
    return r;
  };
  if (!(await linkedinAtivo())) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  const q = request.nextUrl.searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();
  const cfg = configLinkedin();
  const chaveCookie = segredoLinkedin("cookie");
  const chaveSub = segredoLinkedin("sub");
  if (!supabase || !admin || !cfg || !chaveCookie || !chaveSub) return fim("indisponivel");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${SITE_URL}/auth?next=${encodeURIComponent(CONTA)}`, 303);

  const fluxo = lerCookie(request.cookies.get(COOKIE_FLUXO)?.value, chaveCookie);
  if (!retornoConfere(fluxo, { state: q.get("state"), uid: user.id })) return fim("falha");
  if (q.get("error")) return fim("cancelado");
  const code = q.get("code");
  if (!code) return fim("falha");

  let idToken: string | undefined;
  let chaves: ChavePublica[] = [];
  try {
    const tok = await fetch(cfg.token, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: cfg.retorno, client_id: cfg.clienteId, client_secret: cfg.clienteSegredo, code_verifier: fluxo.verificador }),
      cache: "no-store",
    });
    // Só o id_token interessa; o access token é descartado aqui mesmo.
    idToken = ((await tok.json().catch(() => ({}))) as { id_token?: string }).id_token;
    const jwks = await fetch(cfg.jwks, { cache: "no-store" });
    chaves = (((await jwks.json().catch(() => ({}))) as { keys?: ChavePublica[] }).keys ?? []).filter(Boolean);
  } catch {
    return fim("falha");
  }
  if (!idToken) return fim("falha");
  const conferido = conferirIdToken(idToken, { chaves, iss: cfg.iss, aud: cfg.clienteId, nonce: fluxo.nonce });
  if (!conferido.ok) return fim("falha");

  const { data: perfil } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  if (!nomeCompativel((perfil as { full_name?: string | null } | null)?.full_name, conferido)) return fim("nome");

  const subHash = hashDoSub(conferido.sub, chaveSub);
  const { data: outra } = await admin.from("confianca_linkedin").select("user_id").eq("sub_hash", subHash).neq("user_id", user.id).maybeSingle();
  if (outra) {
    await sinalAoAtendimento(admin);
    return fim("outra");
  }
  const agora = new Date();
  const { error } = await admin
    .from("confianca_linkedin")
    .upsert({ user_id: user.id, sub_hash: subHash, conectado_em: agora.toISOString(), valido_ate: validoAte(agora).toISOString(), aviso_em: null }, { onConflict: "user_id" });
  if (error?.code === "23505") {
    await sinalAoAtendimento(admin);
    return fim("outra");
  }
  if (error) return fim("falha");
  await admin.from("eventos").insert({ tipo: "linkedin_conectado" }).then(() => null, () => null);
  return fim("conectado");
}

/** A equipe é avisada da tentativa (sem dizer de quem é a outra conta). */
async function sinalAoAtendimento(admin: NonNullable<ReturnType<typeof createAdminClient>>): Promise<void> {
  try {
    const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
    for (const ad of (admins ?? []) as { id: string }[]) {
      const { data: u } = await admin.auth.admin.getUserById(ad.id);
      await notify({ event: "linkedin_ja_conectado", email: u?.user?.email ?? undefined, userId: ad.id, pushUrl: "/admin/atendimento", interno: true });
    }
  } catch {
    /* aviso é complemento */
  }
}
