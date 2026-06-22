"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  Bath,
  BedDouble,
  Ruler,
  MapPin,
  Check,
  Wifi,
  Building2,
  Coffee,
  Users,
  CalendarCheck,
  MessageSquare,
  FileSignature,
  Star,
  FileText,
  ChevronDown,
  MapPinned,
  Handshake,
  ShieldCheck,
} from "lucide-react";
import type { Property, WorkspaceType } from "@/lib/types";
import { INTERNET_META } from "@/lib/internet";
import { formatBRL, cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { PropertyTags, InvoiceBadge, InsuranceBadge, ResponsiveOwnerBadge } from "@/components/ui/badge";
import { PropertyCard } from "@/components/property-card";
import { PropertyGallery } from "@/components/property-gallery";
import { VideoWalkthrough } from "@/components/video-walkthrough";
import { PropertyMap, type MapMarker } from "@/components/property-map";
import { createLead, sendMessage } from "@/lib/data/actions";
import { MatchGuaranteeNotice } from "@/components/legal-notice";

const TABS = [
  "Visão Geral",
  "Comodidades",
  "Espaço de Trabalho",
  "Disponibilidade",
  "Localização",
  "Proprietário",
] as const;

const WORKSPACE_ICONS: Record<WorkspaceType, React.ComponentType<{ className?: string }>> = {
  coworking: Building2,
  meeting_room: Users,
  cafe: Coffee,
};

const WORKSPACE_LABEL: Record<WorkspaceType, string> = {
  coworking: "Coworking",
  meeting_room: "Sala de reunião",
  cafe: "Café de trabalho",
};

/** Avaliações de exemplo (Atualização 10) — virão de `reviews` no Supabase. */
const SAMPLE_REVIEWS = [
  { author: "Carlos M.", rating: 5, comment: "Imóvel impecável e proprietário atencioso. Contrato e nota fiscal sem dor de cabeça." },
  { author: "Fernanda R.", rating: 4.5, comment: "Ótimo para trabalhar de casa. Internet excelente e tudo mobiliado como anunciado." },
];

export function PropertyDetail({
  property,
  similar,
}: {
  property: Property;
  similar: Property[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Visão Geral");
  const tabsRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);
  const [sentInquiry, setSentInquiry] = useState(false);

  // "Enviar consulta": cria um lead e uma mensagem ao proprietário (funil).
  async function handleInquiry() {
    setSending(true);
    const ownerId = `owner-${property.id}`;
    await createLead(property.id, ownerId).catch(() => {});
    await sendMessage({
      receiverId: ownerId,
      propertyId: property.id,
      body: `Olá! Tenho interesse no imóvel "${property.title}". Está disponível?`,
    }).catch(() => {});
    setSending(false);
    setSentInquiry(true);
  }

  // Marcador do imóvel + marcadores dos espaços de trabalho próximos.
  // Coords dos workspaces derivadas da distância (offset determinístico).
  const propertyMarker: MapMarker = {
    id: property.id,
    lat: property.lat,
    lng: property.lng,
    label: "Imóvel",
    kind: "property",
  };
  const workspaceMarkers: MapMarker[] = property.nearbyWorkspaces.map((w, i) => {
    const offset = (w.distanceM / 111000) * (i % 2 === 0 ? 1 : -1);
    return {
      id: w.name,
      lat: property.lat + offset,
      lng: property.lng + offset * 0.8,
      label: w.name,
      kind: "workspace",
    };
  });

  const citySlug = property.city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-");

  return (
    <div className="container-page py-8">
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

      {/* Galeria adaptável (rodada 11) — sem vão vazio, mosaico/carrossel */}
      <PropertyGallery
        photos={property.photos}
        title={property.title}
        readyToLive={property.readyToLiveBadge}
      />

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        {/* Conteúdo + abas */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 text-sm text-muted">
            <MapPin className="h-4 w-4" /> {property.neighborhood}, {property.city} -{" "}
            {property.state}
          </div>
          <h1 className="mt-2 font-title text-3xl font-bold text-ink">{property.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {property.reviewCount > 0 && (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-forest">
                <Star className="h-4 w-4 fill-champagne text-champagne" />
                {property.rating.toFixed(1)} · {property.reviewCount} avaliações
              </span>
            )}
            {property.issuesInvoice && <InvoiceBadge />}
            {property.acceptsInsurance && <InsuranceBadge />}
          </div>

          {/* Etiquetas de aptidão (Atualização 11) */}
          <div className="mt-3">
            <PropertyTags property={property} />
          </div>

          {/* Transparência do operador (Atualização 12) */}
          {property.ownershipType === "subleased" && property.subleaseAuthorized && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-sage-100 px-3 py-1.5 text-xs font-medium text-forest">
              <Handshake className="h-3.5 w-3.5" />
              Operado por gestor profissional, com sublocação autorizada pelo proprietário
            </p>
          )}

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
          </div>

          {/* Walk-through em vídeo — reduz o atrito de alugar sem visita */}
          {property.videoUrl && (
            <div className="mt-5">
              <VideoWalkthrough url={property.videoUrl} title={property.title} />
              <p className="mt-1.5 text-xs text-muted">
                Tour em vídeo gravado pelo proprietário — veja o imóvel antes de agendar a visita.
              </p>
            </div>
          )}

          {/* Abas */}
          <div
            ref={tabsRef}
            className="mt-8 flex flex-wrap gap-1 border-b border-sage-200 scroll-mt-20"
          >
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  // Rola até as abas para o conteúdo escolhido ficar visível (N7).
                  requestAnimationFrame(() =>
                    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                  );
                }}
                className={cn(
                  "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  tab === t
                    ? "border-forest text-forest"
                    : "border-transparent text-muted hover:text-forest"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {tab === "Visão Geral" && (
              <p className="leading-relaxed text-ink/90">{property.description}</p>
            )}

            {tab === "Comodidades" && (
              <ul className="grid gap-3 sm:grid-cols-2">
                {property.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2 text-sm text-ink">
                    <Check className="h-4 w-4 text-sage" /> {a}
                  </li>
                ))}
              </ul>
            )}

            {tab === "Espaço de Trabalho" && (
              <div className="space-y-6">
                <div>
                  <h3 className="flex items-center gap-2 font-title font-bold text-ink">
                    <Wifi className="h-5 w-5 text-champagne-600" /> No imóvel
                  </h3>
                  {property.internetTier && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-champagne/40 bg-champagne/5 px-4 py-3 text-sm">
                      <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-champagne-600" />
                      <span className="text-ink">{INTERNET_META[property.internetTier].anuncio}</span>
                    </div>
                  )}
                  {property.workFeatures.length > 0 && (
                    <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                      {property.workFeatures.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-ink">
                          <Check className="h-4 w-4 text-champagne-600" /> {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h3 className="font-title font-bold text-ink">Espaços de trabalho na região</h3>
                  <p className="mt-1 text-sm text-muted">
                    Referências de coworkings e cafés pela vizinhança — confira a posição no mapa.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {property.nearbyWorkspaces.map((w) => {
                      const Icon = WORKSPACE_ICONS[w.type];
                      return (
                        <li
                          key={w.name}
                          className="flex items-center gap-3 rounded-xl border border-sage-200 px-4 py-3"
                        >
                          <Icon className="h-5 w-5 shrink-0 text-sage" />
                          <span>
                            <span className="font-medium text-ink">{w.name}</span>
                            <span className="block text-xs text-muted">
                              {WORKSPACE_LABEL[w.type]}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <PropertyMap
                    className="mt-4 aspect-[16/9] w-full"
                    center={{ lat: property.lat, lng: property.lng }}
                    markers={[propertyMarker, ...workspaceMarkers]}
                    approximate
                  />
                </div>
              </div>
            )}

            {tab === "Disponibilidade" && (
              <div className="rounded-xl border border-sage-200 p-5">
                <p className="text-sm text-muted">Período mínimo de locação</p>
                <p className="font-title text-2xl font-bold text-forest">
                  {property.minPeriodDays} dias
                </p>
                <p className="mt-2 text-sm text-muted">
                  Disponível para locação por temporada de 30 a 180 dias. Converse com o
                  proprietário para confirmar as datas.
                </p>
              </div>
            )}

            {tab === "Localização" && (
              <div>
                <PropertyMap
                  className="aspect-[16/9] w-full"
                  center={{ lat: property.lat, lng: property.lng }}
                  markers={[propertyMarker]}
                  approximate
                />
                <p className="mt-3 text-sm text-muted">
                  Mostramos a <strong className="text-ink">região aproximada</strong> (
                  {property.neighborhood}). O endereço exato é liberado após o aceite da
                  candidatura.
                </p>
              </div>
            )}

            {tab === "Proprietário" && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 rounded-xl border border-sage-200 p-5">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-sage-100 font-title text-lg font-bold text-forest">
                    {property.ownerName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-title font-bold text-ink">{property.ownerName}</p>
                    <p className="text-sm text-muted">Proprietário verificado</p>
                    <div className="mt-1.5">
                      <ResponsiveOwnerBadge />
                    </div>
                    {property.reviewCount > 0 && (
                      <p className="mt-1 inline-flex items-center gap-1 text-sm text-forest">
                        <Star className="h-4 w-4 fill-champagne text-champagne" />
                        {property.rating.toFixed(1)} ({property.reviewCount} avaliações)
                      </p>
                    )}
                  </div>
                </div>
                {/* O que o inquilino vê do proprietário (Atualização 9) */}
                <ul className="grid gap-2 sm:grid-cols-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className={cn("h-4 w-4", property.issuesInvoice ? "text-sage" : "text-muted")} />
                    {property.issuesInvoice ? "Emite Nota Fiscal" : "Não emite Nota Fiscal"}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={cn("h-4 w-4", property.acceptsInsurance ? "text-sage" : "text-muted")} />
                    {property.acceptsInsurance ? "Aceita seguro-fiança" : "Não aceita seguro-fiança"}
                  </li>
                </ul>

                {/* Avaliações de inquilinos anteriores (Atualização 10) */}
                {property.reviewCount > 0 && (
                  <div>
                    <h4 className="font-title font-bold text-ink">Avaliações de inquilinos</h4>
                    <div className="mt-3 space-y-3">
                      {SAMPLE_REVIEWS.map((r) => (
                        <div key={r.author} className="rounded-xl border border-sage-200 p-4">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-ink">{r.author}</span>
                            <span className="inline-flex items-center gap-1 text-sm text-forest">
                              <Star className="h-4 w-4 fill-champagne text-champagne" /> {r.rating.toFixed(1)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted">{r.comment}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Coluna lateral sticky */}
        <aside className="lg:col-span-1">
          <div className="sticky top-20 rounded-2xl border border-sage-200 bg-white p-6 shadow-sm">
            <div className="flex items-baseline gap-1">
              <span className="font-title text-3xl font-bold text-forest">
                {formatBRL(property.monthlyPrice)}
              </span>
              <span className="text-muted">/mês</span>
            </div>
            {/* Total estimado — texto secundário menor, sem "sticker shock" (N6) */}
            {property.utilitiesMode === "fixed" && property.utilitiesEstimate > 0 && (
              <p className="mt-1 text-sm text-muted">
                ≈ {formatBRL(property.monthlyPrice + property.utilitiesEstimate)}/mês com tudo
                incluído
              </p>
            )}
            {/* Composição do custo — colapsável, transparência sem sobrecarregar (N6) */}
            <details className="group mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-ink">
                Detalhes do custo
                <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-2">
                {property.utilitiesMode === "fixed" && property.utilitiesEstimate > 0 ? (
                  <p className="text-ink">
                    + consumo estimado{" "}
                    <strong>{formatBRL(property.utilitiesEstimate)}</strong>/mês
                    <span className="block text-xs text-muted">
                      Água, luz e gás em valor fixo no contrato (ajuste se exceder{" "}
                      {property.utilitiesOverageMargin}%).
                    </span>
                  </p>
                ) : (
                  <p className="text-ink">
                    + consumo conforme medição
                    <span className="block text-xs text-muted">
                      Contas repassadas ao inquilino mediante comprovante.
                    </span>
                  </p>
                )}
                {property.prepFee > 0 && (
                  <p className="mt-1.5 text-ink">
                    + preparação <strong>{formatBRL(property.prepFee)}</strong>
                    <span className="block text-xs text-muted">
                      Limpeza profunda antes da entrada — cobrada uma única vez, não a cada
                      hóspede.
                    </span>
                  </p>
                )}
                {property.issuesInvoice && (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-700">
                    <FileText className="h-3.5 w-3.5" /> Emite Nota Fiscal do aluguel
                  </p>
                )}
              </div>
            </details>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-sage">
              <span className="h-2 w-2 rounded-full bg-sage" /> Disponível agora
            </p>

            {/* Promoção do Inquilino Verificado no funil (quick win #4) */}
            <Link
              href="/dashboard/verificacao"
              className="mt-5 flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-blue-800 transition-colors hover:bg-blue-100"
            >
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <span>
                <strong>Verifique-se uma vez</strong> e candidate-se a qualquer imóvel com um
                clique.
              </span>
            </Link>

            {/* CTA primário único + secundários menores (quick win #2) */}
            <div className="mt-3 flex flex-col gap-2">
              <ButtonLink href="/dashboard/fechamento" variant="gold" size="lg" className="w-full">
                <FileSignature className="h-4 w-4" /> Candidatar-se
              </ButtonLink>
              {sentInquiry ? (
                <div className="flex items-center justify-center gap-2 rounded-full bg-sage-100 px-4 py-2 text-sm font-medium text-forest">
                  <Check className="h-4 w-4" /> Consulta enviada ao proprietário
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={handleInquiry} disabled={sending}>
                    <MessageSquare className="h-4 w-4" />
                    {sending ? "Enviando..." : "Tirar dúvida"}
                  </Button>
                  <Button variant="ghost" size="sm">
                    <CalendarCheck className="h-4 w-4" /> Agendar visita
                  </Button>
                </div>
              )}
            </div>

            {/* Garantia de correspondência (mediação) — reduz o medo de alugar sem visita */}
            <MatchGuaranteeNotice className="mt-4" />

            <p className="mt-4 flex items-start gap-1.5 text-xs text-muted">
              <MapPinned className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Endereço exato liberado após o aceite da candidatura. Antes, mostramos a região
              aproximada ({property.neighborhood}).
            </p>
            <p className="mt-3 text-center text-xs text-muted">
              O pagamento do aluguel é feito direto ao proprietário. A plataforma conecta e
              documenta — não intermedeia a transação.
            </p>
          </div>
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
