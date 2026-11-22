import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signAvatarPath } from "@/lib/data/avatar-url";
import { estadoIdentidade } from "@/lib/identidade/estado-servidor";
import { contaDaLinhaDeCredenciamento, fotoPublicaPermitida, seloDoCredenciado, type FonteAvaliador } from "./vitrine-avaliadores";
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
    admin.from("avaliadores_perfil_publico").select("numero, nome_publico, cidade, selo, credenciamento_id").eq("publicado", true),
    admin.from("avaliadores_credenciamento").select("id, numero_credenciado, user_id, parceiros(user_id)").in("status", ["ativo", "em_teste"]),
  ]);
  const falha = [publicos, perfis, creds].find((r) => r.error);
  if (falha) throw new Error(`[vitrine] ${falha.error!.message}`);
  const credsLidos = (creds.data ?? []) as unknown as { id: string; numero_credenciado: string; user_id: string | null; parceiros: { user_id: string | null } | null }[];
  // E1099 (ORDEM-473 §1): a conta pela regra única — também quando o credenciamento foi criado pelo parceiro.
  const usuarioDe = new Map(credsLidos.map((c) => [c.numero_credenciado, c.user_id]) /* MUTAÇÃO (ensaio): a listagem só por user_id */);
  // E1097: o perfil do piloto ligado a um credenciamento (o do Rogério, quando o CNPJ chegar) dá o selo a esse credenciado
  // e não entra outra vez na listagem.
  const numeroDoCred = new Map(credsLidos.map((c) => [c.id, c.numero_credenciado]));
  const linhasPerfil = (perfis.data ?? []) as { numero: string; nome_publico: string; cidade: string; selo: string | null; credenciamento_id: string | null }[];
  const seloLigado = new Map(
    linhasPerfil.filter((p) => p.credenciamento_id && numeroDoCred.has(p.credenciamento_id)).map((p) => [numeroDoCred.get(p.credenciamento_id!)!, p.selo]),
  );
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
        selo: seloDoCredenciado(teste, seloLigado.get(a.numero_credenciado) ?? null),
        avaliacoesFeitas: Number(a.avaliacoes_feitas) || 0,
        notaConduta: a.nota_conduta == null ? null : Number(a.nota_conduta),
        contaTeste: teste,
        fotoUrl: uid && fotoPublicaPermitida(teste) ? await signAvatarPath(c?.avatar_url ?? null, uid) : null,
        identidadeVerificada: uid ? await identidadeConfirmadaDaConta(admin, uid) : false,
      };
    }),
  );
  const doPiloto = linhasPerfil.filter((p) => !p.credenciamento_id || !numeroDoCred.has(p.credenciamento_id)).map(
    (p): FonteAvaliador => ({ numero: p.numero, nome: p.nome_publico, cidade: p.cidade, selo: p.selo ?? SELO_AVALIADOR_SOCIO, avaliacoesFeitas: 0, notaConduta: null, contaTeste: false, fotoUrl: null }),
  );
  return [...credenciados, ...doPiloto];
}

/** A conta (user_id) do credenciado nº `numero`: a do credenciamento ou a do parceiro dele. */
export async function contaDoCredenciado(admin: SupabaseClient, numero: string): Promise<string | null> {
  const { data: cred } = await admin.from("avaliadores_credenciamento").select("user_id, parceiros(user_id)").eq("numero_credenciado", numero).maybeSingle();
  return contaDaLinhaDeCredenciamento(cred as unknown as { user_id: string | null; parceiros: { user_id: string | null } | null } | null);
}

/**
 * E1099 (ORDEM-DUET-460 §3): "Identidade verificada pela Viva" no perfil público só com a identidade da conta do
 * credenciado CONFIRMADA (estadoIdentidade, o mesmo fato da área do avaliador). Sem conta ou sem leitura: false (a
 * linha não aparece — nunca afirmar o que não se conferiu).
 */
export async function identidadeConfirmadaDoCredenciado(admin: SupabaseClient, numero: string): Promise<boolean> {
  const uid = await contaDoCredenciado(admin, numero);
  return uid ? identidadeConfirmadaDaConta(admin, uid) : false;
}

/** E1099 parte 3: o mesmo fato, pela conta — o cartão da listagem e o perfil leem daqui. Sem leitura: false. */
export async function identidadeConfirmadaDaConta(admin: SupabaseClient, uid: string): Promise<boolean> {
  try {
    return (await estadoIdentidade(admin, uid)).estado === "confirmada";
  } catch {
    return false;
  }
}

/**
 * E1079 (385/386): a foto de perfil da conta do credenciado nº `numero`, assinada — só quando pode aparecer em público
 * (fotoPublicaPermitida: por agora, só a conta de teste). Sem conta, sem foto ou sem leitura: null (as iniciais).
 */
export async function fotoDoCredenciado(admin: SupabaseClient, numero: string, contaTeste: boolean): Promise<string | null> {
  if (!fotoPublicaPermitida(contaTeste)) return null;
  const uid = await contaDoCredenciado(admin, numero);
  if (!uid) return null;
  const { data: conta } = await admin.from("profiles").select("avatar_url").eq("id", uid).maybeSingle();
  return signAvatarPath((conta as { avatar_url: string | null } | null)?.avatar_url ?? null, uid);
}

/**
 * E1097: o selo da linha do piloto ligada ao credenciamento nº `numero` (só a do Rogério existe: "Avaliador sócio da
 * Viva"); sem ligação ou sem leitura, null — o perfil mostra "Avaliador credenciado".
 */
export async function seloLigadoDoCredenciado(admin: SupabaseClient, numero: string): Promise<string | null> {
  const { data: cred } = await admin.from("avaliadores_credenciamento").select("id").eq("numero_credenciado", numero).maybeSingle();
  const id = (cred as { id: string } | null)?.id;
  if (!id) return null;
  const { data } = await admin.from("avaliadores_perfil_publico").select("selo").eq("credenciamento_id", id).eq("publicado", true).maybeSingle();
  return (data as { selo: string | null } | null)?.selo ?? null;
}
