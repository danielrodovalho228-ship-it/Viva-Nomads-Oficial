import { createClient } from "@/lib/supabase/server";
import { getMeusContratos, getMinhasLocacoes } from "@/lib/data/contratos-actions";
import { paraAvaliarDe, type ParaAvaliar } from "@/lib/conta/painel-avaliacoes";

/**
 * E679 — dados do painel Avaliações unificado (abas "Para avaliar" e "Feitas"). Só lê, pela SESSÃO: o autor lê as
 * próprias avaliações (RLS avaliacoes_autor_le) e os contratos em que é parte. Sem migração.
 */
const MSG_FEITAS_NAO_CARREGARAM = "Não foi possível carregar as suas avaliações agora.";

export interface AvaliacaoFeita {
  id: string;
  contratoId: string;
  /** Como a pessoa avaliou: o morador avalia o proprietário e vice-versa. */
  papelAutor: "proprietario" | "inquilino";
  nota: number;
  comentario: string;
  /** enviada = aguardando a outra parte; publicada = já pública; em_moderacao = com a equipe. */
  status: string;
  enviadaEm: string | null;
  imovelTitulo: string | null;
}

export async function avaliacoesFeitas(opcoes: { exigir?: boolean } = {}): Promise<{ userId: string; feitas: AvaliacaoFeita[] } | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("avaliacoes")
    .select("id, contrato_id, papel_autor, imovel_id, nota_geral, comentario_publico, status, enviada_em, criado_em")
    .eq("autor_id", user.id)
    .neq("status", "rascunho")
    .order("criado_em", { ascending: false });
  if (error && opcoes.exigir) throw new Error(MSG_FEITAS_NAO_CARREGARAM);
  type Linha = { id: string; contrato_id: string; papel_autor: string; imovel_id: string | null; nota_geral: number; comentario_publico: string | null; status: string; enviada_em: string | null; criado_em: string };
  const linhas = (data ?? []) as Linha[];
  const imoveis = [...new Set(linhas.map((l) => l.imovel_id).filter((x): x is string => !!x))];
  const { data: casas } = imoveis.length ? await supabase.from("properties").select("id, title").in("id", imoveis) : { data: [] };
  const titulo = new Map(((casas ?? []) as { id: string; title: string | null }[]).map((c) => [c.id, c.title]));
  return {
    userId: user.id,
    feitas: linhas.map((l) => ({
      id: l.id,
      contratoId: l.contrato_id,
      papelAutor: l.papel_autor === "proprietario" ? "proprietario" : "inquilino",
      nota: Number(l.nota_geral),
      comentario: l.comentario_publico ?? "",
      status: l.status,
      enviadaEm: l.enviada_em ?? l.criado_em,
      imovelTitulo: l.imovel_id ? (titulo.get(l.imovel_id) ?? null) : null,
    })),
  };
}

/** As estadias que ainda dá para avaliar (como morador e como dono), já descontadas as que a pessoa avaliou. */
export async function avaliacoesParaFazer(jaAvaliados: ReadonlySet<string>): Promise<ParaAvaliar[]> {
  const [locacoes, contratos] = await Promise.all([getMinhasLocacoes(), getMeusContratos()]);
  return paraAvaliarDe({
    locacoes,
    contratos: contratos.map((c) => ({ id: c.id, propertyTitle: c.propertyTitle, podeAvaliar: c.podeAvaliar, encerradoEm: c.fimParaAvaliacao })),
    jaAvaliados,
  });
}
