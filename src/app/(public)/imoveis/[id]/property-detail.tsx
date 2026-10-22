"use client";

import { FRASE_CONVERSA_CHAT } from "@/config/conversa-chat";
import { ETAPAS_CANDIDATURA, TERMOS_CANDIDATURA, LIMITE_APRESENTACAO, etapaAnterior, proximaEtapa, progressoEtapa, validarApresentacao, type EtapaCandidatura } from "@/lib/candidatura-etapas";
import { AvisoPetCandidatura } from "@/components/property/aviso-pet-candidatura";
import { ProblemaComIsto } from "@/components/ajuda/problema-com-isto";
import { numBR, hojeBR } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  MapPin,
  Star,
  Check,
  CheckCircle2,
  FileSignature,
  MessageSquare,
  MessageCircle,
  ShieldCheck,
  ArrowRight,
  CalendarDays,
  Clock,
  Handshake,
  Hash,
} from "lucide-react";
import type { Property } from "@/lib/types";
import { Button, buttonClasses, marcaCta } from "@/components/ui/button";
import { ShareButton } from "@/components/share-button";
import { VisitaPresencial, VisitaVideo } from "@/components/property/visita-video";
import { useAuthStore } from "@/lib/store";
import { alvoAbrir, urlLoginParaAbrir, type AlvoAbrir } from "@/lib/imovel/abrir-apos-login";
import { IdealPara } from "@/components/property/ideal-para";
import { PropertyTags, InvoiceBadge, InsuranceBadge, PrecoJustoBadge } from "@/components/ui/badge";
import { SELO_NF_UI } from "@/lib/flags";
import { ImoveisParecidos } from "@/components/property/imoveis-parecidos";
import { PropertyGallery } from "@/components/property-gallery";
import { VideoWalkthrough } from "@/components/video-walkthrough";
import { requestLead } from "@/lib/data/actions";
import { getMeusDados } from "@/lib/data/perfil-actions";
import { MOTIVOS, isMotivo } from "@/lib/pedidos/pedidos";
import { marcarVisto } from "@/lib/marcas/actions";
import { useMarcasStore } from "@/lib/marcas/store";
import { CHAVE_ULTIMA_BUSCA, ultimaBuscaParaPedido } from "@/lib/marcas/regra";
import type { LeadKind } from "@/lib/leads";
import { PriceCard } from "@/components/property/price-card";
import { AvisoAntigolpe } from "@/components/seguranca/aviso-antigolpe";
import { BarraFixaCelular } from "@/components/property/barra-fixa-celular";
import { barraFixaImovel } from "@/lib/barra-fixa-imovel";
import { calcularTotalMensal } from "@/lib/precos";
import { quartosTexto, banheirosTexto } from "@/lib/anuncio/plural";
import { mesesDoCartao } from "@/lib/cartao-preco";
import { FavoriteButton } from "@/components/favorite-button";
import { AmenitiesGrid } from "@/components/property/amenities-grid";
import { WorkspaceSection } from "@/components/property/workspace-section";
import { LocationNearby } from "@/components/property/location-nearby";
import { GoogleProximities } from "@/components/property/google-proximities";
import { StayRules } from "@/components/property/stay-rules";
import { DestaquesImovel } from "@/components/property/destaques-imovel";
import { SobreImovel } from "@/components/property/sobre-imovel";
import { BomSaber } from "@/components/property/bom-saber";
import { AvailabilityCalendar } from "@/components/property/availability-calendar";
import { PrivacidadeAcesso } from "@/components/property/privacidade-acesso";
import { OwnerCard } from "@/components/property/owner-card";
import type { PerfilProprietario } from "@/lib/data/perfil-proprietario";
import { Reviews } from "@/components/property/reviews";
import { CampoData } from "@/components/ui/campo-data";
import { AvaliacoesExemplo } from "@/components/property/avaliacoes-exemplo";
import { FaixaProprietario } from "@/components/property/faixa-proprietario";
import { avaliacoesDoExemplo, proprietarioDoExemplo, resumoAvaliacoesExemplo } from "@/config/exemplo-proprietarios";
import { isExemplo, EXEMPLO_SEM_CONTATO, EXEMPLO_AVISO_DEMO } from "@/lib/demo-listing";
import { destinoContatoViva, resumoSolicitacao } from "@/lib/reserva-imovel";
import { registrarEvento } from "@/lib/eventos/registrar";
import { NavSecoes } from "@/components/property/nav-secoes";
import { secoesDoImovel, sinaisDeConfianca, type SinalConfianca } from "@/lib/imovel-pagina";
import { videoTourPermitido } from "@/lib/video-tour";

export function PropertyDetail({
  property: anuncio,
  similar,
  proprietario = null,
}: {
  property: Property;
  similar: Property[];
  proprietario?: PerfilProprietario | null;
}) {
  // Anúncio de EXEMPLO: sem nota, avaliações, selos do dono, taxa de resposta,
  // "Aceita Seguro-Fiança" (em estruturação) nem dados do Google — nada disso
  // existe de verdade para um anúncio ilustrativo.
  const property = isExemplo(anuncio) ? semSinaisInventados(anuncio) : anuncio;
  const router = useRouter();
  const [pending, setPending] = useState<LeadKind | null>(null);
  const [sent, setSent] = useState<{ duvida?: boolean; visita?: boolean }>({});
  const [selfNote, setSelfNote] = useState(false);
  const [leadErro, setLeadErro] = useState<string | null>(null);
  const [candidatouSe, setCandidatouSe] = useState(false);
  // F37: quando a pessoa quer entrar (opcional); o Fechamento do dono abre com essa data.
  const [inicioDesejado, setInicioDesejado] = useState("");
  // Motivo da estadia (lista única MOTIVOS): vem do perfil, editável; o servidor revalida.
  const [motivoEstadia, setMotivoEstadia] = useState("");
  // Prompt 8: quantas pessoas vão morar (vai na candidatura; o servidor confere com a capacidade).
  const [pessoas, setPessoas] = useState(1);
  // Composer de dúvida: o inquilino escreve a mensagem de verdade. A visita presencial (prompt 23) tem o próprio pedido,
  // com até 3 horários em horário de Brasília, como a visita por vídeo.
  const [composeKind, setComposeKind] = useState<"duvida" | null>(null);
  const [composeText, setComposeText] = useState("");
  // QA do Muse (18/10): sem login, "Agendar visita" e "Visita por vídeo" levam ao login e voltam com a janela aberta.
  const usuario = useAuthStore((s) => s.user);
  const authChecked = useAuthStore((s) => s.authChecked);
  const semLogin = authChecked && !usuario && !isExemplo(property);
  const [abrirVideo, setAbrirVideo] = useState(false);
  const [abrirPresencial, setAbrirPresencial] = useState(false);
  // "Agendar visita" do rodapé fixo do celular: abre a mesma janela do cartão (cada toque soma 1).
  const [sinalVisita, setSinalVisita] = useState(0);
  const irParaLogin = (alvo: AlvoAbrir) => router.push(urlLoginParaAbrir(property.id, alvo));
  useEffect(() => {
    const alvo = alvoAbrir(window.location.search);
    if (!alvo) return;
    const t = setTimeout(() => {
      if (alvo === "visita") setAbrirPresencial(true);
      else setAbrirVideo(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  // Passo de confirmação do "Enviar candidatura": resumo + (exemplo) aviso de demonstração.
  const [solicitacaoAberta, setSolicitacaoAberta] = useState(false);
  const [solicitacaoErro, setSolicitacaoErro] = useState<string | null>(null);
  // Candidatura em etapas (ordem eb4b11d8): revisar → mensagem → confirmar → confirmação.
  const [etapa, setEtapa] = useState<EtapaCandidatura>("revisar");
  const [apresentacao, setApresentacao] = useState("");

  // Avaliações — FONTE ÚNICA (A2): usa o array real de reviews, igual à seção de
  // avaliações. `rating` só é usado como média quando há review real.
  const exemplo = isExemplo(property);
  const reviewsReais = property.reviews?.length ?? 0;
  // Exemplo ilustrativo (prompt 9): dados de demonstração, só em anúncio de exemplo e sempre marcados.
  const donoExemplo = exemplo ? proprietarioDoExemplo(property.id) : null;
  const avaliacoesExemplo = exemplo ? avaliacoesDoExemplo(property.id) : [];
  const resumoExemplo = exemplo ? resumoAvaliacoesExemplo(property.id) : null;
  const temFaixa = !!donoExemplo || !!proprietario;
  const mediaReal =
    reviewsReais > 0
      ? property.rating > 0
        ? property.rating
        : property.reviews!.reduce((s, r) => s + r.rating, 0) / reviewsReais
      : 0;

  // Dúvida / visita / candidatura: registra o interesse e avisa o proprietário
  // (pela plataforma). Candidatura segue para o fluxo de fechamento.
  // Evento anônimo de uso (0067): uma visualização por abertura do anúncio.
  useEffect(() => {
    if (!isExemplo(property)) registrarEvento("ver_anuncio", { imovelId: property.id, cidade: property.city });
  }, [property]);

  // Marca "Visto" (ordem 8302024d): só logado grava; deslogado/exemplo ignoram em silêncio.
  const marcarVistoLocal = useMarcasStore((s) => s.marcarVistoLocal);
  useEffect(() => {
    if (isExemplo(property)) return;
    void marcarVisto(property.id).then((r) => {
      if (r.ok) marcarVistoLocal(property.id);
    });
  }, [property, marcarVistoLocal]);

  // Pedido pré-preenchido: data de entrada da última busca (editável; vencida ou estranha é descartada).
  // Prompt 41: a duração da busca também dá o total do rodapé e do cartão ("R$ Y em N meses").
  const [mesesBusca, setMesesBusca] = useState(0);
  useEffect(() => {
    try {
      const { inicio, meses } = ultimaBuscaParaPedido(window.localStorage.getItem(CHAVE_ULTIMA_BUSCA), hojeBR());
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o localStorage só no navegador (SSR não tem)
      if (inicio) setInicioDesejado((atual) => atual || inicio);
      if (meses) setMesesBusca(meses);
    } catch {
      /* localStorage bloqueado: segue sem pré-preencher */
    }
  }, []);

  // Candidatura pré-preenchida com o motivo do perfil (deslogado: sem sessão, fica vazio).
  useEffect(() => {
    if (isExemplo(property)) return;
    let vivo = true;
    void getMeusDados()
      .then((d) => {
        if (vivo && d && isMotivo(d.motivoEstadia)) setMotivoEstadia((atual) => atual || d.motivoEstadia);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [property]);

  async function handleLead(kind: LeadKind, note?: string) {
    // DEMONSTRAÇÃO (anúncio de exemplo): abre o mesmo fluxo, mas não chama o servidor nem grava nada.
    if (exemplo) {
      setLeadErro(EXEMPLO_AVISO_DEMO);
      return false;
    }
    if (kind === "candidatura") registrarEvento("iniciar_candidatura", { imovelId: property.id, cidade: property.city });
    setPending(kind);
    setLeadErro(null);
    const r = await requestLead(property.id, property.title, kind, note, kind === "candidatura" && inicioDesejado ? inicioDesejado : undefined, kind === "candidatura" ? motivoEstadia : undefined, kind === "candidatura" ? pessoas : undefined).catch(() => null);
    setPending(null);
    if (r?.needsAuth) {
      // Sem sessão: leva ao login e volta para este anúncio depois de entrar (a visita volta com a janela aberta).
      router.push(kind === "visita" ? urlLoginParaAbrir(property.id, "visita") : `/auth?redirect=/imoveis/${property.id}`);
      return false;
    }
    if (r?.selfOwned) {
      setSelfNote(true);
      return false;
    }
    if (r?.exemplo) {
      setLeadErro(EXEMPLO_SEM_CONTATO);
      return false;
    }
    // Falha real (rede/servidor): NUNCA deixa o botão "morto" — mostra o erro.
    if (!r || !r.ok) {
      setLeadErro("Não foi possível enviar agora. Verifique a conexão e tente novamente.");
      return false;
    }
    if (kind === "candidatura") {
      // Candidatura NÃO é fechamento (este nasce quando o PROPRIETÁRIO aceita):
      // confirma o envio e aponta o acompanhamento em Mensagens.
      setCandidatouSe(true);
      registrarEvento("enviar_candidatura", { imovelId: property.id, cidade: property.city });
      return true;
    }
    setSent((s) => ({ ...s, [kind]: true }));
    return true;
  }

  // "Enviar candidatura" nunca fica mudo: valida o que foi preenchido e abre o passo de confirmação.
  const resumo = resumoSolicitacao({ monthlyPrice: property.monthlyPrice, inicioDesejado, motivoEstadia, hoje: hojeBR(), limpezaEstadia: property.limpezaEstadia, totalMensal: calcularTotalMensal(property).total });
  function abrirSolicitacao() {
    setLeadErro(null);
    setSolicitacaoErro(resumo.erro);
    setEtapa("revisar");
    setSolicitacaoAberta(true);
  }
  async function enviarSolicitacao() {
    if (resumo.erro) return;
    const msg = validarApresentacao(apresentacao);
    if (!msg.ok) {
      setSolicitacaoErro(msg.erro);
      setEtapa("mensagem");
      return;
    }
    // A confirmação aparece na própria janela (candidatouSe); o servidor mascara contato de novo.
    await handleLead("candidatura", msg.texto || undefined);
  }

  const citySlug = property.city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-");

  // Confirmação da candidatura (não é fechamento): o proprietário recebeu o
  // perfil; o acompanhamento segue em Mensagens. Nudge de verificação — nunca
  // bloqueio (candidatar sem selo é permitido; o dono vê "verificação pendente").
  const confirmacaoCandidatura = (
    <div className="flex flex-col gap-3 rounded-xl border border-sage-200 bg-sage-100 p-4 text-center">
      <CheckCircle2 className="mx-auto h-8 w-8 text-forest" />
      <div>
        <p className="font-title font-semibold text-ink">Candidatura enviada</p>
        <p className="mt-1 text-sm text-muted">
          O proprietário recebeu seu perfil. O acompanhamento segue em Mensagens — se ele aceitar,
          vocês conversam e partem para o fechamento.
        </p>
      </div>
      <Link
        href="/dashboard/mensagens"
        className={buttonClasses({ size: "sm" })}
      >
        <MessageSquare className="h-4 w-4" /> Acompanhar em Mensagens
      </Link>
      <Link
        href="/dashboard/verificacao?como=inquilino"
        className="flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-3 text-left text-xs text-blue-800 transition-colors hover:bg-blue-100"
      >
        <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-blue-600" />
        <span>
          <strong>Complete seu perfil</strong> — ajuda o proprietário a decidir. <ArrowRight className="inline h-3 w-3" />
        </span>
      </Link>
    </div>
  );

  // WhatsApp: SEMPRE o da Viva (com o código do imóvel) — o contato do dono fica mascarado até o aceite.
  const contatoViva = destinoContatoViva(property.id);

  // Bloco de ações reutilizado dentro do card de preço.
  const actions = candidatouSe ? (
    confirmacaoCandidatura
  ) : (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-ink">
        Quando quer entrar? (opcional)
        <CampoData
          data-testid="candidatura-inicio"
          min={hojeBR()}
          value={inicioDesejado}
          onChange={(e) => setInicioDesejado(e.target.value)}
          className="h-11 rounded-xl border border-line bg-white px-3 text-base text-ink"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-ink">
        Quantas pessoas vão morar?
        <select
          data-testid="candidatura-pessoas"
          value={pessoas}
          onChange={(e) => setPessoas(Number(e.target.value))}
          className="h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink"
        >
          {Array.from({ length: Math.max(1, Math.min(20, property.maxGuests ?? 10)) }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n === 1 ? "1 pessoa" : `${n} pessoas`}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-ink">
        Motivo da estadia (opcional)
        <select
          data-testid="candidatura-motivo"
          value={motivoEstadia}
          onChange={(e) => setMotivoEstadia(e.target.value)}
          className="h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink"
        >
          <option value="">Prefiro não informar</option>
          {MOTIVOS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      {exemplo && (
        <p data-testid="aviso-demo" className="rounded-lg bg-sage-100 px-3 py-2 text-center text-xs font-medium text-forest">
          {EXEMPLO_AVISO_DEMO}
        </p>
      )}
      {/* UM primário por tela (Prompt 41): "Solicitar" é a candidatura de sempre (só o rótulo mudou). No celular e
          no tablet (< lg) ele mora no rodapé fixo; aqui aparece só no computador. */}
      <Button
        variant="primary"
        size="lg"
        className="hidden w-full lg:inline-flex"
        onClick={abrirSolicitacao}
        disabled={pending !== null}
        data-testid="cartao-solicitar"
      >
        <FileSignature className="h-4 w-4" />
        {pending === "candidatura" ? "Enviando..." : "Solicitar"}
      </Button>
      {/* A visita é opção, nunca trava a solicitação: texto terciário. */}
      <VisitaPresencial
        propertyId={property.id}
        exemplo={exemplo}
        semLogin={semLogin}
        abrirInicial={abrirPresencial}
        abrirSinal={sinalVisita}
        variante="tertiary"
        onEntrar={() => irParaLogin("visita")}
      />
      <VisitaVideo propertyId={property.id} exemplo={exemplo} semLogin={semLogin} abrirInicial={abrirVideo} onEntrar={() => irParaLogin("video")} />
      <Button
        variant="secondary"
        size="md"
        className="w-full"
        onClick={() => {
          setComposeText("");
          setComposeKind("duvida");
        }}
        disabled={pending !== null || sent.duvida}
      >
        {sent.duvida ? (
          <>
            <Check className="h-4 w-4" /> Mensagem enviada
          </>
        ) : (
          <>
            <MessageSquare className="h-4 w-4" />
            {pending === "duvida" ? "Enviando..." : "Enviar mensagem"}
          </>
        )}
      </Button>
      <a
        data-cta={marcaCta("secondary")}
        href={contatoViva.href}
        className={buttonClasses({ variant: "secondary", size: "md", className: "w-full" })}
      >
        <MessageCircle className="h-4 w-4" /> {contatoViva.rotulo}
      </a>
      <p className="text-center text-xs text-muted">
        {FRASE_CONVERSA_CHAT}
      </p>
      <AvisoPetCandidatura petsAllowed={property.petsAllowed} regras={property.petsRegras} exemplo={exemplo} />
      <AvisoAntigolpe />
      {sent.duvida && <p className="text-center text-xs text-sage">Mensagem enviada. O proprietário responde aqui na plataforma.</p>}
      {leadErro && <p className="text-center text-xs text-red-600">{leadErro}</p>}
      {selfNote && (
        <p className="text-center text-xs text-muted">
          Este é o seu anúncio. Os interessados aparecem em{" "}
          <Link href="/dashboard/leads" className="underline">
            Leads
          </Link>
          .
        </p>
      )}
    </div>
  );

  // Modal de composição da dúvida/visita — o inquilino escreve o que quer.
  const composer = composeKind && (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-night/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => setComposeKind(null)}
    >
      <div
        className="w-full max-w-md rounded-t-xl bg-white p-4 sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-title text-lg font-semibold text-ink">
          Tirar uma dúvida
        </h3>
        <p className="mt-1 text-sm text-muted">
          Escreva sua pergunta sobre o imóvel. O proprietário responde pela plataforma.
        </p>
        <textarea
          rows={4}
          autoFocus
          value={composeText}
          onChange={(e) => setComposeText(e.target.value)}
          placeholder="Ex.: O condomínio tem academia? Aceita 2 pessoas?"
          className="mt-3 w-full rounded-xl border border-sage-200 px-4 py-3 text-sm outline-none focus:border-sage"
        />
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-sage" /> Não compartilhe telefone ou e-mail —
          a conversa segue toda pela plataforma.
        </p>
        {leadErro && <p className="mt-2 text-sm text-red-600">{leadErro}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setComposeKind(null)} disabled={pending !== null}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={pending !== null || composeText.trim().length < 3}
            onClick={async () => {
              const ok = await handleLead(composeKind, composeText);
              if (ok) setComposeKind(null);
            }}
          >
            {pending !== null ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </div>
    </div>
  );

  // Candidatura em etapas (modal no celular e no computador): barra de progresso, Revisar → Mensagem → Confirmar.
  const fotoCapa = property.photos?.[0];
  const solicitacao = solicitacaoAberta && (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-night/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="solicitacao-titulo"
      data-testid="solicitacao-passo"
      onClick={() => !candidatouSe && setSolicitacaoAberta(false)}
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-xl bg-white p-4 sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        {candidatouSe ? (
          <div data-testid="candidatura-confirmada" className="flex flex-col gap-3 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-forest" />
            <h3 id="solicitacao-titulo" className="font-title text-lg font-semibold text-ink">Candidatura enviada</h3>
            {fotoCapa && (
              // eslint-disable-next-line @next/next/no-img-element -- miniatura da capa; a foto já está carregada na galeria
              <img src={fotoCapa} alt={property.title} className="mx-auto h-28 w-full rounded-xl object-cover" />
            )}
            <p className="text-sm font-medium text-ink">{property.title}</p>
            <p className="text-sm text-muted">{resumo.linhas.find((l) => l.rotulo === "Entrada")?.rotulo}: {resumo.linhas.find((l) => l.rotulo === "Entrada")?.valor}</p>
            <div className="rounded-lg bg-surface-2 px-3 py-3 text-left text-sm text-muted">
              <p className="font-medium text-ink">O que acontece agora</p>
              <p className="mt-1">O proprietário recebeu seu perfil e responde pela plataforma. Se ele aceitar, vocês conversam e seguem para o fechamento. Você acompanha tudo em Mensagens.</p>
            </div>
            <Link href="/dashboard/mensagens" className={buttonClasses({ size: "sm" })}>
              <MessageSquare className="h-4 w-4" /> Acompanhar em Mensagens
            </Link>
            <Button variant="ghost" size="sm" onClick={() => setSolicitacaoAberta(false)}>Fechar</Button>
          </div>
        ) : (
          <>
            <div className="mb-3" data-testid="candidatura-progresso">
              <div className="flex justify-between text-xs font-medium text-muted">
                {ETAPAS_CANDIDATURA.map((e, i) => (
                  <span key={e.chave} className={e.chave === etapa ? "text-forest" : undefined}>{i + 1}. {e.rotulo}</span>
                ))}
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sage-100" role="progressbar" aria-valuenow={progressoEtapa(etapa)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-forest transition-all" style={{ width: `${progressoEtapa(etapa)}%` }} />
              </div>
            </div>
            <h3 id="solicitacao-titulo" className="font-title text-lg font-semibold text-ink">
              {etapa === "revisar" ? "Revisar solicitação" : etapa === "mensagem" ? "Mensagem ao proprietário" : "Confirmar candidatura"}
            </h3>
            <p className="mt-1 text-sm text-muted">{property.title}</p>
            {etapa === "mensagem" ? (
              <label className="mt-3 flex flex-col gap-1 text-sm font-medium text-ink">
                Apresente-se (opcional): conte o motivo da estadia e quem vai morar.
                <textarea
                  data-testid="candidatura-apresentacao"
                  value={apresentacao}
                  maxLength={LIMITE_APRESENTACAO}
                  rows={5}
                  onChange={(e) => setApresentacao(e.target.value)}
                  className="rounded-xl border border-line bg-white p-3 text-base font-normal text-ink"
                />
                <span className="text-xs font-normal text-muted">Telefone e e-mail não podem ser enviados: a conversa segue pela plataforma e eles são ocultados.</span>
              </label>
            ) : (
              <>
                <dl className="mt-3 space-y-2 rounded-lg bg-surface-2 px-3 py-3 text-sm">
                  {(etapa === "revisar" ? resumo.linhas.slice(0, 3) : resumo.linhas).map((l) => (
                    <div key={l.rotulo} className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted">{l.rotulo}</dt>
                      <dd className="text-right font-medium text-ink">{l.valor}</dd>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">Pessoas</dt>
                    <dd className="text-right font-medium text-ink">{pessoas === 1 ? "1 pessoa" : `${pessoas} pessoas`}</dd>
                  </div>
                </dl>
                {etapa === "revisar" && (
                  <>
                    <button type="button" className="mt-2 text-sm font-medium text-forest underline" onClick={() => setSolicitacaoAberta(false)}>
                      Alterar período, pessoas ou motivo
                    </button>
                    <details className="mt-3 rounded-lg border border-line px-3 py-2 text-sm" data-testid="candidatura-detalhes">
                      <summary className="cursor-pointer font-medium text-ink">Detalhes dos valores</summary>
                      <dl className="mt-2 space-y-2">
                        {resumo.linhas.slice(3).map((l) => (
                          <div key={l.rotulo} className="flex items-baseline justify-between gap-3">
                            <dt className="text-muted">{l.rotulo}</dt>
                            <dd className="text-right text-ink">{l.valor}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  </>
                )}
                {etapa === "confirmar" && apresentacao.trim() && (
                  <p className="mt-3 rounded-lg border border-line px-3 py-2 text-sm text-muted">
                    <span className="font-medium text-ink">Sua mensagem: </span>{apresentacao.trim().slice(0, 200)}
                  </p>
                )}
                {etapa === "confirmar" && <p className="mt-3 text-xs text-muted">{TERMOS_CANDIDATURA} <Link href="/termos" className="underline">Ler os termos</Link></p>}
              </>
            )}
            {exemplo && (
              <p data-testid="solicitacao-demo" className="mt-3 rounded-lg bg-sage-100 px-3 py-2 text-center text-xs font-medium text-forest">
                Demonstração: este anúncio é de exemplo e a solicitação não é enviada.
              </p>
            )}
            {solicitacaoErro && (
              <p role="alert" data-testid="solicitacao-erro" className="mt-3 text-sm text-red-600">
                {solicitacaoErro}
              </p>
            )}
            {!solicitacaoErro && leadErro && !exemplo && <p role="alert" className="mt-3 text-sm text-red-600">{leadErro}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (etapa === "revisar" ? setSolicitacaoAberta(false) : (setSolicitacaoErro(resumo.erro), setEtapa(etapaAnterior(etapa))))}
                disabled={pending !== null}
              >
                {etapa === "revisar" ? (exemplo ? "Entendi" : "Cancelar") : "Voltar"}
              </Button>
              {etapa !== "confirmar" ? (
                <Button variant="primary" size="sm" disabled={!!resumo.erro} onClick={() => setEtapa(proximaEtapa(etapa))}>
                  Continuar
                </Button>
              ) : (
                !exemplo && (
                  <Button variant="primary" size="sm" disabled={pending !== null || !!resumo.erro} onClick={enviarSolicitacao}>
                    {pending === "candidatura" ? "Enviando..." : "Enviar candidatura"}
                  </Button>
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  // Total pela duração escolhida (Prompt 41): a duração da última busca ou, sem busca, a estadia mínima do imóvel.
  const meses = mesesDoCartao(mesesBusca || undefined, property.minPeriodDays);
  // Linha-síntese (Prompt 41): pessoas · quartos · banheiros (as camas entram quando o anúncio tiver o dado).
  const sintese = [
    property.maxGuests != null ? `Até ${property.maxGuests} ${property.maxGuests === 1 ? "pessoa" : "pessoas"}` : null,
    quartosTexto(property.bedrooms),
    banheirosTexto(property.bathrooms),
    property.areaM2 ? `${property.areaM2} m²` : null,
    property.furnished ? "Mobiliado" : null,
    (property.parkingSpots ?? 0) > 0 ? `${property.parkingSpots} ${property.parkingSpots === 1 ? "vaga" : "vagas"}` : null,
  ].filter(Boolean) as string[];
  // Coração e compartilhar são ÍCONES (nunca botão com texto): sobre a foto no celular, ao lado do título no computador.
  const icones = (
    <>
      <FavoriteButton propertyId={property.id} />
      <ShareButton icone title={property.title} text={`${property.title} — Viva Nomads`} />
    </>
  );

  return (
    // Página PÚBLICA com fotos: "largura total" = a medida do container (1536 px, como o Furnished Finder), nunca a
    // tela inteira (ordem 4252e0d6, Daniel 16/10). Celular: a galeria vai de borda a borda (Prompt 41).
    // Ordem do Prompt 41: galeria → título → síntese → anfitrião → ("Onde você vai dormir" só quando as fotos
    // tiverem o cômodo marcado — o dado ainda não existe, então o bloco não aparece) → comodidades → regras →
    // disponibilidade → mapa aproximado → avaliações → proprietário; o rodapé fixo (celular) / cartão lateral
    // (computador) traz o valor e o "Solicitar".
    <div className="mx-auto w-full max-w-[1536px] px-4 py-8 pb-(--folga-rodape-imovel) sm:px-8 lg:pb-8" data-testid="imovel-largura-total">
      {composer}
      {solicitacao}
      <BarraFixaCelular
        key={property.id}
        barra={barraFixaImovel({ monthlyPrice: property.monthlyPrice, totalMensal: calcularTotalMensal(property).total, meses, exemplo, candidatouSe, availableFrom: property.availableFrom })}
        pending={pending !== null}
        onSolicitar={abrirSolicitacao}
        onAgendarVisita={() => (semLogin ? irParaLogin("visita") : setSinalVisita((n) => n + 1))}
      />
      {/* Breadcrumb (navegação + SEO); no celular a galeria abre a tela de borda a borda. */}
      <nav
        aria-label="Trilha de navegação"
        className="mb-4 hidden flex-wrap items-center gap-2 text-sm text-muted md:flex"
      >
        <Link href="/" className="hover:text-forest">Início</Link>
        <span aria-hidden>›</span>
        <Link href="/buscar" className="hover:text-forest">Buscar imóveis</Link>
        <span aria-hidden>›</span>
        <Link href={`/cidades/${citySlug}`} className="hover:text-forest">{property.city}</Link>
        <span aria-hidden>›</span>
        <span className="line-clamp-1 text-ink">{property.title}</span>
      </nav>

      {/* Galeria: tela cheia no celular ("1/12", coração e compartilhar); mosaico de 5 no computador. */}
      <PropertyGallery
        photos={property.photos}
        title={property.title}
        readyToLive={property.readyToLiveBadge}
        videoUrl={property.videoUrl}
        acoes={icones}
      />

      {/* Abas âncora presas ao rolar (ordem d943f893). */}
      <NavSecoes secoes={secoesDoImovel({ avaliacoes: exemplo ? avaliacoesExemplo.length : reviewsReais, temDono: !!(property.owner?.name ?? property.ownerName) })} />

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem] xl:gap-12">
        {/* Conteúdo (seções roláveis) */}
        <div className="min-w-0 space-y-12">
          {/* Visão geral: título, síntese, anfitrião, sinais de confiança, vídeo e descrição. */}
          <div id="visao-geral" className="scroll-mt-36 space-y-12">
          <header>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-muted">
                <MapPin className="h-4 w-4" /> {property.neighborhood}, {property.city} - {property.state}
              </div>
              <span className="flex items-center gap-2">
                {!exemplo && <ProblemaComIsto tipo="anuncio" id={property.id} />}
                <span className="hidden items-center gap-2 md:flex" data-testid="titulo-icones">
                  {icones}
                </span>
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-ink lg:text-[28px]">{property.title}</h1>

            {/* Linha-síntese: pessoas · quartos · banheiros (+ m², mobiliado e vagas). */}
            <p className="mt-2 text-base tabular-nums text-ink" data-testid="imovel-sintese">
              {sintese.join(" · ")}
            </p>

            {/* "Ideal para" (QA do Prompt 40): saiu do cartão e mora aqui, logo depois da linha-síntese; regra em src/lib/ideal-para.ts ("Com pet" em 1º). */}
            <IdealPara property={property} className="mt-2 text-sm" />

            {/* Anfitrião: foto, nome curto e selos (tempo de resposta e calendário em miúdo). */}
            <FaixaProprietario real={exemplo ? null : proprietario} exemplo={donoExemplo} hoje={hojeBR()} />

            {/* Sinais de confiança (só dado real): disponibilidade, resposta, tempo de casa, código. */}
            <ul data-testid="sinais-confianca" className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {sinaisDeConfianca(property, new Date().toISOString().slice(0, 10))
                .filter((s) => !(temFaixa || exemplo) || (s.tipo !== "resposta" && s.tipo !== "desde"))
                .map((s) => (
                <li key={s.tipo} className={s.tipo === "codigo" ? "inline-flex items-center gap-2 text-xs text-muted" : "inline-flex items-center gap-2 text-ink"}>
                  <IconeSinal tipo={s.tipo} />
                  <span className={s.tipo === "disponibilidade" ? "font-semibold text-forest" : undefined}>{s.texto}</span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Anúncio de exemplo (ilustrativo): selo honesto e visível. */}
              {exemplo && (
                <span className="inline-flex items-center rounded-full bg-night px-3 py-1 text-xs font-semibold text-white">
                  Exemplo ilustrativo
                </span>
              )}
              {/* Fonte ÚNICA (A2): a contagem vem das avaliações REAIS (reviews),
                  igual à seção de avaliações. Sem review real → selo honesto. */}
              {resumoExemplo ? (
                <a href="#avaliacoes" data-testid="estrelas-titulo" className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-forest hover:underline">
                  <Star className="h-4 w-4 fill-champagne text-champagne" aria-hidden />
                  {numBR(resumoExemplo.media, 1)} · {resumoExemplo.n} avaliações
                </a>
              ) : reviewsReais > 0 ? (
                <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-forest">
                  <Star className="h-4 w-4 fill-champagne text-champagne" />
                  {numBR(mediaReal, 1)} · {reviewsReais}{" "}
                  {reviewsReais === 1 ? "avaliação" : "avaliações"}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-sage px-3 py-1 text-xs font-semibold text-white">
                  Novo na plataforma
                </span>
              )}
              {SELO_NF_UI && property.issuesInvoice && <InvoiceBadge />}
              {property.acceptsInsurance && <InsuranceBadge />}
              {property.precoJusto && <PrecoJustoBadge />}
            </div>

            <div className="mt-3">
              <PropertyTags property={property} />
            </div>

            <div className="mt-4">
              <DestaquesImovel property={property} />
            </div>
          </header>

          {/* Walk-through em vídeo */}
          {videoTourPermitido(property.videoUrl) && (
            <section>
              <VideoWalkthrough url={property.videoUrl!} title={property.title} />
              <p className="mt-2 text-xs text-muted">
                {isExemplo(property) ? "Vídeo ilustrativo." : "Tour em vídeo gravado pelo proprietário."}
              </p>
            </section>
          )}

          {/* Sobre o imóvel (~5 linhas + "Mostrar mais") */}
          {property.description && <SobreImovel descricao={property.description} />}
          </div>

          {/* Comodidades (grade par, ícone por item) + regras da casa + o que é bom saber. */}
          <div id="comodidades" className="scroll-mt-36 space-y-12">
            <AmenitiesGrid property={property} />
            <WorkspaceSection property={property} />
            <StayRules property={property} />
            <BomSaber property={property} />
            <PrivacidadeAcesso privacidade={property.privacidade} />
          </div>
          <div id="disponibilidade" className="scroll-mt-36">
            <AvailabilityCalendar property={property} />
          </div>
          {/* Mapa aproximado (endereço exato só após o aceite). */}
          <div id="localizacao" className="scroll-mt-36 space-y-12">
            <LocationNearby property={property} />
            <GoogleProximities property={property} />
          </div>
          <div id="avaliacoes" className="scroll-mt-36">
            {avaliacoesExemplo.length > 0 ? <AvaliacoesExemplo avaliacoes={avaliacoesExemplo} /> : <Reviews property={property} />}
          </div>
          <div id="proprietario" className="scroll-mt-36 empty:hidden">
            <OwnerCard
              property={property}
              proprietario={proprietario}
              onMensagem={
                exemplo
                  ? undefined
                  : () => {
                      setComposeText("");
                      setComposeKind("duvida");
                    }
              }
            />
          </div>
        </div>

        {/* Cartão lateral: fixo no computador, empilhado no celular (o primário do celular é o do rodapé fixo). */}
        <aside>
          <PriceCard property={property} actions={actions} meses={meses} />
        </aside>
      </div>

      {/* Imóveis parecidos (Prompt 40): o mesmo cartão da busca, em grade par. */}
      <ImoveisParecidos imoveis={similar} />
    </div>
  );
}

/** Exemplo ilustrativo sem números e selos que não existem de verdade. */
function semSinaisInventados(p: Property): Property {
  return {
    ...p,
    rating: 0,
    reviews: [],
    acceptsInsurance: false,
    googlePlaces: [],
    owner: p.owner ? { name: p.owner.name, avatarUrl: p.owner.avatarUrl } : undefined,
  };
}

/** Ícone de cada sinal de confiança do topo. */
function IconeSinal({ tipo }: { tipo: SinalConfianca["tipo"] }) {
  const Icone = { disponibilidade: CalendarDays, resposta: Clock, desde: Handshake, codigo: Hash }[tipo];
  return <Icone className={tipo === "codigo" ? "h-3.5 w-3.5" : "h-4 w-4 text-sage"} aria-hidden />;
}
