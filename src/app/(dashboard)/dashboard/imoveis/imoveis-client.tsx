"use client";

import Link from "next/link";
import { Plus, Bath, BedDouble, Home, Handshake } from "lucide-react";
import { PageTitle, EmptyState } from "@/components/dashboard/primitives";
import { EmptyBuildingIllustration } from "@/components/illustrations";
import { ButtonLink } from "@/components/ui/button";
import { ReadyToLiveBadge } from "@/components/ui/badge";
import { BrandImage } from "@/components/brand-image";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { useDemoMode, DemoBadge } from "@/lib/demo/demo-mode";
import { DEMO_PROPERTIES, DEMO_PROPERTY_STATS } from "@/lib/demo/seed";
import type { Property, PropertyStatus } from "@/lib/types";
import { completudeAnuncio } from "@/lib/listing-completude";
import { formatBRL, cn } from "@/lib/utils";

/** Rótulo + tom do status do anúncio (rascunho/ativo/pausado/arquivado). */
const STATUS_META: Record<PropertyStatus, { label: string; tone: string }> = {
  draft: { label: "Rascunho", tone: "bg-amber-50 text-amber-700" },
  active: { label: "Ativo", tone: "bg-sage-100 text-forest" },
  paused: { label: "Pausado", tone: "bg-surface-2 text-muted" },
};

const hasPhoto = (s?: string) =>
  typeof s === "string" && (/^https?:\/\//.test(s) || s.startsWith("/"));

/**
 * Lista "Meus imóveis". Em modo demonstração (admin) a fonte vira o seed em
 * memória (8 imóveis fictícios); desligado, volta à lista real do servidor.
 */
export function MyPropertiesClient({ properties: real }: { properties: Property[] }) {
  const { on: demoOn } = useDemoMode();
  const properties = demoOn ? DEMO_PROPERTIES : real;

  return (
    <>
      <PageTitle
        title="Meus imóveis"
        subtitle="Gerencie seus anúncios e o status de publicação."
        action={
          <div className="flex items-center gap-2">
            {demoOn && <DemoBadge />}
            <ButtonLink href="/qualificar" variant="gold">
              <Plus className="h-4 w-4" /> Novo anúncio
            </ButtonLink>
          </div>
        }
      />

      {properties.length === 0 ? (
        <EmptyState
          illustration={<EmptyBuildingIllustration />}
          title="Você ainda não tem imóveis"
          text="Comece pela qualificação para liberar a publicação do seu primeiro anúncio."
          action={
            <ButtonLink href="/qualificar" variant="gold">
              Qualificar imóvel
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid gap-4">
          {properties.map((p) => {
            const demoItem = demoOn;
            const stats = demoItem ? DEMO_PROPERTY_STATS[p.id] : undefined;
            const comp = completudeAnuncio(p);
            return (
              <div
                key={p.id}
                className="flex flex-col gap-4 rounded-2xl border border-sage-200 bg-white p-4 sm:flex-row"
              >
                {hasPhoto(p.photos[0]) ? (
                  <BrandImage
                    src={p.photos[0]}
                    alt={p.title}
                    sizes="200px"
                    className="aspect-[4/3] w-full shrink-0 sm:w-48"
                  />
                ) : (
                  <PhotoPlaceholder
                    label={p.photos[0]}
                    className="aspect-[4/3] w-full shrink-0 rounded-xl sm:w-48"
                  />
                )}
                <div className="flex flex-1 flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        STATUS_META[p.status].tone
                      )}
                    >
                      {STATUS_META[p.status].label}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-sage-200 px-2.5 py-1 text-xs font-medium text-ink">
                      {p.ownershipType === "subleased" ? (
                        <>
                          <Handshake className="h-3.5 w-3.5 text-sage" /> Operado
                        </>
                      ) : (
                        <>
                          <Home className="h-3.5 w-3.5 text-forest" /> Próprio
                        </>
                      )}
                    </span>
                    {p.readyToLiveBadge && <ReadyToLiveBadge />}
                    {demoItem && <DemoBadge />}
                  </div>
                  {demoItem ? (
                    <span className="mt-2 font-title text-lg font-bold text-ink">{p.title}</span>
                  ) : (
                    <Link
                      href={`/imoveis/${p.id}`}
                      className="mt-2 font-title text-lg font-bold text-ink hover:text-forest"
                    >
                      {p.title}
                    </Link>
                  )}
                  <div className="mt-1 flex gap-4 text-sm text-muted">
                    <span className="inline-flex items-center gap-1">
                      <BedDouble className="h-4 w-4" /> {p.bedrooms}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Bath className="h-4 w-4" /> {p.bathrooms}
                    </span>
                    {stats && (
                      <span className="text-xs">
                        {stats.leads} interessado(s) · {stats.views} visualizações
                      </span>
                    )}
                  </div>
                  {/* Barra de completude do anúncio (Fase 3) — anúncio completo
                      rende mais; mostra o % e o que falta. */}
                  {!demoItem && comp.pct < 100 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-ink">Anúncio {comp.pct}% completo</span>
                        {!comp.podePublicar && (
                          <span className="text-amber-700">mín. 5 fotos para publicar</span>
                        )}
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full bg-forest transition-all"
                          style={{ width: `${comp.pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-muted">
                        Falta: {comp.faltando.slice(0, 3).join(" · ")}
                        {comp.faltando.length > 3 ? " …" : ""}
                      </p>
                    </div>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <span className="font-title text-xl font-bold text-forest">
                      {formatBRL(p.monthlyPrice)}
                      <span className="text-sm font-normal text-muted">/mês</span>
                    </span>
                    {/* Itens fictícios não têm página/edição real — sem links. */}
                    {!demoItem && (
                      <div className="flex gap-2">
                        {/* Rascunho não tem página pública ainda — só "Continuar
                            editando" (item 2 do QA: rascunho recuperável). */}
                        {p.status !== "draft" && (
                          <ButtonLink href={`/imoveis/${p.id}`} variant="outline" size="sm">
                            Ver
                          </ButtonLink>
                        )}
                        <ButtonLink
                          href={`/dashboard/imoveis/${p.id}/editar`}
                          variant={p.status === "draft" ? "gold" : "ghost"}
                          size="sm"
                        >
                          {p.status === "draft" ? "Continuar editando" : "Editar"}
                        </ButtonLink>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
