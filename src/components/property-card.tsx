import Link from "next/link";
import { Bath, BedDouble, MapPin, Ruler } from "lucide-react";
import type { Property } from "@/lib/types";
import { formatBRL } from "@/lib/utils";
import { WorkReadyBadge } from "@/components/ui/badge";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";

export function PropertyCard({ property }: { property: Property }) {
  return (
    <Link
      href={`/imoveis/${property.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-sage-200 bg-white transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[4/3]">
        <PhotoPlaceholder label={property.photos[0]} className="h-full w-full" />
        {property.workReadyBadge && (
          <div className="absolute left-3 top-3">
            <WorkReadyBadge />
          </div>
        )}
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-forest">
          {property.propertyType}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-1 text-xs text-muted">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {property.neighborhood}, {property.city}
        </div>
        <h3 className="line-clamp-2 font-title text-base font-bold text-ink group-hover:text-forest">
          {property.title}
        </h3>

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
        <p className="text-xs text-muted">Período mínimo: {property.minPeriodDays} dias</p>
      </div>
    </Link>
  );
}
