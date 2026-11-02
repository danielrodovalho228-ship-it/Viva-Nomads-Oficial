import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { signAvatarPath } from "@/lib/data/avatar-url";
import type { Reputacao } from "@/lib/data/avaliacoes-actions";
import { linkedinConectados } from "@/lib/linkedin/servidor";
import { vinculosConfirmados } from "@/lib/vinculo/servidor";
import { createClient } from "@/lib/supabase/server";
import { relacaoAceitaEntreServidor } from "@/lib/data/avatar-url";
import { metricaResposta, nomeCompleto, nomeCurto, selosReais, type MetricaResposta } from "@/lib/perfil/perfil-publico";
import { nomeLiberadoNaVisita } from "@/lib/visitas/nome-visita";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Perfil público de quem anuncia (0149). Nada de e-mail, telefone ou documento. */
export interface PerfilProprietario {
  id: string;
  nome: string;
  fotoUrl: string | null;
  desde: string | null;
  cidade: string | null;
  bio: string | null;
  idiomas: string[];
  imoveisAtivos: number;
  estadiasConcluidas: number;
  /** null = menos de 3 conversas ("Novo na Viva"). */
  resposta: MetricaResposta | null;
  reputacao: Reputacao;
  selos: string[];
}

type Linha = {
  nome_curto: string | null;
  avatar_url: string | null;
  desde: string | null;
  cidade: string | null;
  bio: string | null;
  idiomas: string[] | null;
  email_confirmado: boolean | null;
  imoveis_ativos: number | null;
  estadias_concluidas: number | null;
  conversas: number | null;
  conversas_respondidas: number | null;
  resposta_media_min: number | null;
};

/**
 * SERVER-ONLY: a função do banco só roda com o service_role. Sem chave de serviço, id inválido, quem
 * nunca anunciou ou erro → null (o cartão cai no bloco simples e a página pública dá 404).
 */
export async function getPerfilProprietario(donoId: string | null | undefined): Promise<PerfilProprietario | null> {
  if (!donoId || !UUID_RE.test(donoId)) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  try {
    const { data, error } = await admin.rpc("perfil_publico_proprietario", { p_dono: donoId });
    const l = ((data as Linha[] | null) ?? [])[0];
    if (error || !l) return null;
    // Reputação pelo cliente do servidor (sem cookies): a página do imóvel é estática e quebraria ao ler a sessão.
    const [fotoUrl, notas, fones, perfil] = await Promise.all([
      signAvatarPath(l.avatar_url, donoId),
      admin.from("avaliacoes").select("nota_geral").eq("alvo_id", donoId).eq("status", "publicada"),
      admin.rpc("telefones_verificados", { p_ids: [donoId] }),
      // E427 (01/11): o nome abreviado sai do nome completo pela MESMA regra da visita (nomeCurto). O nome_curto do banco
      // usava a inicial do último pedaço mesmo sendo número ("Daniel 1."); só o resultado abreviado sai daqui.
      admin.from("profiles").select("full_name").eq("id", donoId).maybeSingle(),
    ]);
    // Selo do telefone (0150): sem a função (ainda não aplicada) ou com erro, simplesmente não aparece.
    const telefoneVerificado = !fones.error && ((fones.data ?? []) as { verificado: boolean }[]).some((f) => f.verificado);
    const ns = ((notas.data ?? []) as { nota_geral: number }[]).map((r) => Number(r.nota_geral));
    const reputacao: Reputacao = ns.length
      ? { media: Math.round((ns.reduce((a, n) => a + n, 0) / ns.length) * 10) / 10, n: ns.length }
      : { media: 0, n: 0 };
    return {
      id: donoId,
      nome: nomeCurto((perfil.data as { full_name?: string | null } | null)?.full_name) ?? nomeCurto(l.nome_curto) ?? "Proprietário",
      fotoUrl,
      desde: l.desde,
      cidade: l.cidade,
      bio: l.bio,
      idiomas: l.idiomas ?? [],
      imoveisAtivos: l.imoveis_ativos ?? 0,
      estadiasConcluidas: l.estadias_concluidas ?? 0,
      resposta: metricaResposta(l.conversas ?? 0, l.conversas_respondidas ?? 0, l.resposta_media_min),
      reputacao,
      selos: selosReais({ emailConfirmado: l.email_confirmado, telefoneVerificado, linkedinConectado: (await linkedinConectados([donoId], undefined, { publico: true })).has(donoId),
        vinculoDominio: (await vinculosConfirmados([donoId])).get(donoId) ?? null,
      }),
    };
  } catch {
    return null;
  }
}

/**
 * E427 (01/11, vigia): a página pública mostra o nome COMPLETO do proprietário só a quem já tem o aceite com ele
 * (contrato, candidatura aceita, resposta de Pedido de Moradia aceita ou visita confirmada/feita) — o mesmo nome da
 * visita e de Mensagens. Para todo o resto (visitante anônimo, outra conta, o próprio dono) segue o nome curto de
 * sempre: antes do aceite, a privacidade atual. FAIL-CLOSED: sem sessão, sem chave de serviço ou erro → null.
 */
export async function nomeCompletoParaQuemTemAceite(donoId: string): Promise<string | null> {
  if (!UUID_RE.test(donoId)) return null;
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    if (!supabase || !admin) return null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.id === donoId) return null;
    let aceite = await relacaoAceitaEntreServidor(donoId, user.id);
    if (!aceite) {
      const { data: visitas } = await admin.from("visitas_video").select("status").eq("owner_id", donoId).eq("tenant_id", user.id);
      aceite = ((visitas ?? []) as { status: string | null }[]).some((v) => nomeLiberadoNaVisita(v.status));
    }
    if (!aceite) return null;
    const { data } = await admin.from("profiles").select("full_name").eq("id", donoId).maybeSingle();
    return nomeCompleto((data as { full_name?: string | null } | null)?.full_name ?? null);
  } catch {
    return null;
  }
}

export interface AvaliacaoRecebida {
  id: string;
  nota: number;
  comentario: string;
  data: string | null;
  resposta: string | null;
}

/**
 * Avaliações PUBLICADAS recebidas por quem anuncia, com a resposta pública dele.
 * Achado 59: a falha de leitura LANÇA — antes o perfil público dizia "Ainda sem avaliações publicadas" para quem tem.
 * A falha só das respostas não esconde as avaliações (a resposta pública é um complemento).
 */
export async function getAvaliacoesRecebidas(donoId: string): Promise<AvaliacaoRecebida[]> {
  const admin = createAdminClient();
  if (!admin || !UUID_RE.test(donoId)) return [];
  const { data, error } = await admin
    .from("avaliacoes")
    .select("id, nota_geral, comentario_publico, publicada_em")
    .eq("alvo_id", donoId)
    .eq("status", "publicada")
    .order("publicada_em", { ascending: false })
    .limit(20);
  if (error) throw new Error("Não foi possível ler as avaliações agora.");
  const linhas = (data ?? []) as { id: string; nota_geral: number; comentario_publico: string | null; publicada_em: string | null }[];
  if (linhas.length === 0) return [];
  const { data: resp } = await admin.from("avaliacao_respostas").select("avaliacao_id, texto").in("avaliacao_id", linhas.map((l) => l.id));
  const porId = new Map(((resp ?? []) as { avaliacao_id: string; texto: string }[]).map((r) => [r.avaliacao_id, r.texto]));
  return linhas.map((l) => ({
    id: l.id,
    nota: Number(l.nota_geral),
    comentario: l.comentario_publico ?? "",
    data: l.publicada_em,
    resposta: porId.get(l.id) ?? null,
  }));
}
