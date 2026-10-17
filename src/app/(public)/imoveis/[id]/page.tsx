import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SAMPLE_PROPERTIES } from "@/lib/properties";
import { getProperty, listProperties } from "@/lib/data/properties";
import { isDemoMode } from "@/lib/env";
import { isExemplo } from "@/lib/demo-listing";
import { tituloAbaImovel, descricaoAbaImovel } from "@/lib/anuncio/metadados-imovel";
import { PropertyJsonLd } from "@/components/seo/property-json-ld";
import { PropertyDetail } from "./property-detail";
import { getPerfilProprietario } from "@/lib/data/perfil-proprietario";

// F9: dados frescos (revalidatePath nas ações + rede de segurança de 60 s).
export const revalidate = 60;

interface Params {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) return { title: "Imóvel não encontrado" };

  const title = tituloAbaImovel(property);
  const description = descricaoAbaImovel(property);

  return {
    title,
    description,
    // Canonical próprio da página (auto-referente).
    alternates: { canonical: `/imoveis/${property.id}` },
    // Anúncio de EXEMPLO (ilustrativo): fora do Google (noindex), mas ainda
    // visível ao visitante com o selo "Exemplo ilustrativo".
    ...(isExemplo(property.id) ? { robots: { index: false, follow: true } } : {}),
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
  // Roda em BUILD TIME, sem request — não pode usar cookies()/Supabase SSR.
  // Em demo, pré-renderiza os exemplos. No acesso real, retorna [] (não
  // pré-renderiza os imóveis demo ube-001/002/003); as páginas reais renderizam
  // sob demanda (dynamicParams) e um id inexistente cai em 404.
  return isDemoMode() ? SAMPLE_PROPERTIES.map((p) => ({ id: p.id })) : [];
}

export default async function PropertyDetailPage({ params }: Params) {
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) notFound();

  const [similares, proprietario] = await Promise.all([
    listProperties(),
    // Exemplo nunca busca perfil (continua "Proprietário (exemplo)", sem números).
    isExemplo(property) ? Promise.resolve(null) : getPerfilProprietario(property.ownerId),
  ]);
  const similar = similares.filter((p) => p.id !== property.id).slice(0, 3);
  return (
    <>
      <PropertyJsonLd property={property} />
      <PropertyDetail property={property} similar={similar} proprietario={proprietario} />
    </>
  );
}

