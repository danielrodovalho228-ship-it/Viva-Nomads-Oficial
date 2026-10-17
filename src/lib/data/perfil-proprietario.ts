import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { signAvatarPath } from "@/lib/data/avatar-url";
import type { Reputacao } from "@/lib/data/avaliacoes-actions";
import { metricaResposta, nomeCurto, selosReais, type MetricaResposta } from "@/lib/perfil/perfil-publico";

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
    const [fotoUrl, notas] = await Promise.all([
      signAvatarPath(l.avatar_url, donoId),
      admin.from("avaliacoes").select("nota_geral").eq("alvo_id", donoId).eq("status", "publicada"),
    ]);
    const ns = ((notas.data ?? []) as { nota_geral: number }[]).map((r) => Number(r.nota_geral));
    const reputacao: Reputacao = ns.length
      ? { media: Math.round((ns.reduce((a, n) => a + n, 0) / ns.length) * 10) / 10, n: ns.length }
      : { media: 0, n: 0 };
    return {
      id: donoId,
      nome: nomeCurto(l.nome_curto) ?? "Proprietário",
      fotoUrl,
      desde: l.desde,
      cidade: l.cidade,
      bio: l.bio,
      idiomas: l.idiomas ?? [],
      imoveisAtivos: l.imoveis_ativos ?? 0,
      estadiasConcluidas: l.estadias_concluidas ?? 0,
      resposta: metricaResposta(l.conversas ?? 0, l.conversas_respondidas ?? 0, l.resposta_media_min),
      reputacao,
      selos: selosReais({ emailConfirmado: l.email_confirmado }),
    };
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

/** Avaliações PUBLICADAS recebidas por quem anuncia, com a resposta pública dele. */
export async function getAvaliacoesRecebidas(donoId: string): Promise<AvaliacaoRecebida[]> {
  const admin = createAdminClient();
  if (!admin || !UUID_RE.test(donoId)) return [];
  try {
    const { data } = await admin
      .from("avaliacoes")
      .select("id, nota_geral, comentario_publico, publicada_em")
      .eq("alvo_id", donoId)
      .eq("status", "publicada")
      .order("publicada_em", { ascending: false })
      .limit(20);
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
  } catch {
    return [];
  }
}
