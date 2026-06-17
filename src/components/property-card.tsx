import Link from "next/link";
import { Bath, BedDouble, MapPin, Ruler, Star } from "lucide-react";
import type { Property } from "@/lib/types";
import { formatBRL } from "@/lib/utils";
import { WorkReadyBadge, InvoiceBadge, InsuranceBadge } from "@/components/ui/badge";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { FavoriteButton } from "@/components/favorite-button";

export function PropertyCard({ property }: { property: Property }) {
  const cover = property.photos[0];
  const hasRealPhoto = typeof cover === "string" && /^https?:\/\//.test(cover);

  return (
    <Link
      href={`/imoveis/${property.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-sage-200 bg-white transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[4/3]">
        {hasRealPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={property.title} className="h-full w-full object-cover" />
        ) : (
          <PhotoPlaceholder label={cover} className="h-full w-full" />
        )}
        {property.workReadyBadge && (
          <div className="absolute left-3 top-3">
            <WorkReadyBadge />
          </div>
        )}
        <div className="absolute right-3 top-3">
          <FavoriteButton propertyId={property.id} />
        </div>
        <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-forest">
          {property.propertyType}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {property.neighborhood}, {property.city}
          </span>
          {property.reviewCount > 0 && (
            <span className="inline-flex items-center gap-1 text-forest">
              <Star className="h-3.5 w-3.5 fill-champagne text-champagne" />
              {property.rating.toFixed(1)} ({property.reviewCount})
            </span>
          )}
        </div>
        <h3 className="line-clamp-2 font-title text-base font-bold text-ink group-hover:text-forest">
          {property.title}
        </h3>

        {(property.issuesInvoice || property.acceptsInsurance) && (
          <div className="flex flex-wrap gap-1.5">
            {property.issuesInvoice && <InvoiceBadge />}
            {property.acceptsInsurance && <InsuranceBadge />}
          </div>
        )}

        <div className="mt-1 flex items-center gap-4 text-sm text-muted">
          <span className="inline-flex items-center gap-1">
            <BedDouble className="h-4 w-4" aria-hidden /> {property.bedrooms}
          </span>
          <span className="inline-flex items-center gap-1">
            <Bath className="h-4 w-4" aria-hidden /> {property.bathrooms}
          </span>
          <span className="inline-flex items-center gap-1">
            <Ruler className="h-4 w-4" aria-hidden /> {property.areaM2} m²
          </span>
        </div>

        <div className="mt-auto flex items-baseline gap-1 pt-2">
          <span className="font-title text-xl font-extrabold text-forest">
            {formatBRL(property.monthlyPrice)}
          </span>
          <span className="text-sm text-muted">/mês</span>
        </div>
        <p className="text-xs text-muted">
          {property.utilitiesMode === "fixed" && property.utilitiesEstimate > 0
            ? `+ consumo estimado ${formatBRL(property.utilitiesEstimate)}`
            : "+ consumo conforme medição"}
          {" · "}mín. {property.minPeriodDays} dias
        </p>
      </div>
    </Link>
  );
}
