import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signAvatarPath } from "@/lib/data/avatar-url";
import { nomeCurto } from "@/lib/perfil/perfil-publico";
import type { AvaliacaoRecebida } from "@/lib/conta/avaliacoes-recebidas";

export type AvaliacaoRecebidaComRevisao = AvaliacaoRecebida & { contestacaoAberta: boolean };

/**
 * PERFIL-B (mockup perfil-02-avaliacoes): as avaliações PUBLICADAS sobre a pessoa logada, com quem avaliou (nome curto
 * e foto), o imóvel e a cidade, a resposta já dada e o pedido de revisão em aberto. As avaliações e respostas vêm pela
 * SESSÃO (RLS: publicadas são legíveis; contestação só do avaliado). O nome e a foto de quem avaliou vêm pelo cliente
 * de serviço, como no perfil público: só o nome curto e a foto do caminho canônico — houve estadia entre os dois.
 */
export async function avaliacoesRecebidas(): Promise<{ userId: string; avaliacoes: AvaliacaoRecebidaComRevisao[] } | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("avaliacoes")
    .select("id, autor_id, papel_autor, imovel_id, nota_geral, comentario_publico, publicada_em")
    .eq("alvo_id", user.id)
    .eq("status", "publicada")
    .order("publicada_em", { ascending: false });
  type Linha = { id: string; autor_id: string; papel_autor: string; imovel_id: string | null; nota_geral: number; comentario_publico: string | null; publicada_em: string | null };
  const linhas = (data ?? []) as Linha[];
  if (linhas.length === 0) return { userId: user.id, avaliacoes: [] };

  const ids = linhas.map((l) => l.id);
  const autores = [...new Set(linhas.map((l) => l.autor_id))];
  const imoveis = [...new Set(linhas.map((l) => l.imovel_id).filter((x): x is string => !!x))];
  const admin = createAdminClient();

  const [{ data: resp }, { data: cont }, perfis, casas] = await Promise.all([
    supabase.from("avaliacao_respostas").select("avaliacao_id, texto").in("avaliacao_id", ids),
    supabase.from("avaliacao_contestacoes").select("avaliacao_id").in("avaliacao_id", ids).eq("status", "aberta"),
    admin ? admin.from("profiles").select("id, full_name, avatar_url").in("id", autores) : Promise.resolve({ data: [] }),
    imoveis.length ? supabase.from("properties").select("id, title, city").in("id", imoveis) : Promise.resolve({ data: [] }),
  ]);
  const respostas = new Map(((resp ?? []) as { avaliacao_id: string; texto: string }[]).map((r) => [r.avaliacao_id, r.texto]));
  const abertas = new Set(((cont ?? []) as { avaliacao_id: string }[]).map((c) => c.avaliacao_id));
  const perfilPorId = new Map(((perfis.data ?? []) as { id: string; full_name: string | null; avatar_url: string | null }[]).map((p) => [p.id, p]));
  const casaPorId = new Map(((casas.data ?? []) as { id: string; title: string | null; city: string | null }[]).map((c) => [c.id, c]));
  const fotos = new Map(await Promise.all(autores.map(async (id) => [id, await signAvatarPath(perfilPorId.get(id)?.avatar_url, id)] as const)));

  return {
    userId: user.id,
    avaliacoes: linhas.map((l) => {
      const papelAutor = l.papel_autor === "proprietario" ? "proprietario" : "inquilino";
      const casa = l.imovel_id ? casaPorId.get(l.imovel_id) : undefined;
      return {
        id: l.id,
        autorNome: nomeCurto(perfilPorId.get(l.autor_id)?.full_name) ?? (papelAutor === "proprietario" ? "Proprietário" : "Morador"),
        autorFotoUrl: fotos.get(l.autor_id) ?? null,
        papelAutor,
        nota: Number(l.nota_geral),
        comentario: l.comentario_publico ?? "",
        publicadaEm: l.publicada_em,
        imovelTitulo: casa?.title?.trim() || null,
        cidade: casa?.city?.trim() || null,
        resposta: respostas.get(l.id) ?? null,
        contestacaoAberta: abertas.has(l.id),
      };
    }),
  };
}
