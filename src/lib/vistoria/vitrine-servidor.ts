import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signAvatarPath } from "@/lib/data/avatar-url";
import { estadoIdentidade } from "@/lib/identidade/estado-servidor";
import { avaliadorVisivelEmPublico, contaDaLinhaDeCredenciamento, fotoPublicaPermitida, normalizarSobre, seloDoCredenciado, vistaPublicaDoCredenciado, type FonteAvaliador, type PerfilLigado } from "./vitrine-avaliadores";
import { SELO_AVALIADOR_SOCIO } from "./regras";

/*
  E1080 (ORDEM-DUET-385/386): as fontes da listagem por cidade — os credenciados ativos/em teste (avaliadores_publicos) e
  os perfis publicados do piloto (avaliadores_perfil_publico). A foto é a de perfil da conta (fonte única do envio de
  foto), assinada só quando pode aparecer em público (fotoPublicaPermitida); sem ela, as iniciais. Leitura que falha
  LANÇA (achado 39): a página mostra o aviso do erro, nunca "nenhum avaliador" por engano.
*/
type Publico = { numero_credenciado: string; nome_curto: string; cidade: string; avaliacoes_feitas: number; nota_conduta: number | string | null; teste: boolean };

export async function fontesDaVitrine(admin: SupabaseClient): Promise<FonteAvaliador[]> {
  const [publicos, perfis, creds, situacoes] = await Promise.all([
    admin.rpc("avaliadores_publicos"),
    admin.from("avaliadores_perfil_publico").select("numero, nome_publico, cidade, selo, credenciamento_id").eq("publicado", true),
    admin.from("avaliadores_credenciamento").select("id, numero_credenciado, user_id, parceiros(user_id)").in("status", ["ativo", "em_teste"]),
    // E1222: o status de cada credenciado, para a regra de quem pode estar em público.
    admin.from("avaliadores_credenciamento").select("numero_credenciado, status").in("status", ["ativo", "em_teste"]),
  ]);
  const falha = [publicos, perfis, creds, situacoes].find((r) => r.error);
  if (falha) throw new Error(`[vitrine] ${falha.error!.message}`);
  const credsLidos = (creds.data ?? []) as unknown as { id: string; numero_credenciado: string; user_id: string | null; parceiros: { user_id: string | null } | null }[];
  const statusDe = new Map(((situacoes.data ?? []) as { numero_credenciado: string; status: string }[]).map((c) => [c.numero_credenciado, c.status]));
  // E1099 (ORDEM-473 §1): a conta pela regra única — também quando o credenciamento foi criado pelo parceiro.
  const usuarioDe = new Map(credsLidos.map((c) => [c.numero_credenciado, contaDaLinhaDeCredenciamento(c)]));
  // E1097: o perfil do piloto ligado a um credenciamento (o do Rogério, quando o CNPJ chegar) dá o selo a esse credenciado
  // e não entra outra vez na listagem.
  const numeroDoCred = new Map(credsLidos.map((c) => [c.id, c.numero_credenciado]));
  const linhasPerfil = (perfis.data ?? []) as { numero: string; nome_publico: string; cidade: string; selo: string | null; credenciamento_id: string | null }[];
  const seloLigado = new Map(
    linhasPerfil.filter((p) => p.credenciamento_id && numeroDoCred.has(p.credenciamento_id)).map((p) => [numeroDoCred.get(p.credenciamento_id!)!, p.selo]),
  );
  // E1208: a linha ligada manda também no nome público e na cidade do cartão (a cidade dá a tabela de preço).
  const ligadoDe = new Map<string, PerfilLigado>(
    linhasPerfil
      .filter((p) => p.credenciamento_id && numeroDoCred.has(p.credenciamento_id))
      .map((p) => [numeroDoCred.get(p.credenciamento_id!)!, { nome_publico: p.nome_publico, cidade: p.cidade, selo: p.selo }]),
  );
  const ids = [...new Set([...usuarioDe.values()].filter((x): x is string => !!x))];
  const { data: contas, error } = ids.length ? await admin.from("profiles").select("id, avatar_url, is_teste").in("id", ids) : { data: [], error: null };
  if (error) throw new Error(`[vitrine] contas: ${error.message}`);
  const conta = new Map(((contas ?? []) as { id: string; avatar_url: string | null; is_teste: boolean | null }[]).map((c) => [c.id, c]));
  // E1222: a linha curada PUBLICADA do credenciado — ligada ao credenciamento ou com o mesmo número.
  const comCurada = new Set([...seloLigado.keys(), ...linhasPerfil.map((p) => p.numero)]);
  const testeDe = (a: Publico) => {
    const uid = usuarioDe.get(a.numero_credenciado) ?? null;
    return (uid ? conta.get(uid) : undefined)?.is_teste === true || a.teste === true;
  };
  const visiveis = ((publicos.data ?? []) as Publico[]).filter((a) =>
    avaliadorVisivelEmPublico({ status: statusDe.get(a.numero_credenciado) ?? null, teste: testeDe(a), temLinhaCuradaPublicada: comCurada.has(a.numero_credenciado) }),
  );
  const credenciados = await Promise.all(
    visiveis.map(async (a): Promise<FonteAvaliador> => {
      const uid = usuarioDe.get(a.numero_credenciado) ?? null;
      const c = uid ? conta.get(uid) : undefined;
      const teste = testeDe(a);
      const vista = vistaPublicaDoCredenciado(a, ligadoDe.get(a.numero_credenciado) ?? null);
      return {
        numero: a.numero_credenciado,
        nome: vista.nome,
        cidade: vista.cidade,
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

/**
 * E1222 (ORDEM-DUET-1075): a página /avaliadores/<nº> aplica a MESMA regra da vitrine (avaliadorVisivelEmPublico) ao
 * credenciado nº `numero`: lê o status, a conta (de teste ou não) e a linha curada publicada (ligada ou com o mesmo
 * número). `testeDoPublico` é o `teste` que avaliadores_publicos() já devolveu. Leitura que falha: false — a página
 * responde 404, nunca mostra a pessoa por engano.
 */
export async function credenciadoVisivelEmPublico(admin: SupabaseClient, numero: string, testeDoPublico: boolean): Promise<boolean> {
  const { data: cred, error } = await admin.from("avaliadores_credenciamento").select("id, status, user_id, parceiros(user_id)").eq("numero_credenciado", numero).maybeSingle();
  if (error || !cred) return false;
  const c = cred as unknown as { id: string; status: string | null; user_id: string | null; parceiros: { user_id: string | null } | null };
  const [porLigacao, porNumero] = await Promise.all([
    admin.from("avaliadores_perfil_publico").select("numero").eq("credenciamento_id", c.id).eq("publicado", true),
    admin.from("avaliadores_perfil_publico").select("numero").eq("numero", numero).eq("publicado", true),
  ]);
  const temLinhaCuradaPublicada = !porLigacao.error && !porNumero.error && ((porLigacao.data ?? []).length > 0 || (porNumero.data ?? []).length > 0);
  let teste = testeDoPublico === true;
  const uid = contaDaLinhaDeCredenciamento(c);
  if (!teste && uid) {
    const { data: conta } = await admin.from("profiles").select("is_teste").eq("id", uid).maybeSingle();
    teste = (conta as { is_teste: boolean | null } | null)?.is_teste === true;
  }
  return avaliadorVisivelEmPublico({ status: c.status, teste, temLinhaCuradaPublicada });
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

/**
 * E1208 (ORDEM-DUET-989): a linha curada ligada ao credenciamento nº `numero` (nome público, cidade e selo); sem ligação
 * ou sem leitura, null — a página fica com o nome, a cidade e o selo do credenciado, como antes.
 */
export async function perfilLigadoDoCredenciado(admin: SupabaseClient, numero: string): Promise<PerfilLigado | null> {
  const { data: cred } = await admin.from("avaliadores_credenciamento").select("id").eq("numero_credenciado", numero).maybeSingle();
  const id = (cred as { id: string } | null)?.id;
  if (!id) return null;
  const { data, error } = await admin.from("avaliadores_perfil_publico").select("nome_publico, cidade, selo").eq("credenciamento_id", id).eq("publicado", true).maybeSingle();
  if (error || !data) return null;
  return data as PerfilLigado;
}

/**
 * E1099 parte 2: o "Sobre" do credenciado nº `numero` (0355), escrito por ele. Sem texto ou sem leitura: null — o perfil
 * esconde a secção.
 */
export async function sobreDoCredenciado(admin: SupabaseClient, numero: string): Promise<string | null> {
  const { data, error } = await admin.from("avaliadores_credenciamento").select("sobre").eq("numero_credenciado", numero).maybeSingle();
  if (error) return null;
  const n = normalizarSobre((data as { sobre: string | null } | null)?.sobre ?? "");
  return n.ok ? n.valor : null;
}
