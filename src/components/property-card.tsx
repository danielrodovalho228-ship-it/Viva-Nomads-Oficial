import Link from "next/link";
import { Bath, BedDouble, Ruler, Star } from "lucide-react";
import type { Property } from "@/lib/types";
import { formatBRL } from "@/lib/utils";
import { WorkReadyBadge, InvoiceBadge, InsuranceBadge } from "@/components/ui/badge";
import { BrandImage } from "@/components/brand-image";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { FavoriteButton } from "@/components/favorite-button";

export function PropertyCard({ property }: { property: Property }) {
  const cover = property.photos[0];
  const hasRealPhoto = typeof cover === "string" && /^https?:\/\//.test(cover);

  return (
    <Link
      href={`/imoveis/${property.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_20px_40px_-24px_rgba(11,42,102,0.45)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {hasRealPhoto ? (
          <BrandImage
            src={cover}
            alt={property.title}
            rounded="rounded-none"
            sizes="(max-width: 768px) 100vw, 33vw"
            className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <PhotoPlaceholder label={cover} className="h-full w-full" />
        )}
        {property.workReadyBadge && (
          <div className="absolute left-3 top-3">
            <WorkReadyBadge size="sm" />
          </div>
        )}
        <div className="absolute right-3 top-3">
          <FavoriteButton propertyId={property.id} />
        </div>
        <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink shadow-sm">
          {property.propertyType}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <span className="truncate">
            {property.neighborhood}, {property.city}
          </span>
          {property.reviewCount > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 font-medium text-ink">
              <Star className="h-3.5 w-3.5 fill-green-500 text-green-500" />
              {property.rating.toFixed(1)}
              <span className="text-muted">({property.reviewCount})</span>
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 font-title text-[1.05rem] font-bold leading-snug text-ink transition-colors group-hover:text-blue-500">
          {property.title}
        </h3>

        <div className="flex items-center gap-4 text-sm text-muted">
          <span className="inline-flex items-center gap-1">
            <BedDouble className="h-4 w-4" /> {property.bedrooms}
          </span>
          <span className="inline-flex items-center gap-1">
            <Bath className="h-4 w-4" /> {property.bathrooms}
          </span>
          <span className="inline-flex items-center gap-1">
            <Ruler className="h-4 w-4" /> {property.areaM2} m²
          </span>
        </div>

        {(property.issuesInvoice || property.acceptsInsurance) && (
          <div className="flex flex-wrap gap-1.5">
            {property.issuesInvoice && <InvoiceBadge />}
            {property.acceptsInsurance && <InsuranceBadge />}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between border-t border-line pt-3">
          <div>
            <span className="font-title text-xl font-extrabold text-ink">
              {formatBRL(property.monthlyPrice)}
            </span>
            <span className="text-sm text-muted">/mês</span>
          </div>
          <span className="text-right text-xs text-muted">
            {property.utilitiesMode === "fixed" && property.utilitiesEstimate > 0
              ? `+ ${formatBRL(property.utilitiesEstimate)} consumo`
              : "+ consumo medido"}
          </span>
        </div>
      </div>
    </Link>
  );
}
