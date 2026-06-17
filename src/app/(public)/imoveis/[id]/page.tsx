import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SAMPLE_PROPERTIES } from "@/lib/properties";
import { getProperty, listProperties } from "@/lib/data/properties";
import { formatBRL } from "@/lib/utils";
import { PropertyDetail } from "./property-detail";

interface Params {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) return { title: "Imóvel não encontrado" };

  const title = `${property.title} — ${formatBRL(property.monthlyPrice)}/mês`;
  const description = `${property.propertyType} mobiliado em ${property.neighborhood}, ${property.city}. ${property.bedrooms} quartos · ${property.areaM2} m² · período mínimo ${property.minPeriodDays} dias.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "pt_BR",
      url: `/imoveis/${property.id}`,
      siteName: "Viva Nomads",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export function generateStaticParams() {
  return SAMPLE_PROPERTIES.map((p) => ({ id: p.id }));
}

export default async function PropertyDetailPage({ params }: Params) {
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) notFound();

  const similar = (await listProperties()).filter((p) => p.id !== property.id).slice(0, 3);
  return <PropertyDetail property={property} similar={similar} />;
}
