"use client";

import { AvisoPetCandidatura } from "@/components/property/aviso-pet-candidatura";
import { ProblemaComIsto } from "@/components/ajuda/problema-com-isto";
import { numBR, hojeBR } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bath,
  BedDouble,
  Ruler,
  Users,
  MapPin,
  Sofa,
  Car,
  Star,
  Check,
  CheckCircle2,
  FileSignature,
  MessageSquare,
  MessageCircle,
  CalendarCheck,
  ShieldCheck,
  ArrowRight,
  CalendarDays,
  Clock,
  Handshake,
  Hash,
} from "lucide-react";
import type { Property } from "@/lib/types";
import { Button, buttonClasses } from "@/components/ui/button";
import { ShareButton } from "@/components/share-button";
import { PropertyTags, InvoiceBadge, InsuranceBadge, PrecoJustoBadge } from "@/components/ui/badge";
import { SELO_NF_UI } from "@/lib/flags";
import { PropertyCard } from "@/components/property-card";
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
import { Reviews } from "@/components/property/reviews";
import { isExemplo, EXEMPLO_SEM_CONTATO, EXEMPLO_AVISO_DEMO } from "@/lib/demo-listing";
import { destinoWhatsappViva, resumoSolicitacao } from "@/lib/reserva-imovel";
import { registrarEvento } from "@/lib/eventos/registrar";
import { NavSecoes } from "@/components/property/nav-secoes";
import { secoesDoImovel, sinaisDeConfianca, type SinalConfianca } from "@/lib/imovel-pagina";

export function PropertyDetail({ property: anuncio, similar }: { property: Property; similar: Property[] }) {
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
  // Composer de dúvida/visita: o inquilino escreve a mensagem de verdade.
  const [composeKind, setComposeKind] = useState<"duvida" | "visita" | null>(null);
  const [composeText, setComposeText] = useState("");
  // Passo de confirmação do "Solicitar reserva": resumo + (exemplo) aviso de demonstração.
  const [solicitacaoAberta, setSolicitacaoAberta] = useState(false);
  const [solicitacaoErro, setSolicitacaoErro] = useState<string | null>(null);

  // Avaliações — FONTE ÚNICA (A2): usa o array real de reviews, igual à seção de
  // avaliações. `rating` só é usado como média quando há review real.
  const exemplo = isExemplo(property);
  const reviewsReais = property.reviews?.length ?? 0;
  const mediaReal =
    reviewsReais > 0
      ? property.rating > 0
        ? property.rating
        : property.reviews!.reduce((s, r) => s + r.rating, 0) / reviewsReais
      : 0;

  // Dúvida / visita / candidatura: registra o interesse e avisa o proprietário
  // (e-mail/WhatsApp). Candidatura segue para o fluxo de fechamento.
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
  useEffect(() => {
    try {
      const { inicio } = ultimaBuscaParaPedido(window.localStorage.getItem(CHAVE_ULTIMA_BUSCA), hojeBR());
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o localStorage só no navegador (SSR não tem)
      if (inicio) setInicioDesejado((atual) => atual || inicio);
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
    const r = await requestLead(property.id, property.title, kind, note, kind === "candidatura" && inicioDesejado ? inicioDesejado : undefined, kind === "candidatura" ? motivoEstadia : undefined).catch(() => null);
    setPending(null);
    if (r?.needsAuth) {
      // Sem sessão: leva ao login e volta para este anúncio depois de entrar.
      router.push(`/auth?redirect=/imoveis/${property.id}`);
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

  // "Solicitar reserva" nunca fica mudo: valida o que foi preenchido e abre o passo de confirmação.
  const resumo = resumoSolicitacao({ monthlyPrice: property.monthlyPrice, inicioDesejado, motivoEstadia, hoje: hojeBR() });
  function abrirSolicitacao() {
    setLeadErro(null);
    setSolicitacaoErro(resumo.erro);
    setSolicitacaoAberta(true);
  }
  async function enviarSolicitacao() {
    if (resumo.erro) return;
    const ok = await handleLead("candidatura");
    if (ok) setSolicitacaoAberta(false);
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
    <div className="flex flex-col gap-3 rounded-2xl border border-sage-200 bg-sage-100 p-4 text-center">
      <CheckCircle2 className="mx-auto h-8 w-8 text-forest" />
      <div>
        <p className="font-title font-bold text-ink">Candidatura enviada</p>
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
        className="flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-left text-xs text-blue-800 transition-colors hover:bg-blue-100"
      >
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <span>
          <strong>Verificação de identidade: em breve.</strong> Complete seu perfil enquanto isso
          — ajuda o proprietário a decidir. <ArrowRight className="inline h-3 w-3" />
        </span>
      </Link>
    </div>
  );

  // WhatsApp: SEMPRE o da Viva (com o código do imóvel) — o contato do dono fica mascarado até o aceite.
  const whatsapp = destinoWhatsappViva(property.id, process.env.NEXT_PUBLIC_WHATSAPP_VIVA ?? process.env.NEXT_PUBLIC_VIVA_WHATSAPP);

  // Bloco de ações reutilizado dentro do card de preço.
  const actions = candidatouSe ? (
    confirmacaoCandidatura
  ) : (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-ink">
        Quando quer entrar? (opcional)
        <input
          type="date"
          data-testid="candidatura-inicio"
          min={hojeBR()}
          value={inicioDesejado}
          onChange={(e) => setInicioDesejado(e.target.value)}
          className="h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink"
        />
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
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        data-cta
        onClick={abrirSolicitacao}
        disabled={pending !== null}
      >
        <FileSignature className="h-4 w-4" />
        {pending === "candidatura" ? "Enviando..." : "Solicitar reserva"}
      </Button>
      <Button
        variant="secondary"
        size="md"
        className="w-full"
        data-cta
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
        data-cta
        href={whatsapp.href}
        {...(whatsapp.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={buttonClasses({ variant: "secondary", size: "md", className: "w-full" })}
      >
        <MessageCircle className="h-4 w-4" /> {whatsapp.rotulo}
      </a>
      <p className="text-center text-xs text-muted">
        {whatsapp.externo ? "O WhatsApp fala com a Viva." : "A conversa é com a Viva."} O contato do proprietário só aparece depois do aceite.
      </p>
      <AvisoPetCandidatura petsAllowed={property.petsAllowed} regras={property.petsRegras} />
      <AvisoAntigolpe />
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        onClick={() => {
          setComposeText("");
          setComposeKind("visita");
        }}
        disabled={pending !== null || sent.visita}
      >
        {sent.visita ? (
          <>
            <Check className="h-4 w-4" /> Visita solicitada
          </>
        ) : (
          <>
            <CalendarCheck className="h-4 w-4" />
            {pending === "visita" ? "Enviando..." : "Agendar visita"}
          </>
        )}
      </Button>
      {(sent.duvida || sent.visita) && (
        <p className="text-center text-xs text-sage">
          Enviamos seu contato ao proprietário — ele responde por e-mail/WhatsApp.
        </p>
      )}
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
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-title text-lg font-bold text-ink">
          {composeKind === "duvida" ? "Tirar uma dúvida" : "Agendar uma visita"}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {composeKind === "duvida"
            ? "Escreva sua pergunta sobre o imóvel. O proprietário responde pela plataforma."
            : "Diga os dias e horários que funcionam para você. O proprietário confirma pela plataforma."}
        </p>
        <textarea
          rows={4}
          autoFocus
          value={composeText}
          onChange={(e) => setComposeText(e.target.value)}
          placeholder={
            composeKind === "duvida"
              ? "Ex.: O condomínio tem academia? Aceita 2 pessoas?"
              : "Ex.: Posso visitar quinta ou sexta à tarde?"
          }
          className="mt-3 w-full rounded-xl border border-sage-200 px-3.5 py-2.5 text-sm outline-none focus:border-sage"
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

  // Passo de confirmação da solicitação (modal no celular e no computador).
  const solicitacao = solicitacaoAberta && !candidatouSe && (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-night/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="solicitacao-titulo"
      data-testid="solicitacao-passo"
      onClick={() => setSolicitacaoAberta(false)}
    >
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 id="solicitacao-titulo" className="font-title text-lg font-bold text-ink">
          Confirmar solicitação
        </h3>
        <p className="mt-1 text-sm text-muted">{property.title}</p>
        <dl className="mt-3 space-y-2 rounded-lg bg-surface-2 px-3 py-3 text-sm">
          {resumo.linhas.map((l) => (
            <div key={l.rotulo} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">{l.rotulo}</dt>
              <dd className="text-right font-medium text-ink">{l.valor}</dd>
            </div>
          ))}
        </dl>
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
          <Button variant="ghost" size="sm" onClick={() => setSolicitacaoAberta(false)} disabled={pending !== null}>
            {exemplo ? "Entendi" : "Voltar"}
          </Button>
          {!exemplo && (
            <Button variant="primary" size="sm" disabled={pending !== null || !!resumo.erro} onClick={enviarSolicitacao}>
              {pending === "candidatura" ? "Enviando..." : "Enviar solicitação"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    // Página PÚBLICA com fotos: "largura total" = a medida do container (1536 px, como o Furnished Finder), nunca a
    // tela inteira (ordem 4252e0d6, Daniel 16/10). A regra "painel sem mx-auto max-w-*" vale
    // só para dashboards, não para páginas públicas com galeria. Celular: ocupa a largura toda.
    <div className="mx-auto w-full max-w-[1536px] px-5 py-8 pb-48 sm:px-8 lg:px-7 lg:pb-8" data-testid="imovel-largura-total">
      {composer}
      {solicitacao}
      <BarraFixaCelular
        barra={barraFixaImovel({ monthlyPrice: property.monthlyPrice, totalMensal: calcularTotalMensal(property).total, exemplo, candidatouSe, availableFrom: property.availableFrom })}
        pending={pending !== null}
        onSolicitar={abrirSolicitacao}
        onMensagem={() => {
          setComposeText("");
          setComposeKind("duvida");
        }}
        whatsapp={whatsapp}
      />
      {/* Breadcrumb (navegação + SEO) */}
      <nav
        aria-label="Trilha de navegação"
        className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted"
      >
        <Link href="/" className="hover:text-forest">Início</Link>
        <span aria-hidden>›</span>
        <Link href="/buscar" className="hover:text-forest">Buscar imóveis</Link>
        <span aria-hidden>›</span>
        <Link href={`/cidades/${citySlug}`} className="hover:text-forest">{property.city}</Link>
        <span aria-hidden>›</span>
        <span className="line-clamp-1 text-ink">{property.title}</span>
      </nav>

      {/* Galeria adaptável (foto principal + miniaturas + "ver todas") */}
      <PropertyGallery
        photos={property.photos}
        title={property.title}
        readyToLive={property.readyToLiveBadge}
      />

      {/* Abas âncora presas ao rolar (ordem d943f893). */}
      <NavSecoes secoes={secoesDoImovel({ avaliacoes: reviewsReais, temDono: !!(property.owner?.name ?? property.ownerName) })} />

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem] xl:gap-12">
        {/* Conteúdo (seções roláveis) */}
        <div className="min-w-0 space-y-10">
          {/* Visão geral: cabeçalho, sinais de confiança, destaques, medidas, vídeo e descrição. */}
          <div id="visao-geral" className="scroll-mt-36 space-y-10">
          <header>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-muted">
                <MapPin className="h-4 w-4" /> {property.neighborhood}, {property.city} - {property.state}
              </div>
              <span className="flex items-center gap-3">
                {!exemplo && <ProblemaComIsto tipo="anuncio" id={property.id} />}
                <ShareButton title={property.title} text={`${property.title} — Viva Nomads`} />
              </span>
            </div>
            <h1 className="mt-2 font-title text-3xl font-bold text-ink">{property.title}</h1>

            {/* Sinais de confiança (só dado real): disponibilidade, resposta, tempo de casa, código. */}
            <ul data-testid="sinais-confianca" className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              {sinaisDeConfianca(property, new Date().toISOString().slice(0, 10)).map((s) => (
                <li key={s.tipo} className={s.tipo === "codigo" ? "inline-flex items-center gap-1.5 text-xs text-muted" : "inline-flex items-center gap-1.5 text-ink"}>
                  <IconeSinal tipo={s.tipo} />
                  <span className={s.tipo === "disponibilidade" ? "font-semibold text-forest" : undefined}>{s.texto}</span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Anúncio de exemplo (ilustrativo): selo honesto e visível. */}
              {exemplo && (
                <span className="inline-flex items-center rounded-full bg-night/85 px-2.5 py-0.5 text-xs font-semibold text-white">
                  Exemplo ilustrativo
                </span>
              )}
              {/* Fonte ÚNICA (A2): a contagem vem das avaliações REAIS (reviews),
                  igual à seção de avaliações. Sem review real → selo honesto. */}
              {reviewsReais > 0 ? (
                <span className="inline-flex items-center gap-1 text-sm font-medium text-forest">
                  <Star className="h-4 w-4 fill-champagne text-champagne" />
                  {numBR(mediaReal, 1)} · {reviewsReais}{" "}
                  {reviewsReais === 1 ? "avaliação" : "avaliações"}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-sage px-2.5 py-0.5 text-xs font-semibold text-white">
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

            {/* Specs com ícones */}
            <div className="mt-4 flex flex-wrap gap-5 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <BedDouble className="h-4 w-4" /> {property.bedrooms} quartos
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Bath className="h-4 w-4" /> {property.bathrooms} banheiros
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Ruler className="h-4 w-4" /> {property.areaM2} m²
              </span>
              {property.maxGuests != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> Até {property.maxGuests}{" "}
                  {property.maxGuests === 1 ? "pessoa" : "pessoas"}
                </span>
              )}
              {property.furnished && (
                <span className="inline-flex items-center gap-1.5">
                  <Sofa className="h-4 w-4" /> Mobiliado
                </span>
              )}
              {(property.parkingSpots ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Car className="h-4 w-4" /> {property.parkingSpots}{" "}
                  {property.parkingSpots === 1 ? "vaga" : "vagas"}
                </span>
              )}
            </div>
          </header>

          {/* Walk-through em vídeo */}
          {property.videoUrl && (
            <section>
              <VideoWalkthrough url={property.videoUrl} title={property.title} />
              <p className="mt-1.5 text-xs text-muted">
                {isExemplo(property) ? "Vídeo ilustrativo." : "Tour em vídeo gravado pelo proprietário."}
              </p>
            </section>
          )}

          {/* Sobre o imóvel (~5 linhas + "Mostrar mais") */}
          {property.description && <SobreImovel descricao={property.description} />}
          </div>

          {/* Comodidades + regras da casa + o que é bom saber. */}
          <div id="comodidades" className="scroll-mt-36 space-y-10">
            <AmenitiesGrid property={property} />
            <WorkspaceSection property={property} />
            <StayRules property={property} />
            <BomSaber property={property} />
            <PrivacidadeAcesso privacidade={property.privacidade} />
          </div>
          <div id="disponibilidade" className="scroll-mt-36">
            <AvailabilityCalendar property={property} />
          </div>
          <div id="avaliacoes" className="scroll-mt-36">
            <Reviews property={property} />
          </div>
          <div id="proprietario" className="scroll-mt-36 empty:hidden">
            <OwnerCard property={property} />
          </div>
          <div id="localizacao" className="scroll-mt-36 space-y-10">
            <LocationNearby property={property} />
            <GoogleProximities property={property} />
          </div>
        </div>

        {/* Card de preço (sticky no desktop, empilhado no mobile) */}
        <aside>
          <PriceCard property={property} actions={actions} />
        </aside>
      </div>

      {/* Similares */}
      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="font-title text-2xl font-bold text-ink">Imóveis similares</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </section>
      )}
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
