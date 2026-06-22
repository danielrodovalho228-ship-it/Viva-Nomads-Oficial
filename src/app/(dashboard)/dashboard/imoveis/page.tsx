import Link from "next/link";
import { Plus, Bath, BedDouble, Home, Handshake } from "lucide-react";
import { PageTitle, EmptyState } from "@/components/dashboard/primitives";
import { EmptyBuildingIllustration } from "@/components/illustrations";
import { ButtonLink } from "@/components/ui/button";
import { ReadyToLiveBadge } from "@/components/ui/badge";
import { BrandImage } from "@/components/brand-image";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { listMyProperties } from "@/lib/data/properties";
import type { PropertyStatus } from "@/lib/types";
import { formatBRL, cn } from "@/lib/utils";

/** Rótulo + tom do status do anúncio (rascunho/ativo/pausado/arquivado). */
const STATUS_META: Record<PropertyStatus, { label: string; tone: string }> = {
  draft: { label: "Rascunho", tone: "bg-amber-50 text-amber-700" },
  active: { label: "Ativo", tone: "bg-sage-100 text-forest" },
  paused: { label: "Pausado", tone: "bg-surface-2 text-muted" },
};

const hasPhoto = (s?: string) =>
  typeof s === "string" && (/^https?:\/\//.test(s) || s.startsWith("/"));

export default async function MyPropertiesPage() {
  const properties = await listMyProperties();

  return (
    <>
      <PageTitle
        title="Meus imóveis"
        subtitle="Gerencie seus anúncios e o status de publicação."
        action={
          <ButtonLink href="/qualificar" variant="gold">
            <Plus className="h-4 w-4" /> Novo anúncio
          </ButtonLink>
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
          {properties.map((p) => (
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
                </div>
                <Link
                  href={`/imoveis/${p.id}`}
                  className="mt-2 font-title text-lg font-bold text-ink hover:text-forest"
                >
                  {p.title}
                </Link>
                <div className="mt-1 flex gap-4 text-sm text-muted">
                  <span className="inline-flex items-center gap-1">
                    <BedDouble className="h-4 w-4" /> {p.bedrooms}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Bath className="h-4 w-4" /> {p.bathrooms}
                  </span>
                </div>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <span className="font-title text-xl font-bold text-forest">
                    {formatBRL(p.monthlyPrice)}
                    <span className="text-sm font-normal text-muted">/mês</span>
                  </span>
                  <div className="flex gap-2">
                    <ButtonLink href={`/imoveis/${p.id}`} variant="outline" size="sm">
                      Ver
                    </ButtonLink>
                    <ButtonLink href="/dashboard/imoveis/novo" variant="ghost" size="sm">
                      Editar
                    </ButtonLink>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
