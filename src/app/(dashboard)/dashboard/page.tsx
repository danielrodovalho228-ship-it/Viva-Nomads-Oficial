import { listMyProperties } from "@/lib/data/properties";
import { createClient } from "@/lib/supabase/server";
import { contarInteressados } from "@/lib/painel/kpi-interessados";
import { listarPropostas } from "@/lib/data/propostas-actions";
import { estadiasDaHome } from "@/lib/data/estadia";
import { getLatestDraft } from "@/lib/data/actions";
import { dadosDasDecisoes } from "@/lib/data/painel-decisoes";
import { decisoesDoMorador, decisoesDoProprietario, type EstadiaParaDecisao } from "@/lib/painel/decisoes";
import { checklistAnuncio } from "@/lib/anuncio/prontidao";
import { fatosDaConta } from "@/lib/data/ativacao";
import { checklistsDoInicio } from "@/lib/onboarding/ativacao";
import { VisaoGeral, type RascunhoPendente } from "./visao-geral-client";

/**
 * Datas das candidaturas recebidas nos últimos 60 dias (30 atuais + 30 de
 * comparação). RLS: o dono só lê os próprios leads; sem sessão/erro → zero.
 */
async function interessadosDoDono(): Promise<{ atual: number; anterior: number }> {
  const supabase = await createClient();
  if (!supabase) return { atual: 0, anterior: 0 };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { atual: 0, anterior: 0 };
  const desde = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("leads")
    .select("created_at")
    .eq("owner_id", user.id)
    .gte("created_at", desde);
  return contarInteressados((data ?? []).map((l: { created_at: string | null }) => l.created_at));
}

/** Cidade do perfil público (Prompt 31a: a seção "Serviços" abre a busca de parceiros já com ela). */
async function cidadeDoPerfil(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("cidade").eq("id", user.id).maybeSingle();
  return ((data?.cidade as string | null) ?? "").trim() || null;
}

/** Rascunho mais recente → card "Anúncio em andamento" (antes lido no navegador por server action). */
function rascunhoDoDraft(d: Awaited<ReturnType<typeof getLatestDraft>>): RascunhoPendente | null {
  if (!d) return null;
  // Prontidão da fonte única (a mesma de Meus imóveis e do Publicar).
  return {
    id: d.id,
    pct: d.prontidao?.pct ?? 0,
    pronto: !!d.prontidao?.podePublicar,
    faltam: d.prontidao?.faltam ?? [],
    checklist: d.prontidao ? checklistAnuncio(d.prontidao, d.id) : null,
    score: d.score,
  };
}

/**
 * Visão geral. Os imóveis do proprietário vêm do SERVIDOR pela MESMA consulta
 * de "Meus imóveis" (listMyProperties) — sem o vazio enquanto o navegador
 * buscava a lista, que fazia a tela dizer "ainda não publicou" com imóvel
 * ativo (F31).
 *
 * Prompt 42, item 1: a tela abre com "Hoje você tem N decisões". Os dados vêm de uma leitura só, em paralelo; as
 * regras são as de lib/painel/decisoes.ts (puras, testadas).
 */
export default async function DashboardPage() {
  const agora = new Date();
  const [imoveisDono, cidadePerfil, interessados, propostas, estadias, draft, dados] = await Promise.all([
    listMyProperties(),
    cidadeDoPerfil(),
    interessadosDoDono(),
    listarPropostas().catch(() => []),
    // Prompt 32: estadias em vigor (topo, decisões e ações da folha do 41).
    estadiasDaHome(agora).catch(() => []),
    getLatestDraft().catch(() => null),
    dadosDasDecisoes(),
  ]);
  const rascunho = rascunhoDoDraft(draft);
  // Prompt 43: checklist de ativação de cada papel até a ativação (some sozinho).
  const fatos = await fatosDaConta(draft).catch(() => null);
  const checklists = fatos ? checklistsDoInicio(fatos) : [];
  const estadiasDe = (papel: "proprietario" | "inquilino"): EstadiaParaDecisao[] =>
    estadias.filter((e) => e.papel === papel).map((e) => ({ contratoId: e.contratoId, imovel: e.imovel, decisoes: e.decisoes }));

  const decisoesDono = decisoesDoProprietario(
    {
      propostas,
      contratos: dados.contratosDono,
      visitas: dados.visitasDono,
      manutencoes: dados.manutencoes,
      estadias: estadiasDe("proprietario"),
      candidaturas: dados.candidaturas,
      confortoPrazos: dados.confortoPrazos,
      pendenciasDono: dados.pendenciasDono,
      fotosNivelRecusadas: dados.fotosNivelRecusadas,
      quedasNivel: dados.quedasNivel,
      rascunho: draft ? { id: draft.id, titulo: draft.title, prontidao: draft.prontidao } : null,
    },
    agora,
  );
  const decisoesMorador = decisoesDoMorador(
    { propostas, contratos: dados.contratosMorador, visitas: dados.visitasMorador, estadias: estadiasDe("inquilino"), pendenciasMorador: dados.pendenciasMorador },
    agora,
  );

  return (
    <VisaoGeral
      imoveisDono={imoveisDono}
      interessados={interessados}
      decisoesDono={decisoesDono}
      decisoesMorador={decisoesMorador}
      rascunho={rascunho}
      cidadePerfil={cidadePerfil}
      estadias={estadias}
      checklists={checklists}
    />
  );
}
