import Link from "next/link";
import { Bath, BedDouble, PawPrint, Ruler, Star, PlayCircle, Users } from "lucide-react";
import type { Property } from "@/lib/types";
import { formatBRL, numBR } from "@/lib/utils";
import { calcularTudoIncluido, textosTotalMensal } from "@/lib/precos";
import { quartosTexto, banheirosTexto } from "@/lib/anuncio/plural";
import { tierFromPhotoCount } from "@/lib/listing";
import { SELO_NF_UI } from "@/lib/flags";
import { isExemplo } from "@/lib/demo-listing";
import { disponivelAPartirDe } from "@/lib/busca/disponibilidade";
import { ReadyToLiveBadge, PrecoJustoBadge, PropertyTags, InvoiceBadge, InsuranceBadge } from "@/components/ui/badge";
import { BrandImage } from "@/components/brand-image";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { FavoriteButton } from "@/components/favorite-button";
import { repartirSelos, ROTULO_SELO_VIDEO, type SeloCard } from "@/lib/card-selos";
import { videoTourPermitido } from "@/lib/video-tour";
import { MarcaImovel } from "@/components/property/marca-imovel";

export function PropertyCard({
  property,
  periodMonths,
}: {
  property: Property;
  /** Quando a busca tem período selecionado, mostra o total estimado do período. */
  periodMonths?: number;
}) {
  const cover = property.photos[0];
  const exemplo = isExemplo(property);
  const hasRealPhoto =
    typeof cover === "string" && (/^https?:\/\//.test(cover) || cover.startsWith("/"));
  const tier = tierFromPhotoCount(property.photos.length);
  // "Tudo incluído" pela FONTE ÚNICA (aluguel + condomínio + consumo fixo) — o
  // mesmo número da página do imóvel. Total do período = mensal × meses.
  const inc = calcularTudoIncluido(property);
  const totais = textosTotalMensal(property);
  const totalPeriodo = periodMonths && periodMonths > 0 ? inc.total * periodMonths : null;
  const disponivel = disponivelAPartirDe(property.availableFrom);
  const selos = repartirSelos({
    precoJusto: !!property.precoJusto,
    pets: !!property.petsAllowed,
    pronto: !!property.readyToLiveBadge,
    video: videoTourPermitido(property.videoUrl),
    exemplo: exemplo,
    destaque: tier !== "padrao",
  });

  return (
    // O coração fica FORA do <a> (botão dentro de link é HTML inválido e o clique navegava junto): ordem 826719b1, D12.
    <div className="group relative h-full">
    <Link
      href={`/imoveis/${property.id}`}
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_20px_40px_-24px_rgba(11,42,102,0.45)]"
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
        {/* Máximo 2 selos na foto (ordem 86dcb4db, B1): prioridade Preço justo e Aceita pets; o resto vai na linha de baixo. */}
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5" data-testid="selos-foto">
          {selos.foto.map((s) => (
            <Selo key={s} id={s} />
          ))}
        </div>
        {/* Marca do usuário logado ("Visto" / "Você já contatou"): canto inferior esquerdo, fora dos 2 badges do topo. */}
        <div className="absolute bottom-3 left-3">
          <MarcaImovel propertyId={property.id} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <span className="truncate">
            {property.neighborhood}, {property.city}
          </span>
          {exemplo ? (
            // Anúncio de exemplo: nunca mostra nota (seria fictícia).
            <span className="inline-flex shrink-0 items-center text-[11px] font-medium text-muted">
              Anúncio de exemplo
            </span>
          ) : property.reviewCount > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 font-medium text-ink">
              <Star className="h-3.5 w-3.5 fill-green-500 text-green-500" />
              {numBR(property.rating, 1)}
              <span className="text-muted">({property.reviewCount})</span>
            </span>
          ) : (
            // Sem avaliação REAL no banco: nada de estrela inventada — selo honesto.
            <span className="inline-flex shrink-0 items-center rounded-full bg-sage px-2 py-0.5 text-[11px] font-semibold text-white">
              Novo na plataforma
            </span>
          )}
        </div>

        {/* Título sempre com o espaço de 2 linhas (cards do mesmo tamanho — ordem eac7e3a1). */}
        <h3 className="line-clamp-2 min-h-[2.75em] font-title text-[1.05rem] font-bold leading-snug text-ink transition-colors group-hover:text-blue-500">
          {property.title}
        </h3>

        <PropertyTags property={property} />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          {/* Tipo saiu da foto e virou metadado (Fase 3). */}
          <span className="font-medium text-ink">{property.propertyType}</span>
          <span className="inline-flex items-center gap-1" data-testid="card-quartos">
            <BedDouble className="h-4 w-4" aria-hidden /> {quartosTexto(property.bedrooms)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Bath className="h-4 w-4" aria-hidden /> {banheirosTexto(property.bathrooms)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Ruler className="h-4 w-4" /> {property.areaM2} m²
          </span>
          {property.maxGuests != null && property.maxGuests > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-4 w-4" /> até {property.maxGuests}
            </span>
          )}
          {property.petsAllowed && (
            <span className="inline-flex items-center gap-1" title="Aceita pets">
              <PawPrint className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Aceita pets</span>
            </span>
          )}
        </div>

        {(selos.linha.length > 0 || (SELO_NF_UI && property.issuesInvoice) || property.acceptsInsurance) && (
          <div className="flex flex-wrap gap-1.5" data-testid="selos-linha">
            {selos.linha.map((s) => (
              <Selo key={s} id={s} />
            ))}
            {SELO_NF_UI && property.issuesInvoice && <InvoiceBadge />}
            {/* Seguro-fiança em estruturação: exemplo não promete. */}
            {!exemplo && property.acceptsInsurance && <InsuranceBadge />}
          </div>
        )}

        {disponivel && <p className="text-xs font-medium text-forest">Disponível a partir de {disponivel}</p>}

        <div className="mt-auto border-t border-line pt-3">
          {/* Custo total do mês em destaque; valor mensal + extras menor (ordem 1a555bfa). */}
          <div data-testid="cartao-total-mes">
            <span className="font-title text-xl font-bold text-ink">{formatBRL(inc.total)}</span>
            <span className="text-sm font-semibold text-ink">/mês total</span>
            <p className="mt-0.5 text-xs text-muted" data-testid="cartao-valor-mensal">{totais.detalhe}</p>
          </div>
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
    <div className="absolute right-3 top-3 z-10">
      <FavoriteButton propertyId={property.id} />
    </div>
    </div>
  );
}

const SELO_BASE = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold";

function Selo({ id }: { id: SeloCard }) {
  switch (id) {
    case "precoJusto":
      return <PrecoJustoBadge />;
    case "pronto":
      return <ReadyToLiveBadge size="sm" />;
    case "pets":
      return (
        <span className={`${SELO_BASE} border border-sage-200 bg-white text-forest shadow-sm`}>
          <PawPrint className="h-3.5 w-3.5" aria-hidden /> Aceita pets
        </span>
      );
    case "video":
      return (
        <span className={`${SELO_BASE} bg-night/85 text-white`}>
          <PlayCircle className="h-3.5 w-3.5" aria-hidden /> {ROTULO_SELO_VIDEO}
        </span>
      );
    case "exemplo":
      return <span className={`${SELO_BASE} bg-night/85 text-[11px] text-white`}>Exemplo ilustrativo</span>;
    case "destaque":
      return <span className={`${SELO_BASE} border border-gold bg-white/95 text-[11px] text-forest shadow-sm`}>Destaque</span>;
  }
}
