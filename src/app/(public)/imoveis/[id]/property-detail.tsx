"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  CalendarCheck,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import type { Property } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/share-button";
import { PropertyTags, InvoiceBadge, InsuranceBadge } from "@/components/ui/badge";
import { SELO_NF_UI } from "@/lib/flags";
import { PropertyCard } from "@/components/property-card";
import { PropertyGallery } from "@/components/property-gallery";
import { VideoWalkthrough } from "@/components/video-walkthrough";
import { requestLead } from "@/lib/data/actions";
import type { LeadKind } from "@/lib/leads";
import { PriceCard } from "@/components/property/price-card";
import { AmenitiesGrid } from "@/components/property/amenities-grid";
import { WorkspaceSection } from "@/components/property/workspace-section";
import { LocationNearby } from "@/components/property/location-nearby";
import { GoogleProximities } from "@/components/property/google-proximities";
import { StayRules } from "@/components/property/stay-rules";
import { AvailabilityCalendar } from "@/components/property/availability-calendar";
import { OwnerCard } from "@/components/property/owner-card";
import { Reviews } from "@/components/property/reviews";

export function PropertyDetail({ property, similar }: { property: Property; similar: Property[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<LeadKind | null>(null);
  const [sent, setSent] = useState<{ duvida?: boolean; visita?: boolean }>({});
  const [selfNote, setSelfNote] = useState(false);
  const [leadErro, setLeadErro] = useState<string | null>(null);
  const [candidatouSe, setCandidatouSe] = useState(false);
  // Composer de dúvida/visita: o inquilino escreve a mensagem de verdade.
  const [composeKind, setComposeKind] = useState<"duvida" | "visita" | null>(null);
  const [composeText, setComposeText] = useState("");

  // Avaliações — FONTE ÚNICA (A2): usa o array real de reviews, igual à seção de
  // avaliações. `rating` só é usado como média quando há review real.
  const reviewsReais = property.reviews?.length ?? 0;
  const mediaReal =
    reviewsReais > 0
      ? property.rating > 0
        ? property.rating
        : property.reviews!.reduce((s, r) => s + r.rating, 0) / reviewsReais
      : 0;

  // Dúvida / visita / candidatura: registra o interesse e avisa o proprietário
  // (e-mail/WhatsApp). Candidatura segue para o fluxo de fechamento.
  async function handleLead(kind: LeadKind, note?: string) {
    setPending(kind);
    setLeadErro(null);
    const r = await requestLead(property.id, property.title, kind, note).catch(() => null);
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
    // Falha real (rede/servidor): NUNCA deixa o botão "morto" — mostra o erro.
    if (!r || !r.ok) {
      setLeadErro("Não foi possível enviar agora. Verifique a conexão e tente novamente.");
      return false;
    }
    if (kind === "candidatura") {
      // Candidatura NÃO é fechamento (este nasce quando o PROPRIETÁRIO aceita):
      // confirma o envio e aponta o acompanhamento em Mensagens.
      setCandidatouSe(true);
      return true;
    }
    setSent((s) => ({ ...s, [kind]: true }));
    return true;
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
        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-forest/90"
      >
        <MessageSquare className="h-4 w-4" /> Acompanhar em Mensagens
      </Link>
      <Link
        href="/dashboard/verificacao?como=inquilino"
        className="flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-left text-xs text-blue-800 transition-colors hover:bg-blue-100"
      >
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <span>
          <strong>Aumente suas chances:</strong> candidatos verificados passam mais confiança.
          Verifique-se — leva poucos minutos. <ArrowRight className="inline h-3 w-3" />
        </span>
      </Link>
    </div>
  );

  // Bloco de ações reutilizado dentro do card de preço.
  const actions = candidatouSe ? (
    confirmacaoCandidatura
  ) : (
    <div className="flex flex-col gap-2">
      <Button
        variant="gold"
        size="lg"
        className="w-full"
        onClick={() => handleLead("candidatura")}
        disabled={pending !== null}
      >
        <FileSignature className="h-4 w-4" />
        {pending === "candidatura" ? "Enviando..." : "Candidatar-se"}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setComposeText("");
            setComposeKind("duvida");
          }}
          disabled={pending !== null || sent.duvida}
        >
          {sent.duvida ? (
            <>
              <Check className="h-4 w-4" /> Dúvida enviada
            </>
          ) : (
            <>
              <MessageSquare className="h-4 w-4" />
              {pending === "duvida" ? "Enviando..." : "Tirar dúvida"}
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
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
      </div>
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

  return (
    <div className="container-page py-8">
      {composer}
      {/* Breadcrumb (navegação + SEO) */}
      <nav
        aria-label="Trilha de navegação"
        className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted"
      >
        <Link href="/home" className="hover:text-forest">Início</Link>
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

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        {/* Conteúdo (seções roláveis) */}
        <div className="space-y-10 lg:col-span-2">
          {/* Cabeçalho */}
          <header>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-muted">
                <MapPin className="h-4 w-4" /> {property.neighborhood}, {property.city} - {property.state}
              </div>
              <ShareButton title={property.title} text={`${property.title} — Viva Nomads`} />
            </div>
            <h1 className="mt-2 font-title text-3xl font-bold text-ink">{property.title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Fonte ÚNICA (A2): a contagem vem das avaliações REAIS (reviews),
                  igual à seção de avaliações. Sem review real → selo honesto. */}
              {reviewsReais > 0 ? (
                <span className="inline-flex items-center gap-1 text-sm font-medium text-forest">
                  <Star className="h-4 w-4 fill-champagne text-champagne" />
                  {mediaReal.toFixed(1)} · {reviewsReais}{" "}
                  {reviewsReais === 1 ? "avaliação" : "avaliações"}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-sage px-2.5 py-0.5 text-xs font-semibold text-white">
                  Novo na plataforma
                </span>
              )}
              {SELO_NF_UI && property.issuesInvoice && <InvoiceBadge />}
              {property.acceptsInsurance && <InsuranceBadge />}
            </div>

            <div className="mt-3">
              <PropertyTags property={property} />
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
                Tour em vídeo gravado pelo proprietário — veja o imóvel antes de agendar a visita.
              </p>
            </section>
          )}

          {/* Sobre o imóvel */}
          {property.description && (
            <section aria-labelledby="sobre-title">
              <h2 id="sobre-title" className="font-title text-2xl font-bold text-ink">
                Sobre o imóvel
              </h2>
              <p className="mt-3 leading-relaxed text-ink/90">{property.description}</p>
            </section>
          )}

          <AmenitiesGrid property={property} />
          <WorkspaceSection property={property} />
          <AvailabilityCalendar property={property} />
          <LocationNearby property={property} />
          <GoogleProximities property={property} />
          <StayRules property={property} />
          <OwnerCard property={property} />
          <Reviews property={property} />
        </div>

        {/* Card de preço (sticky no desktop, empilhado no mobile) */}
        <aside className="lg:col-span-1">
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
