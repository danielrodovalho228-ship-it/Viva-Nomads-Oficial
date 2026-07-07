import Link from "next/link";
import { Bath, BedDouble, Ruler, Star, PlayCircle, Users } from "lucide-react";
import type { Property } from "@/lib/types";
import { formatBRL } from "@/lib/utils";
import { calcularTudoIncluido } from "@/lib/precos";
import { tierFromPhotoCount } from "@/lib/listing";
import { SELO_NF_UI } from "@/lib/flags";
import { ReadyToLiveBadge, PropertyTags, InvoiceBadge, InsuranceBadge } from "@/components/ui/badge";
import { BrandImage } from "@/components/brand-image";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { FavoriteButton } from "@/components/favorite-button";

export function PropertyCard({
  property,
  periodMonths,
}: {
  property: Property;
  /** Quando a busca tem período selecionado, mostra o total estimado do período. */
  periodMonths?: number;
}) {
  const cover = property.photos[0];
  const hasRealPhoto =
    typeof cover === "string" && (/^https?:\/\//.test(cover) || cover.startsWith("/"));
  const tier = tierFromPhotoCount(property.photos.length);
  // "Tudo incluído" pela FONTE ÚNICA (aluguel + condomínio + consumo fixo) — o
  // mesmo número da página do imóvel. Total do período = mensal × meses.
  const inc = calcularTudoIncluido(property);
  const totalPeriodo = periodMonths && periodMonths > 0 ? inc.total * periodMonths : null;

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
        {/* Máximo 2 badges na foto: Pronto para Morar (prioridade 1) + Vídeo. */}
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {property.readyToLiveBadge && <ReadyToLiveBadge size="sm" />}
          {property.videoUrl && (
            <span className="inline-flex items-center gap-1 rounded-full bg-night/85 px-2 py-0.5 text-xs font-semibold text-white">
              <PlayCircle className="h-3.5 w-3.5" /> Vídeo
            </span>
          )}
        </div>
        <div className="absolute right-3 top-3">
          <FavoriteButton propertyId={property.id} />
        </div>
        {/* Destaque de anúncio — selo discreto (borda dourada), não um badge cheio. */}
        {tier !== "padrao" && (
          <span className="absolute bottom-3 right-3 rounded-full border border-gold bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-forest shadow-sm">
            Destaque
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <span className="truncate">
            {property.neighborhood}, {property.city}
          </span>
          {property.reviewCount > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 font-medium text-ink">
              <Star className="h-3.5 w-3.5 fill-green-500 text-green-500" />
              {property.rating.toFixed(1)}
              <span className="text-muted">({property.reviewCount})</span>
            </span>
          ) : (
            // Sem avaliação REAL no banco: nada de estrela inventada — selo honesto.
            <span className="inline-flex shrink-0 items-center rounded-full bg-sage px-2 py-0.5 text-[11px] font-semibold text-white">
              Novo na plataforma
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 font-title text-[1.05rem] font-bold leading-snug text-ink transition-colors group-hover:text-blue-500">
          {property.title}
        </h3>

        <PropertyTags property={property} />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          {/* Tipo saiu da foto e virou metadado (Fase 3). */}
          <span className="font-medium text-ink">{property.propertyType}</span>
          <span className="inline-flex items-center gap-1">
            <BedDouble className="h-4 w-4" /> {property.bedrooms}
          </span>
          <span className="inline-flex items-center gap-1">
            <Bath className="h-4 w-4" /> {property.bathrooms}
          </span>
          <span className="inline-flex items-center gap-1">
            <Ruler className="h-4 w-4" /> {property.areaM2} m²
          </span>
          {property.maxGuests != null && property.maxGuests > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-4 w-4" /> até {property.maxGuests}
            </span>
          )}
        </div>

        {((SELO_NF_UI && property.issuesInvoice) || property.acceptsInsurance) && (
          <div className="flex flex-wrap gap-1.5">
            {SELO_NF_UI && property.issuesInvoice && <InvoiceBadge />}
            {property.acceptsInsurance && <InsuranceBadge />}
          </div>
        )}

        <div className="mt-auto border-t border-line pt-3">
          <div className="flex items-end justify-between">
            <div>
              <span className="font-title text-xl font-bold text-ink">
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
          {/* Custo total estimado — fonte única (aluguel + condomínio + consumo). */}
          {inc.temExtras && (
            <p className="mt-1.5 text-xs font-semibold text-forest">
              ≈ {formatBRL(inc.total)}/mês tudo incluído
            </p>
          )}
          {/* Total do período buscado (Fase 3) — só quando há período na busca. */}
          {totalPeriodo != null && (
            <p className="mt-0.5 text-xs text-muted">
              {periodMonths} {periodMonths === 1 ? "mês" : "meses"} ≈{" "}
              <strong className="text-ink">{formatBRL(totalPeriodo)}</strong> tudo incluído
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
