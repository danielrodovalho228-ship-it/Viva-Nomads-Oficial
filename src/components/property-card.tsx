import Link from "next/link";
import { PawPrint, Star, PlayCircle } from "lucide-react";
import type { Property } from "@/lib/types";
import { formatBRL, numBR } from "@/lib/utils";
import { calcularTudoIncluido, textosTotalMensal } from "@/lib/precos";
import { quartosTexto, banheirosTexto } from "@/lib/anuncio/plural";
import { tierFromPhotoCount } from "@/lib/listing";
import { SELO_NF_UI } from "@/lib/flags";
import { isExemplo } from "@/lib/demo-listing";
import { disponivelAPartirDe } from "@/lib/busca/disponibilidade";
import { ReadyToLiveBadge, PrecoJustoBadge, InvoiceBadge, InsuranceBadge } from "@/components/ui/badge";
import { BrandImage } from "@/components/brand-image";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { FavoriteButton } from "@/components/favorite-button";
import { repartirSelos, ROTULO_SELO_VIDEO, type SeloCard } from "@/lib/card-selos";
import { videoTourPermitido } from "@/lib/video-tour";
import { MarcaImovel } from "@/components/property/marca-imovel";
import { IdealPara } from "@/components/property/ideal-para";

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
    // Prompt 40 (Estudo 1): cartão SEM caixa, borda ou sombra — foto 4:3 com raio de 12 px e o texto
    // solto sobre o branco. Ordem: foto (coração no canto) → bairro e cidade → linha-síntese → valor
    // mensal (600, o maior texto) → selos (no máximo 2 na foto, regra B1 de 86dcb4db).
    // O coração fica FORA do <a> (botão dentro de link é HTML inválido e o clique navegava junto): ordem 826719b1, D12.
    <div className="group relative h-full" data-testid="cartao-imovel">
    <Link
      href={`/imoveis/${property.id}`}
      className="flex h-full flex-col gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-4"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-surface-2" data-testid="cartao-foto">
        {hasRealPhoto ? (
          <BrandImage
            src={cover}
            alt={property.title}
            rounded="rounded-none"
            treat={false}
            sizes="(max-width: 768px) 100vw, 33vw"
            className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <PhotoPlaceholder label={cover} className="h-full w-full" />
        )}
        {/* Máximo 2 selos na foto (ordem 86dcb4db, B1): prioridade Preço justo e Aceita pets; o resto vai na linha de baixo. */}
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1" data-testid="selos-foto">
          {selos.foto.map((s) => (
            <Selo key={s} id={s} />
          ))}
        </div>
        {/* Marca do usuário logado ("Visto" / "Você já contatou"): canto inferior esquerdo, fora dos 2 badges do topo. */}
        <div className="absolute bottom-3 left-3">
          <MarcaImovel propertyId={property.id} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          {/* Título do cartão = bairro e cidade, 15–16 px. */}
          <h3 className="min-w-0 truncate font-title text-[15px] font-semibold leading-snug text-ink sm:text-base" data-testid="cartao-local">
            {property.neighborhood}, {property.city}
          </h3>
          {exemplo ? (
            // Anúncio de exemplo: nunca mostra nota (seria fictícia).
            <span className="shrink-0 text-xs text-muted">Anúncio de exemplo</span>
          ) : property.reviewCount > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-sm text-ink">
              <Star className="h-3.5 w-3.5 fill-ink text-ink" aria-hidden />
              {numBR(property.rating, 1)}
              <span className="text-muted">({property.reviewCount})</span>
            </span>
          ) : (
            // Sem avaliação REAL no banco: nada de estrela inventada — texto honesto.
            <span className="shrink-0 text-xs text-muted">Novo na plataforma</span>
          )}
        </div>

        <p className="line-clamp-1 text-sm text-muted" data-testid="cartao-titulo">
          {property.title}
        </p>

        {/* Linha-síntese: quartos · banheiros · área (· pessoas). */}
        <p className="flex flex-wrap items-center gap-x-1 text-sm text-muted" data-testid="cartao-sintese">
          <span data-testid="card-quartos">{quartosTexto(property.bedrooms)}</span>
          <span aria-hidden>·</span>
          <span>{banheirosTexto(property.bathrooms)}</span>
          {property.areaM2 > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>{property.areaM2} m²</span>
            </>
          )}
          {property.maxGuests != null && property.maxGuests > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>até {property.maxGuests} pessoas</span>
            </>
          )}
          {property.petsAllowed && (
            <span className="ml-1 inline-flex items-center" title="Aceita pets">
              <PawPrint className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Aceita pets</span>
            </span>
          )}
        </p>

        <IdealPara property={property} className="line-clamp-1" />

        {disponivel && <p className="text-sm text-muted">Disponível a partir de {disponivel}</p>}

        <div className="mt-auto pt-1">
          {/* Custo total do mês em destaque (ordem 1a555bfa): o maior texto do cartão, em 600 e no verde de marca. */}
          <div data-testid="cartao-total-mes">
            <span className="font-title text-lg font-semibold text-forest">{formatBRL(inc.total)}</span>
            <span className="text-sm text-ink">/mês total</span>
            <p className="text-xs text-muted" data-testid="cartao-valor-mensal">{totais.detalhe}</p>
          </div>
          {/* Total do período buscado (Fase 3) — só quando há período na busca. */}
          {totalPeriodo != null && (
            <p className="text-xs text-muted">
              {periodMonths} {periodMonths === 1 ? "mês" : "meses"} ≈{" "}
              <strong className="text-ink">{formatBRL(totalPeriodo)}</strong> tudo incluído
            </p>
          )}
        </div>

        {(selos.linha.length > 0 || (SELO_NF_UI && property.issuesInvoice) || (!exemplo && property.acceptsInsurance)) && (
          <div className="mt-1 flex flex-wrap gap-1" data-testid="selos-linha">
            {selos.linha.map((s) => (
              <Selo key={s} id={s} />
            ))}
            {SELO_NF_UI && property.issuesInvoice && <InvoiceBadge />}
            {/* Seguro-fiança em estruturação: exemplo não promete. */}
            {!exemplo && property.acceptsInsurance && <InsuranceBadge />}
          </div>
        )}
      </div>
    </Link>
    <div className="absolute right-3 top-3 z-10">
      <FavoriteButton propertyId={property.id} />
    </div>
    </div>
  );
}

/** Selo sobre a foto ou na linha: pill branca com texto tinta, sem sombra (o fundo branco já separa da foto). */
const SELO_BASE = "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold";

function Selo({ id }: { id: SeloCard }) {
  switch (id) {
    case "precoJusto":
      return <PrecoJustoBadge />;
    case "pronto":
      return <ReadyToLiveBadge size="sm" />;
    case "pets":
      return (
        <span className={`${SELO_BASE} bg-white text-ink`}>
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
      return <span className={`${SELO_BASE} bg-night/85 text-white`}>Exemplo ilustrativo</span>;
    case "destaque":
      return <span className={`${SELO_BASE} bg-white text-ink`}>Destaque</span>;
  }
}
