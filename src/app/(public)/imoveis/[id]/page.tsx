import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { anuncioPausadoPublico, getProperty, listProperties } from "@/lib/data/properties";
import { AnuncioPausado } from "@/components/anuncio/anuncio-pausado";
import { isExemplo, ehAnuncioDeTeste } from "@/lib/demo-listing";
import { tituloAbaImovel, descricaoAbaImovel } from "@/lib/anuncio/metadados-imovel";
import { PropertyJsonLd } from "@/components/seo/property-json-ld";
import { PropertyDetail } from "./property-detail";
import { RefDaVisita } from "@/components/cartoes/ref-da-visita";
import { getPerfilProprietario } from "@/lib/data/perfil-proprietario";
import { quantosDestaques } from "@/lib/home-imagens";
import { exibicao59DoImovel } from "@/lib/data/exibicao-59";
import { exibicaoDoExemplo } from "@/lib/niveis/nivel-exemplo";
import { estruturaPublicaDoImovel } from "@/lib/data/estrutura-publica";
import { autoresDasAvaliacoes } from "@/lib/data/avaliacoes-autores";
import { linkDeVideoAprovado } from "@/lib/data/video-link";

// F9: dados frescos (revalidatePath nas ações + rede de segurança de 60 s).
export const revalidate = 60;

interface Params {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) {
    const pausado = await anuncioPausadoPublico(id);
    return pausado ? { title: `${pausado.titulo} (pausado)`, robots: { index: false, follow: true } } : { title: "Página não encontrada", robots: { index: false, follow: false } };
  }

  const title = tituloAbaImovel(property);
  const description = descricaoAbaImovel(property);

  return {
    title,
    description,
    // Canonical próprio da página (auto-referente).
    alternates: { canonical: `/imoveis/${property.id}` },
    // Anúncio de EXEMPLO (ilustrativo): fora do Google (noindex), mas ainda
    // visível ao visitante com o selo "Exemplo ilustrativo".
    ...(isExemplo(property.id) || ehAnuncioDeTeste(property.title) ? { robots: { index: false, follow: true } } : {}),
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

// Frente 3 (t286): sem generateStaticParams. No Next 16.4, a rota ISR com generateStaticParams não pré-carrega
// nada para um id ainda não gerado, e o esqueleto (loading.tsx) não aparecia ao vir da busca. Dinâmica, o
// pré-carregamento traz o layout até o loading.tsx; o revalidate acima e o 404 do layout seguem iguais.

export default async function PropertyDetailPage({ params }: Params) {
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) {
    const pausado = await anuncioPausadoPublico(id);
    if (pausado) return <AnuncioPausado titulo={pausado.titulo} cidade={pausado.cidade} />;
    notFound();
  }

  const [similares, proprietario, exibicao59, autores, linkAprovado, estrutura] = await Promise.all([
    listProperties(),
    // Exemplo nunca busca perfil (continua "Proprietário (exemplo)", sem números).
    isExemplo(property) ? Promise.resolve(null) : getPerfilProprietario(property.ownerId),
    // Prompt 59-A: padrão mínimo e taxa de manutenção — exemplo nunca mostra (nada disso existe para ele).
    // E620: o exemplo mostra o MESMO nível do cartão (graduado pelo motor em properties.ts), sem dado de banco.
    isExemplo(property) ? Promise.resolve(exibicaoDoExemplo(property)) : exibicao59DoImovel(property.id, property.ownerId),
    // Prompt 61-A: cidade e "na Viva desde" de quem avaliou (só avaliações reais publicadas).
    isExemplo(property) || !property.reviews?.length ? Promise.resolve(new Map()) : autoresDasAvaliacoes(property.id),
    // E133 (d): link do YouTube/Vimeo só aparece como tour depois que a equipe aprovou ESTE link.
    isExemplo(property) || !property.videoUrl ? Promise.resolve(true) : linkDeVideoAprovado(property.id, property.videoUrl),
    // E225-A: a estrutura informada pelo proprietário (leitura pública só de anúncio ativo).
    isExemplo(property) ? Promise.resolve(null) : estruturaPublicaDoImovel(property.id),
  ]);
  if (!linkAprovado) property.videoUrl = undefined;
  if (autores.size && property.reviews) property.reviews = property.reviews.map((r) => (r.id && autores.has(r.id) ? { ...r, ...autores.get(r.id) } : r));
  // Imóveis parecidos em grade par (Prompt 40): 4, ou 2 (a mesma conta dos destaques da home).
  const outros = similares.filter((p) => p.id !== property.id);
  const similar = outros.slice(0, quantosDestaques(outros.length));
  return (
    <>
      <PropertyJsonLd property={property} />
      <PropertyDetail property={property} similar={similar} proprietario={proprietario} exibicao59={exibicao59} estrutura={estrutura} />
      {/* Cartões compartilháveis: visita por QR/link assinado (ref + UTM) é conferida no servidor. */}
      <RefDaVisita imovelId={property.id} />
    </>
  );
}

