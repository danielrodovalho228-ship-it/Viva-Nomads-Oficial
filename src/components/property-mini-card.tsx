import { Bath, BedDouble, Ruler, MapPin } from "lucide-react";
import type { Property } from "@/lib/types";
import { formatBRL } from "@/lib/utils";
import { ReadyToLiveBadge, PropertyTags } from "@/components/ui/badge";
import { BrandImage } from "@/components/brand-image";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";

/**
 * Card compacto do imóvel para o topo do orçamento/fechamento (Atualização 16).
 * Mostra qual imóvel está sendo negociado — útil para quem tem vários.
 */
export function PropertyMiniCard({ property }: { property: Property }) {
  const cover = property.photos[0];
  const hasPhoto =
    typeof cover === "string" && (/^https?:\/\//.test(cover) || cover.startsWith("/"));

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-sage-200 bg-white p-3 sm:flex-row sm:gap-4">
      {/* Mobile: foto largura total no topo. sm+: foto à esquerda. */}
      <div className="relative w-full shrink-0 sm:w-36">
        {hasPhoto ? (
          <BrandImage
            src={cover}
            alt={property.title}
            sizes="(max-width: 640px) 100vw, 160px"
            className="aspect-[16/9] w-full sm:aspect-[4/3]"
          />
        ) : (
          <PhotoPlaceholder
            label={cover}
            className="aspect-[16/9] w-full rounded-xl sm:aspect-[4/3]"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1 text-xs text-muted">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {property.neighborhood}, {property.city}
          </span>
        </div>
        {/* Título com espaço próprio — line-clamp-2, nada por cima. */}
        <h3 className="mt-1 line-clamp-2 font-title text-base font-bold leading-snug text-ink">
          {property.title}
        </h3>
        {/* Selos em fluxo normal, quebram naturalmente (sem position absolute). */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {property.readyToLiveBadge && <ReadyToLiveBadge size="sm" />}
          <PropertyTags property={property} />
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2 pt-1 sm:mt-auto">
          <div className="flex gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" /> {property.bedrooms}
            </span>
            <span className="inline-flex items-center gap-1">
              <Bath className="h-3.5 w-3.5" /> {property.bathrooms}
            </span>
            <span className="inline-flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5" /> {property.areaM2} m²
            </span>
          </div>
          <span className="font-title text-base font-bold text-ink">
            {formatBRL(property.monthlyPrice)}
            <span className="text-xs font-normal text-muted">/mês</span>
          </span>
        </div>
      </div>
    </div>
  );
}
