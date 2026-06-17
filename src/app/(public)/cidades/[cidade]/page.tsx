import type { Metadata } from "next";
import Link from "next/link";
import { listPropertiesByCity } from "@/lib/data/properties";
import { cityFromSlug } from "@/lib/utils";
import { CITIES } from "@/lib/constants";
import { PropertyCard } from "@/components/property-card";
import { ButtonLink } from "@/components/ui/button";

interface Params {
  params: Promise<{ cidade: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { cidade } = await params;
  const name = cityFromSlug(cidade);
  const title = `Imóveis mobiliados mensais em ${name}`;
  const description = `Alugue imóveis mobiliados por temporada de 30 a 180 dias em ${name}. Para profissionais em transição: executivos, médicos, famílias e nômades digitais.`;
  return {
    title,
    description,
    alternates: { canonical: `/cidades/${cidade}` },
    openGraph: { title, description, locale: "pt_BR", url: `/cidades/${cidade}` },
  };
}

export function generateStaticParams() {
  return CITIES.map((c) => ({ cidade: c.slug }));
}

export default async function CityLandingPage({ params }: Params) {
  const { cidade } = await params;
  const name = cityFromSlug(cidade);
  const properties = await listPropertiesByCity(name);

  return (
    <>
      <section className="bg-forest py-16 text-white md:py-20">
        <div className="container-page">
          <nav className="text-sm text-white/60">
            <Link href="/home" className="hover:text-champagne">
              Início
            </Link>{" "}
            / <span className="text-white/80">{name}</span>
          </nav>
          <h1 className="mt-4 max-w-3xl font-title text-4xl font-extrabold md:text-5xl">
            Imóveis mobiliados mensais em {name}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/80">
            Locação por temporada de 30 a 180 dias para quem chega a {name} pelo trabalho —
            executivos em transferência, profissionais de saúde, famílias em transição e
            nômades digitais. Pronto para morar e trabalhar desde o primeiro dia.
          </p>
        </div>
      </section>

      <section className="container-page py-12">
        <div className="flex items-center justify-between">
          <h2 className="font-title text-2xl font-extrabold text-ink">
            {properties.length > 0
              ? `${properties.length} imóveis em ${name}`
              : `Em breve, imóveis em ${name}`}
          </h2>
          <ButtonLink href="/buscar" variant="outline" size="sm">
            Ver toda a busca
          </ButtonLink>
        </div>

        {properties.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-sage-200 p-12 text-center">
            <p className="text-muted">
              Ainda não há imóveis publicados em {name}. É proprietário aqui?
            </p>
            <ButtonLink href="/qualificar" variant="gold" className="mt-4">
              Anuncie seu imóvel em {name}
            </ButtonLink>
          </div>
        )}

        {/* Texto otimizado para SEO */}
        <div className="prose mt-12 max-w-3xl text-muted">
          <h3 className="font-title text-xl font-bold text-ink">
            Por que alugar mobiliado por temporada em {name}?
          </h3>
          <p className="mt-3 leading-relaxed">
            A locação mensal mobiliada é a melhor opção para quem precisa morar em {name} por
            algumas semanas ou meses sem o compromisso de um contrato de 30 meses nem a
            instabilidade da hospedagem de curtíssimo prazo. Com contrato formal de locação
            por temporada (art. 48 da Lei 8.245/91), é aceita em condomínios e dá segurança a
            inquilino e proprietário.
          </p>
          <p className="mt-3 leading-relaxed">
            Todos os imóveis do Viva Nomads em {name} são mobiliados e qualificados. Os que
            têm o selo <strong className="text-forest">Pronto para Trabalho</strong> oferecem
            home office, internet fibra e coworkings próximos — ideais para quem trabalha
            remoto ou está em projeto temporário na cidade.
          </p>
        </div>
      </section>
    </>
  );
}
