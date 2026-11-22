import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { usuarioDoPerfil } from "@/lib/auth/usuario-do-perfil";
import type { SessionUser } from "@/lib/store";
import type { UserRole } from "@/lib/types";

/**
 * E793 Onda 0 — o usuário da sessão conferida NO SERVIDOR, para o layout do painel desenhar o 1º quadro.
 *
 * A3: `getClaims()` sempre. Na versão instalada (@supabase/auth-js 2.108.2), com chave simétrica (alg HS*) ou sem `kid`,
 * ele mesmo cai para `getUser(token)` — a conferência no servidor de autenticação; com chave assimétrica, confere a
 * assinatura localmente (WebCrypto + JWKS). Ver o trecho citado no PR.
 *
 * A2: NUNCA lança e NUNCA redireciona. Sem sessão, erro ou leitura de perfil falha → null, e o painel se comporta como
 * hoje (o guarda espera o cliente). Quem barra sem sessão é o proxy.
 *
 * `cache()`: uma leitura por requisição, mesmo que mais de um componente de servidor peça.
 */
export const usuarioDaSessaoServidor = cache(async (): Promise<SessionUser | null> => {
  try {
    const supabase = await createClient();
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || !claims?.sub) return null;
    const meta = (claims.user_metadata ?? {}) as { full_name?: string; role?: UserRole };
    const { data: perfil, error: erroPerfil } = await supabase
      .from("profiles")
      .select("full_name, role, preferred_mode, papel_ativo, is_teste")
      .eq("id", claims.sub)
      .maybeSingle();
    if (erroPerfil) return null;
    return usuarioDoPerfil(
      {
        id: claims.sub,
        email: typeof claims.email === "string" ? claims.email : undefined,
        metaName: meta.full_name || undefined,
        metaRole: meta.role ?? "tenant",
      },
      perfil,
    );
  } catch {
    return null;
  }
});
