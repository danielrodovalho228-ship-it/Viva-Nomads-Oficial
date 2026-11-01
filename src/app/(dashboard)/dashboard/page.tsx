import { listMyProperties } from "@/lib/data/properties";
import { createClient } from "@/lib/supabase/server";
import { contarInteressados } from "@/lib/painel/kpi-interessados";
import { listarPropostas } from "@/lib/data/propostas-actions";
import { listMinhasCandidaturas } from "@/lib/data/leads-actions";
import { estadiasDaHome } from "@/lib/data/estadia";
import { getLatestDraft } from "@/lib/data/actions";
import { dadosDasDecisoes } from "@/lib/data/painel-decisoes";
import { decisoesDoMorador, decisoesDoProprietario, type EstadiaParaDecisao } from "@/lib/painel/decisoes";
import { checklistAnuncio } from "@/lib/anuncio/prontidao";
import { fatosDaConta } from "@/lib/data/ativacao";
import { checklistsDoInicio } from "@/lib/onboarding/ativacao";
import { ativacoesDaSessao } from "@/lib/data/ativacao";
import { VisaoGeral, type RascunhoPendente } from "./visao-geral-client";
import { ContaPausada } from "@/components/account/sair-da-viva";
import { AvisoStrikePainel } from "@/components/vistoria/aviso-strike-painel";
import { visualizacoesDoDono } from "@/lib/data/desempenho-anuncio";
import { listConversations } from "@/lib/data/messages";
import { alertaDoTopo, blocoPrincipalDono } from "@/lib/painel/inicio-dono";
import { capaDoDraftData } from "@/lib/fotos-anuncio";
import { carregarAgendaDoDono } from "@/lib/data/agenda-servidor";
import { cartoesDeHoje } from "@/lib/painel/hoje-dono";
import { hojeEmBrasilia } from "@/lib/checkin";
import { listarBuscasSalvas } from "@/lib/data/buscas-salvas-actions";
import { avisoInicioSemLeitura, type FonteDoInicio } from "@/lib/painel/sem-leitura";

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

/** Prompt 51 F1: a conta está pausada? (a pessoa lê o próprio perfil). */
async function contaPausadaEm(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("pausada_em").eq("id", user.id).maybeSingle();
  return (data?.pausada_em as string | null) ?? null;
}

/**
 * PROP-6: a capa do rascunho (1ª foto, a capa do cadastro); sem foto, null (nenhuma imagem inventada).
 * E308 (devolução da noite de 01/11): as fotos do rascunho vivem no `draft_data` e só são copiadas para
 * `property_photos` por uma sincronização "best-effort" — rascunho antigo ou sincronização que falhou ficava sem linha
 * ali, e o "Continue seu anúncio" saía sem foto mesmo com fotos no rascunho. Sem linha em `property_photos`, vale a 1ª
 * foto do `draft_data` (só do bucket na pasta do próprio dono — `fotosDoDono`).
 */
async function capaDoRascunho(id: string | null, draftData: unknown): Promise<string | null> {
  if (!id) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.from("property_photos").select("url").eq("property_id", id).order("sort_order", { ascending: true }).limit(1).maybeSingle();
  const daTabela = (data?.url as string | undefined) ?? null;
  if (daTabela) return daTabela;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? capaDoDraftData(draftData, user.id) : null;
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
  // Achado nº 24: cada lista lida com `exigir`; a que falha entra em `semLeitura` (aviso no topo, contador "—"), em vez
  // de virar lista vazia ("0 decisões", "0 mensagens") sem aviso.
  const semLeitura: FonteDoInicio[] = [];
  const ou = <T,>(fonte: FonteDoInicio, p: Promise<T>, vazio: T): Promise<T> =>
    p.catch(() => {
      semLeitura.push(fonte);
      return vazio;
    });
  const [imoveisDono, cidadePerfil, interessados, propostas, estadias, draft, dados, candidaturas, visualizacoes, conversas, buscasSalvas] = await Promise.all([
    listMyProperties(),
    cidadeDoPerfil(),
    interessadosDoDono(),
    ou("propostas", listarPropostas({ exigir: true }), []),
    // Prompt 32: estadias em vigor (topo, decisões e ações da folha do 41).
    ou("estadias", estadiasDaHome(agora, { exigir: true }), []),
    getLatestDraft().catch(() => null),
    dadosDasDecisoes(),
    // E72: o cartão "Candidaturas" conta a MESMA lista de /dashboard/candidaturas (um número, uma fonte).
    ou("candidaturas", listMinhasCandidaturas({ exigir: true }), null),
    // PROP-3 (E113): Visualizações e Mensagens da MESMA função das páginas de destino (Desempenho e Mensagens).
    visualizacoesDoDono(agora).catch(() => null),
    ou("conversas", listConversations({ exigir: true }), null),
    // E181: "Buscas salvas" conta a MESMA lista de /dashboard/buscas (um número, uma fonte).
    ou("buscas", listarBuscasSalvas({ exigir: true }), null),
  ]);
  const [pausadaEm, capaRascunho] = await Promise.all([contaPausadaEm(), capaDoRascunho(draft?.id ?? null, draft?.data ?? null)]);
  const rascunho = rascunhoDoDraft(draft);
  // Prompt 43: checklist de ativação de cada papel até a ativação (some sozinho).
  const fatos = await fatosDaConta(draft).catch(() => null);
  // Prompt 50: o checklist some na ativação do papel (data gravada em ativacoes; o que já aconteceu e falta gravar,
  // grava agora — rede de segurança dos pontos de gravação).
  const ativados = fatos ? await ativacoesDaSessao(fatos).catch(() => ({})) : {};
  const checklists = fatos ? checklistsDoInicio(fatos, ativados) : [];
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

  // PROP-6: o Início do dono (modo dono) — faixa com a pendência mais urgente e o bloco principal, das mesmas regras.
  const capaAnuncio = imoveisDono.find((i) => i.photos?.[0])?.photos[0] ?? null;
  // E190 (parte 2): quem entra e quem sai HOJE (a mesma leitura da Agenda), só para quem tem imóvel.
  const agendaHoje = imoveisDono.length ? await carregarAgendaDoDono().catch(() => null) : null;
  const hoje = agendaHoje ? cartoesDeHoje(agendaHoje.itens, hojeEmBrasilia(agora), agendaHoje.horarios) : [];
  const inicioDono = {
    alerta: alertaDoTopo(decisoesDono),
    bloco: blocoPrincipalDono({
      rascunho: rascunho ? { id: rascunho.id, pct: rascunho.pct, pronto: rascunho.pronto, itens: rascunho.checklist?.itens ?? [], foto: capaRascunho } : null,
      decisoes: decisoesDono,
      temAnuncio: imoveisDono.length > 0,
      fotoAnuncio: capaAnuncio,
      // E218-A: o guia de ativação do dono (some na ativação, como sempre) — fonte única dos passos do bloco.
      checklist: checklists.find((c) => c.papel === "proprietario") ?? null,
    }),
    hoje,
  };

  return (
    <>
      {/* Prompt 51 F1: conta pausada → "Reativar minha conta" em um toque, no topo do painel. */}
      {pausadaEm && (
        <div className="mb-4">
          <ContaPausada />
        </div>
      )}
      {/* Prompt 62-A, Parte 2: 3º passo da escada → os anúncios fora da busca, no topo do painel. */}
      {imoveisDono.length > 0 && <AvisoStrikePainel />}
      {avisoInicioSemLeitura(semLeitura) && (
        <p role="alert" data-testid="inicio-sem-leitura" className="mb-4 rounded-xl border border-line bg-white px-4 py-3 text-sm text-amber-800">
          {avisoInicioSemLeitura(semLeitura)}
        </p>
      )}
      <VisaoGeral
      imoveisDono={imoveisDono}
      interessados={interessados}
      decisoesDono={decisoesDono}
      decisoesMorador={decisoesMorador}
      rascunho={rascunho}
      cidadePerfil={cidadePerfil}
      estadias={estadias}
      checklists={checklists}
      totalCandidaturas={candidaturas ? candidaturas.length : null}
      visualizacoes={visualizacoes}
      totalConversas={conversas ? conversas.length : null}
      totalBuscasSalvas={buscasSalvas ? buscasSalvas.length : null}
      inicioDono={inicioDono}
      />
    </>
  );
}
