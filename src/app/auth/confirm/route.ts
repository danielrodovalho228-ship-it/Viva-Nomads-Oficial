import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Confirmação de e-mail via `token_hash` + `verifyOtp` — fluxo server-side
 * recomendado pelo Supabase e ROBUSTO contra o "pré-carregamento" de links
 * (scanners de webmail/antivírus que abriam o link antes do usuário e quebravam
 * o fluxo PKCE do /auth/callback, deixando o e-mail como "não confirmado").
 *
 * Os templates de e-mail do Supabase apontam para cá, por tipo, ex.:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/dashboard
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (token_hash && type) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash });
      // Confirmado (ou já confirmado antes por um pré-carregamento): segue ao destino.
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    }
  }
  // Falha (token inválido/expirado): manda ao login com um aviso amigável.
  return NextResponse.redirect(`${origin}/auth?erro=confirmacao`);
}
