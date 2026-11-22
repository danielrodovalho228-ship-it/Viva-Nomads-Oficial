import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signAvatarPath } from "@/lib/data/avatar-url";
import { fotoPublicaPermitida, type FonteAvaliador } from "./vitrine-avaliadores";
import { SELO_AVALIADOR_SOCIO } from "./regras";

/*
  E1080 (ORDEM-DUET-385/386): as fontes da listagem por cidade — os credenciados ativos/em teste (avaliadores_publicos) e
  os perfis publicados do piloto (avaliadores_perfil_publico). A foto é a de perfil da conta (fonte única do envio de
  foto), assinada só quando pode aparecer em público (fotoPublicaPermitida); sem ela, as iniciais. Leitura que falha
  LANÇA (achado 39): a página mostra o aviso do erro, nunca "nenhum avaliador" por engano.
*/
type Publico = { numero_credenciado: string; nome_curto: string; cidade: string; avaliacoes_feitas: number; nota_conduta: number | string | null; teste: boolean };

export async function fontesDaVitrine(admin: SupabaseClient): Promise<FonteAvaliador[]> {
  const [publicos, perfis, creds] = await Promise.all([
    admin.rpc("avaliadores_publicos"),
    admin.from("avaliadores_perfil_publico").select("numero, nome_publico, cidade, selo").eq("publicado", true),
    admin.from("avaliadores_credenciamento").select("numero_credenciado, user_id").in("status", ["ativo", "em_teste"]),
  ]);
  const falha = [publicos, perfis, creds].find((r) => r.error);
  if (falha) throw new Error(`[vitrine] ${falha.error!.message}`);
  const usuarioDe = new Map(((creds.data ?? []) as { numero_credenciado: string; user_id: string | null }[]).map((c) => [c.numero_credenciado, c.user_id]));
  const ids = [...new Set([...usuarioDe.values()].filter((x): x is string => !!x))];
  const { data: contas, error } = ids.length ? await admin.from("profiles").select("id, avatar_url, is_teste").in("id", ids) : { data: [], error: null };
  if (error) throw new Error(`[vitrine] contas: ${error.message}`);
  const conta = new Map(((contas ?? []) as { id: string; avatar_url: string | null; is_teste: boolean | null }[]).map((c) => [c.id, c]));
  const credenciados = await Promise.all(
    ((publicos.data ?? []) as Publico[]).map(async (a): Promise<FonteAvaliador> => {
      const uid = usuarioDe.get(a.numero_credenciado) ?? null;
      const c = uid ? conta.get(uid) : undefined;
      const teste = c?.is_teste === true || a.teste === true;
      return {
        numero: a.numero_credenciado,
        nome: a.nome_curto,
        cidade: a.cidade,
        selo: null,
        avaliacoesFeitas: Number(a.avaliacoes_feitas) || 0,
        notaConduta: a.nota_conduta == null ? null : Number(a.nota_conduta),
        contaTeste: teste,
        fotoUrl: uid && fotoPublicaPermitida(teste) ? await signAvatarPath(c?.avatar_url ?? null, uid) : null,
      };
    }),
  );
  const doPiloto = ((perfis.data ?? []) as { numero: string; nome_publico: string; cidade: string; selo: string | null }[]).map(
    (p): FonteAvaliador => ({ numero: p.numero, nome: p.nome_publico, cidade: p.cidade, selo: p.selo ?? SELO_AVALIADOR_SOCIO, avaliacoesFeitas: 0, notaConduta: null, contaTeste: false, fotoUrl: null }),
  );
  return [...credenciados, ...doPiloto];
}

/**
 * E1079 (385/386): a foto de perfil da conta do credenciado nº `numero`, assinada — só quando pode aparecer em público
 * (fotoPublicaPermitida: por agora, só a conta de teste). Sem conta, sem foto ou sem leitura: null (as iniciais).
 */
export async function fotoDoCredenciado(admin: SupabaseClient, numero: string, contaTeste: boolean): Promise<string | null> {
  if (!fotoPublicaPermitida(contaTeste)) return null;
  const { data: cred } = await admin.from("avaliadores_credenciamento").select("user_id, parceiros(user_id)").eq("numero_credenciado", numero).maybeSingle();
  const c = cred as unknown as { user_id: string | null; parceiros: { user_id: string | null } | null } | null;
  const uid = c?.user_id ?? c?.parceiros?.user_id ?? null;
  if (!uid) return null;
  const { data: conta } = await admin.from("profiles").select("avatar_url").eq("id", uid).maybeSingle();
  return signAvatarPath((conta as { avatar_url: string | null } | null)?.avatar_url ?? null, uid);
}
