import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nomeCurto } from "@/lib/perfil/perfil-publico";
import { podeAvaliarLocacao } from "@/lib/contrato-assinar";
import { periodoDosBlocos } from "@/lib/contrato-blocos";
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

export interface EstadiaParaAvaliar {
  contratoId: string;
  /** Como a pessoa participou: morador (avalia o proprietário) ou dono (avalia o morador). */
  papel: "morador" | "dono";
  alvoId: string;
  titulo: string;
  cidade: string | null;
  inicio: string | null;
  fim: string | null;
  encerradoEm: string | null;
  /** Nome curto da outra parte ("Ricardo M."); nunca o nome inteiro. */
  contraparte: string | null;
  /** A janela está aberta (contrato encerrado, até 14 dias depois). */
  podeAvaliar: boolean;
  /** A pessoa já enviou a avaliação desta estadia (não edita depois de enviar). */
  jaAvaliei: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * E679 (PR 2) — a estadia que a pessoa vai avaliar, para a página "Avalie sua estadia / Avalie o morador". Pela SESSÃO:
 * só aparece para quem é parte do contrato (a RLS de contratos); de outra pessoa ou inexistente → null (a página dá 404).
 * O título e o dono do imóvel vêm do cliente de serviço quando a RLS esconde o imóvel pausado (como em Minhas locações).
 */
export async function estadiaParaAvaliar(contratoId: string): Promise<EstadiaParaAvaliar | null> {
  if (!UUID_RE.test(contratoId)) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: c } = await supabase
    .from("contratos")
    .select("id, tenant_id, property_id, status, encerrado_em, properties(title, city, owner_id), contrato_blocos(inicio, fim)")
    .eq("id", contratoId)
    .maybeSingle();
  if (!c) return null;
  const linha = c as unknown as {
    id: string;
    tenant_id: string;
    property_id: string;
    status: string | null;
    encerrado_em: string | null;
    properties: { title?: string; city?: string; owner_id?: string } | null;
    contrato_blocos: { inicio: string | null; fim: string | null }[] | null;
  };
  const admin = createAdminClient();
  let prop = linha.properties;
  if (!prop?.owner_id && admin) {
    const { data: p } = await admin.from("properties").select("title, city, owner_id").eq("id", linha.property_id).maybeSingle();
    prop = (p as typeof prop) ?? prop;
  }
  const donoId = prop?.owner_id ?? "";
  const papel: "morador" | "dono" | null = user.id === linha.tenant_id ? "morador" : user.id === donoId ? "dono" : null;
  if (!papel) return null;
  const alvoId = papel === "morador" ? donoId : linha.tenant_id;
  const [{ data: perfil }, { data: feita }] = await Promise.all([
    admin && alvoId ? admin.from("profiles").select("full_name").eq("id", alvoId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("avaliacoes").select("id").eq("contrato_id", contratoId).eq("autor_id", user.id).neq("status", "rascunho").limit(1).maybeSingle(),
  ]);
  const per = periodoDosBlocos(linha.contrato_blocos ?? []);
  return {
    contratoId,
    papel,
    alvoId,
    titulo: prop?.title ?? "Imóvel",
    cidade: prop?.city ?? null,
    inicio: per.inicio,
    fim: per.fim,
    encerradoEm: linha.encerrado_em,
    contraparte: nomeCurto((perfil as { full_name?: string | null } | null)?.full_name),
    podeAvaliar: podeAvaliarLocacao(String(linha.status ?? "ativo"), linha.encerrado_em),
    jaAvaliei: !!feita,
  };
}
