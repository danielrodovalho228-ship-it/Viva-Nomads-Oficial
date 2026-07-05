import type { Property } from "@/lib/types";
import { SITE_URL, SITE_NAME } from "@/lib/site";

/** Absolutiza URLs de imagem (o JSON-LD pede URLs completas). */
function absolute(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** Slug da cidade — espelha o usado no breadcrumb visual. */
function citySlug(city: string): string {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-");
}

/**
 * Dados estruturados (Schema.org / JSON-LD) da página de detalhe do imóvel.
 *
 * Emite um @graph com:
 *  - um nó de produto/imóvel (preço, disponibilidade, avaliação, fotos e
 *    localização APROXIMADA — bairro/cidade, sem endereço exato por privacidade);
 *  - o BreadcrumbList correspondente (Início › Buscar › Cidade › Imóvel).
 *
 * Permite que o Google exiba rich snippets (preço/avaliação/disponibilidade)
 * nos resultados de busca. Tudo derivado da listagem real — nada fixo.
 */
export function PropertyJsonLd({ property }: { property: Property }) {
  const pageUrl = `${SITE_URL}/imoveis/${property.id}`;
  const images = property.photos
    .filter((p) => typeof p === "string" && (/^https?:\/\//.test(p) || p.startsWith("/")))
    .map(absolute);

  const product: Record<string, unknown> = {
    "@type": ["Product", "RealEstateListing"],
    "@id": `${pageUrl}#listing`,
    name: property.title,
    description: property.description,
    category: property.propertyType,
    url: pageUrl,
    ...(images.length > 0 ? { image: images } : {}),
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: property.monthlyPrice,
      // Locação por temporada: o preço é mensal.
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: property.monthlyPrice,
        priceCurrency: "BRL",
        unitCode: "MON",
        referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
      },
      availability:
        property.status === "active"
          ? "https://schema.org/InStock"
          : "https://schema.org/PreOrder",
      url: pageUrl,
    },
    // Localização aproximada (sem endereço exato — liberado só após o aceite).
    address: {
      "@type": "PostalAddress",
      addressLocality: property.city,
      addressRegion: property.state,
      addressCountry: "BR",
      ...(property.neighborhood ? { areaServed: property.neighborhood } : {}),
    },
    geo: { "@type": "GeoCoordinates", latitude: property.lat, longitude: property.lng },
    additionalProperty: [
      { "@type": "PropertyValue", name: "Quartos", value: property.bedrooms },
      { "@type": "PropertyValue", name: "Banheiros", value: property.bathrooms },
      { "@type": "PropertyValue", name: "Área (m²)", value: property.areaM2 },
      { "@type": "PropertyValue", name: "Período mínimo (dias)", value: property.minPeriodDays },
    ],
  };

  // Avaliação só entra quando existe de verdade (evita rich snippet inflado).
  if (property.reviewCount > 0) {
    product.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: property.rating,
      reviewCount: property.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/home` },
      { "@type": "ListItem", position: 2, name: "Buscar imóveis", item: `${SITE_URL}/buscar` },
      {
        "@type": "ListItem",
        position: 3,
        name: property.city,
        item: `${SITE_URL}/cidades/${citySlug(property.city)}`,
      },
      { "@type": "ListItem", position: 4, name: property.title, item: pageUrl },
    ],
  };

  const json = { "@context": "https://schema.org", "@graph": [product, breadcrumb] };

  // SEGURANÇA: título/descrição do imóvel são escritos pelo proprietário. Ao
  // injetar o JSON num <script>, é preciso escapar `<`, `>` e `&` — senão um
  // título como `</script><img onerror=...>` quebraria a tag e viraria XSS
  // armazenado na página pública. JSON.stringify sozinho NÃO escapa isso.
  const safeJson = JSON.stringify(json)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJson }}
    />
  );
}
