import "server-only";
/*
  63-B — o lado do servidor do selo "LinkedIn conectado": configuração (LinkedIn de verdade ou o OIDC simulado do
  laboratório), leitura do selo (da própria pessoa e, só o "conectado", de outras) e a rotina do aviso de 30 dias.
  As chaves LINKEDIN_CLIENT_ID e LINKEDIN_CLIENT_SECRET ficam só na Vercel (o Daniel cola); nada aqui as imprime.
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { integracoesSimuladas } from "@/lib/integracoes";
import { SITE_URL } from "@/lib/site";
import { linkedinAtivo } from "./chave";
import { avisoDeVencimentoDevido, estadoSelo, type EstadoSelo, type LinhaConfianca } from "./regras";

export interface ConfigLinkedin {
  autorizar: string;
  token: string;
  jwks: string;
  iss: string;
  clienteId: string;
  clienteSegredo: string;
  /** Endereço de retorno EXATO cadastrado no app do LinkedIn. */
  retorno: string;
}

/** Endereço de retorno que o Daniel cadastra no app do LinkedIn (Authorized redirect URLs). */
export const CAMINHO_RETORNO = "/api/conta/linkedin/retorno";

/**
 * LinkedIn de verdade (OIDC em www.linkedin.com) com as chaves da Vercel; no laboratório (INTEGRACOES_SIMULADAS, nunca em
 * produção) o OIDC simulado de scripts/lab/linkedin-falso.mjs (LAB_LINKEDIN_URL). Sem chave → null (o botão não aparece).
 */
export function configLinkedin(): ConfigLinkedin | null {
  const retorno = `${SITE_URL}${CAMINHO_RETORNO}`;
  const lab = process.env.LAB_LINKEDIN_URL?.replace(/\/$/, "");
  if (integracoesSimuladas() && lab) {
    return { autorizar: `${lab}/oauth/v2/authorization`, token: `${lab}/oauth/v2/accessToken`, jwks: `${lab}/oauth/openid/jwks`, iss: `${lab}/oauth`, clienteId: "lab-cliente", clienteSegredo: "lab-segredo", retorno };
  }
  const clienteId = process.env.LINKEDIN_CLIENT_ID;
  const clienteSegredo = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clienteId || !clienteSegredo) return null;
  return {
    autorizar: "https://www.linkedin.com/oauth/v2/authorization",
    token: "https://www.linkedin.com/oauth/v2/accessToken",
    jwks: "https://www.linkedin.com/oauth/openid/jwks",
    iss: "https://www.linkedin.com/oauth",
    clienteId,
    clienteSegredo,
    retorno,
  };
}

/** Segredo do servidor para o hash do `sub` e para assinar o cookie do fluxo (dois usos, chaves derivadas diferentes). */
export function segredoLinkedin(uso: "sub" | "cookie"): string | null {
  const base = process.env.LINKEDIN_HASH_SEGREDO || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return base ? `${uso}:${base}` : null;
}

type Admin = SupabaseClient;

/** O selo da própria pessoa (Conta): conectado, quando e até quando. Vencido = null. */
export async function seloLinkedinDe(userId: string, admin: Admin | null = createAdminClient()): Promise<EstadoSelo | null> {
  if (!admin) return null;
  const { data } = await admin.from("confianca_linkedin").select("conectado_em, valido_ate").eq("user_id", userId).maybeSingle();
  return estadoSelo(data as LinhaConfianca | null);
}

/** Quem destas contas tem o selo valendo agora (para candidatura, conversa, avaliação, perfil). Só o "sim", nada mais. */
export async function linkedinConectados(userIds: (string | null | undefined)[], admin: Admin | null = createAdminClient()): Promise<Set<string>> {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  // Chave desligada: nenhum selo aparece em lugar nenhum.
  if (!admin || ids.length === 0 || !(await linkedinAtivo())) return new Set();
  const { data } = await admin.from("confianca_linkedin").select("user_id").in("user_id", ids).gt("valido_ate", new Date().toISOString());
  return new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id));
}

/** Rotina diária: o aviso "Reconecte seu LinkedIn para manter o selo" 30 dias antes de vencer, uma vez. */
export async function rotinaLinkedin(admin: Admin, agora = new Date(), avisar: (userId: string) => Promise<void>): Promise<{ avisos: number }> {
  const limite = new Date(agora.getTime() + 31 * 86_400_000).toISOString();
  const { data } = await admin.from("confianca_linkedin").select("user_id, conectado_em, valido_ate, aviso_em").is("aviso_em", null).lte("valido_ate", limite).gt("valido_ate", agora.toISOString()).limit(2000);
  let avisos = 0;
  for (const l of (data ?? []) as (LinhaConfianca & { user_id: string; aviso_em: string | null })[]) {
    if (!avisoDeVencimentoDevido(l, agora)) continue;
    const { data: marcou } = await admin.from("confianca_linkedin").update({ aviso_em: agora.toISOString() }).eq("user_id", l.user_id).is("aviso_em", null).select("user_id");
    if (!marcou?.length) continue;
    await avisar(l.user_id).catch(() => null);
    avisos++;
  }
  return { avisos };
}
