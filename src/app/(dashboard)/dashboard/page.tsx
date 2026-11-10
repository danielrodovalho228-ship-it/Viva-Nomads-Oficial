import { listMyProperties } from "@/lib/data/properties";
import { createClient } from "@/lib/supabase/server";
import { contarInteressados } from "@/lib/painel/kpi-interessados";
import { listarPropostas } from "@/lib/data/propostas-actions";
import { listMinhasCandidaturas } from "@/lib/data/leads-actions";
import { estadiasDaHome } from "@/lib/data/estadia";
import { getLatestDraft } from "@/lib/data/actions";
import { dadosDasDecisoes, VAZIO as DECISOES_VAZIAS } from "@/lib/data/painel-decisoes";
import { decisoesDoMorador, decisoesDoProprietario, type EstadiaParaDecisao } from "@/lib/painel/decisoes";
import { checklistAnuncio, hrefRetomarRascunho } from "@/lib/anuncio/prontidao";
import { fatosDaConta } from "@/lib/data/ativacao";
import { checklistsDoInicio } from "@/lib/onboarding/ativacao";
import { ativacoesDaSessao } from "@/lib/data/ativacao";
import { VisaoGeral, type RascunhoPendente } from "./visao-geral-client";
import { ContaPausada } from "@/components/account/sair-da-viva";
import { AvisoStrikePainel } from "@/components/vistoria/aviso-strike-painel";
import { visualizacoesDoDono } from "@/lib/data/desempenho-anuncio";
import { listConversations } from "@/lib/data/messages";
import { alertaDoTopo, blocoPrincipalDono } from "@/lib/painel/inicio-dono";
import { createAdminClient } from "@/lib/supabase/admin";
import { capaDoDraftData, ehUrlDeImagem, soFotosExistentes } from "@/lib/fotos-anuncio";
import { arquivosDoDono } from "@/lib/minimizacao/fotos-anuncio";
import { carregarAgendaDoDono } from "@/lib/data/agenda-servidor";
import { cartoesDeHoje } from "@/lib/painel/hoje-dono";
import { hojeEmBrasilia } from "@/lib/checkin";
import { listarBuscasSalvas } from "@/lib/data/buscas-salvas-actions";
import { avisoInicioSemLeitura, type FonteDoInicio } from "@/lib/painel/sem-leitura";
import { minhaParceria } from "@/lib/parceiros/solicitacao-actions";
import { BOTAO_PARCERIA_APROVADA, HREF_ATIVAR_PARCERIA, TEXTO_PARCERIA_APROVADA, situacaoParceiro } from "@/lib/parceiros/situacao-conta";
import { ButtonLink } from "@/components/ui/button";
import { RodapeInicio } from "@/components/dashboard/rodape-inicio";
import { comLimite, LIMITE_LEITURA_INICIO_MS } from "@/lib/painel/com-limite";

/**
 * Datas das candidaturas recebidas nos últimos 60 dias (30 atuais + 30 de
 * comparação). RLS: o dono só lê os próprios leads; sem sessão/erro → zero.
 */
async function interessadosDoDono(): Promise<{ atual: number; anterior: number }> {
  // Achado nº 24 (rodada 2): a falha de leitura lança — o Início avisa em vez de contar 0 interessados.
  const supabase = await createClient();
  if (!supabase) return { atual: 0, anterior: 0 };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { atual: 0, anterior: 0 };
  const desde = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("leads")
    .select("created_at")
    .eq("owner_id", user.id)
    .gte("created_at", desde);
  if (error) throw new Error("Não foi possível ler os interessados agora.");
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
  // Achado 132: a falha LANÇA (entra no aviso do topo); nunca "conta ativa" por engano.
  const { data, error } = await supabase.from("profiles").select("pausada_em").eq("id", user.id).maybeSingle();
  if (error) throw new Error("Não foi possível ler o estado da conta agora.");
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // E308 (causa raiz, 01/11): a 1ª foto cujo ARQUIVO EXISTE no bucket — antes, uma linha que apontava para um arquivo já
  // apagado virava imagem quebrada. Ordem: property_photos (sort_order) → draft_data; sem nenhuma, o placeholder.
  const [{ data }, existentes] = await Promise.all([
    supabase.from("property_photos").select("url").eq("property_id", id).order("sort_order", { ascending: true }).limit(40),
    arquivosDoDono(createAdminClient(), user.id, { soFotosReais: true }), // E787: a capa não pode ser um quadro de cor única
  ]);
  // E405 (02/11): só URL de imagem vira capa — "Foto QA Premium 1 - Sala" (nome de foto de teste) virava caixa cinza.
  const daTabela = soFotosExistentes(((data ?? []) as { url: string }[]).map((r) => r.url).filter(ehUrlDeImagem), existentes)[0];
  if (daTabela) return daTabela;
  return capaDoDraftData(draftData, user.id, existentes);
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
    comLimite(p, LIMITE_LEITURA_INICIO_MS).catch(() => {
      semLeitura.push(fonte);
      return vazio;
    });
  const [imoveisDono, cidadePerfil, interessados, propostas, estadias, draft, dados, candidaturas, visualizacoes, conversas, buscasSalvas] = await Promise.all([
    ou("imoveis", listMyProperties({ exigir: true }), []),
    comLimite(cidadeDoPerfil(), LIMITE_LEITURA_INICIO_MS).catch(() => null),
    ou("interessados", interessadosDoDono(), { atual: 0, anterior: 0 }),
    ou("propostas", listarPropostas({ exigir: true }), []),
    // Prompt 32: estadias em vigor (topo, decisões e ações da folha do 41).
    ou("estadias", estadiasDaHome(agora, { exigir: true }), []),
    comLimite(getLatestDraft(), LIMITE_LEITURA_INICIO_MS).catch(() => null),
    ou("decisoes", dadosDasDecisoes({ exigir: true }), DECISOES_VAZIAS),
    // E72: o cartão "Candidaturas" conta a MESMA lista de /dashboard/candidaturas (um número, uma fonte).
    ou("candidaturas", listMinhasCandidaturas({ exigir: true }), null),
    // PROP-3 (E113): Visualizações e Mensagens da MESMA função das páginas de destino (Desempenho e Mensagens).
    comLimite(visualizacoesDoDono(agora), LIMITE_LEITURA_INICIO_MS).catch(() => null),
    ou("conversas", listConversations({ exigir: true }), null),
    // E181: "Buscas salvas" conta a MESMA lista de /dashboard/buscas (um número, uma fonte).
    ou("buscas", listarBuscasSalvas({ exigir: true }), null),
  ]);
  // E503: o que depende só do 1º lote sai num 2º lote, junto — antes eram quatro esperas em série (conta pausada e capa,
  // parceria, fatos da conta, agenda), e o esqueleto do painel ficava na tela a soma delas a cada volta ao Início.
  const [[pausadaEm, capaRascunho], parceriaLida, fatos, agendaHoje] = await Promise.all([
    Promise.all([ou("conta", contaPausadaEm(), null), comLimite(capaDoRascunho(draft?.id ?? null, draft?.data ?? null), LIMITE_LEITURA_INICIO_MS).catch(() => null)]),
    // E576: parceria aprovada e página ainda não ativada → aviso no Início com o caminho para ativar.
    comLimite(minhaParceria(), LIMITE_LEITURA_INICIO_MS).catch(() => null),
    // Prompt 43: checklist de ativação de cada papel até a ativação (some sozinho).
    comLimite(fatosDaConta(draft), LIMITE_LEITURA_INICIO_MS).catch(() => null),
    // E190 (parte 2): quem entra e quem sai HOJE (a mesma leitura da Agenda), só para quem tem imóvel.
    imoveisDono.length ? comLimite(carregarAgendaDoDono(), LIMITE_LEITURA_INICIO_MS).catch(() => null) : Promise.resolve(null),
  ]);
  const rascunho = rascunhoDoDraft(draft);
  const parceria = situacaoParceiro(parceriaLida);
  // Prompt 50: o checklist some na ativação do papel (data gravada em ativacoes; o que já aconteceu e falta gravar,
  // grava agora — rede de segurança dos pontos de gravação).
  const ativados = fatos ? await comLimite(ativacoesDaSessao(fatos), LIMITE_LEITURA_INICIO_MS).catch(() => ({})) : {};
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
  const hoje = agendaHoje ? cartoesDeHoje(agendaHoje.itens, hojeEmBrasilia(agora), agendaHoje.horarios) : [];
  const inicioDono = {
    alerta: alertaDoTopo(decisoesDono),
    bloco: blocoPrincipalDono({
      rascunho: rascunho
        ? {
            id: rascunho.id,
            pct: rascunho.pct,
            pronto: rascunho.pronto,
            itens: rascunho.checklist?.itens ?? [],
            foto: capaRascunho,
            // E507: o mesmo destino de retomada de Meus imóveis.
            retomar: hrefRetomarRascunho(draft?.prontidao, rascunho.id),
            // E567: o nome do rascunho junto do "% pronto" — o percentual é DESTE anúncio em andamento.
            nome: draft?.title ?? null,
          }
        : null,
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
      {parceria === "aprovada_sem_pagina" && (
        <section className="mb-4 rounded-xl border border-sage-200 bg-sage-100 px-4 py-3" data-testid="inicio-parceria-aprovada">
          <p className="text-sm text-ink">{TEXTO_PARCERIA_APROVADA}</p>
          <ButtonLink href={HREF_ATIVAR_PARCERIA} size="sm" className="mt-2">
            {BOTAO_PARCERIA_APROVADA}
          </ButtonLink>
        </section>
      )}
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
      {/* E503: o Início fecha com um rodapé curto, em vez de terminar num vão sem nada. */}
      <RodapeInicio />
    </>
  );
}
