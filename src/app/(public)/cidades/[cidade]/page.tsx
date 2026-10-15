import { isExemplo } from "@/lib/demo-listing";
import type { Metadata } from "next";
import Link from "next/link";
import { listPropertiesByCity } from "@/lib/data/properties";
import { cityFromSlug } from "@/lib/utils";
import { CITIES } from "@/lib/constants";
import { SELOS } from "@/config/selos";
import { PropertyCard } from "@/components/property-card";
import { ButtonLink } from "@/components/ui/button";
import { JsonLd } from "@/components/seo/json-ld";
import { paginaCidade } from "@/lib/seo/estruturados";
import { SITE_URL } from "@/lib/site";
import { calcularPrecosMedios, rotuloQuartos } from "@/lib/preco-medio";
import { polosDaCidade } from "@/lib/polos";
import { faqPageCidade, perguntasCidade } from "@/lib/seo/anuncio-cidade";

// F9: dados frescos (revalidatePath nas ações + rede de segurança de 60 s).
export const revalidate = 60;

interface Params {
  params: Promise<{ cidade: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { cidade } = await params;
  const name = cityFromSlug(cidade);
  const title = `Imóveis mobiliados mensais em ${name}`;
  const description = `Alugue imóveis mobiliados para estadias de 30 a 180 dias em ${name}. Para profissionais em transição: executivos, médicos, famílias e nômades digitais.`;
  return {
    title,
    description,
    // Página local principal (texto próprio da cidade): sempre indexável — antes
    // ficava noindex sem anúncio real e a Viva sumia do Google na cidade. Os
    // imóveis de EXEMPLO continuam fora do índice (página do imóvel e sitemap).
    robots: { index: true, follow: true },
    alternates: { canonical: `/cidades/${cidade}` },
    // openGraph aqui substitui o da raiz inteiro: a imagem precisa vir junto.
    openGraph: {
      title,
      description,
      locale: "pt_BR",
      url: `/cidades/${cidade}`,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: title }],
    },
  };
}

export function generateStaticParams() {
  return CITIES.map((c) => ({ cidade: c.slug }));
}

export default async function CityLandingPage({ params }: Params) {
  const { cidade } = await params;
  const name = cityFromSlug(cidade);
  const properties = await listPropertiesByCity(name);
  const infoCidade = CITIES.find((c) => c.slug === cidade);
  const precosMedios = calcularPrecosMedios(properties);
  const atualizadoEm = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());

  return (
    <>
      {infoCidade && <JsonLd dados={paginaCidade(SITE_URL, infoCidade, properties, (id) => isExemplo(id))} />}
      {infoCidade && <JsonLd dados={faqPageCidade(name)} />}
      <section className="bg-forest section-y text-white">
        <div className="container-page">
          <nav className="text-sm text-white/60">
            <Link href="/" className="hover:text-champagne">
              Início
            </Link>{" "}
            / <span className="text-white/80">{name}</span>
          </nav>
          <h1 className="mt-4 max-w-3xl font-title text-4xl font-bold md:text-5xl">
            Imóveis mobiliados mensais em {name}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/80">
            Estadias de 30 a 180 dias em {name}, mobiliada e pronta para morar.
            Para executivos em transferência, profissionais de saúde, famílias em transição,
            estudantes e nômades digitais — instalados e em casa desde o primeiro dia.
          </p>
        </div>
      </section>

      <section className="container-page section-y">
        <div className="flex items-center justify-between">
          <h2 className="font-title text-2xl font-bold text-ink">
            {properties.length === 0
              ? `Em breve, imóveis em ${name}`
              : properties.every((p) => isExemplo(p.id))
                ? `${properties.length} ${properties.length === 1 ? "anúncio" : "anúncios"} de exemplo em ${name}`
                : `${properties.length} imóveis em ${name}`}
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
            <ButtonLink href="/dashboard/imoveis/novo" variant="gold" className="mt-4">
              Anuncie seu imóvel em {name}
            </ButtonLink>
          </div>
        )}

        {precosMedios.length > 0 && (
          <div className="mt-12 max-w-3xl" data-testid="precos-medios">
            <h2 className="font-title text-2xl font-bold text-ink">Valor médio por mês em {name}</h2>
            <p className="mt-2 text-sm text-muted">
              Média dos anúncios publicados na Viva, por bairro e número de quartos. Só mostramos a média
              quando há pelo menos 3 anúncios no grupo. Atualizado em {atualizadoEm}.
            </p>
            <ul className="mt-4 divide-y divide-sage-200 rounded-2xl border border-sage-200">
              {precosMedios.map((g) => (
                <li key={`${g.bairro}-${g.quartos}`} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-ink">
                    {g.bairro} <span className="text-muted">· {rotuloQuartos(g.quartos)}</span>
                  </span>
                  <span className="shrink-0 text-right font-semibold text-forest">
                    {g.media === null ? (
                      <span className="text-sm font-normal text-muted">Dados insuficientes</span>
                    ) : (
                      `R$ ${g.media.toLocaleString("pt-BR")} por mês`
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {polosDaCidade(cidade).length > 0 && (
          <div className="mt-12 max-w-3xl" data-testid="polos-da-cidade">
            <h2 className="font-title text-2xl font-bold text-ink">Por região de {name}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {polosDaCidade(cidade).map((p) => (
                <li key={p.slug}>
                  <Link href={`/cidades/${cidade}/${p.slug}`} className="block rounded-2xl border border-sage-200 p-4 font-semibold text-forest hover:border-forest">
                    {p.nome}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Texto otimizado para SEO */}
        <div className="prose mt-12 max-w-3xl text-muted">
          <h3 className="font-title text-xl font-bold text-ink">
            Por que alugar mobiliado por 30 a 180 dias em {name}?
          </h3>
          <p className="mt-3 leading-relaxed">
            A locação mensal mobiliada é feita para quem vai morar em {name} por algumas
            semanas ou meses: você entra com tudo pronto e a tranquilidade de um contrato
            formal de 30 a 180 dias, aceito em condomínios e com
            segurança para inquilino e proprietário. É o meio-termo entre a locação
            tradicional e a hospedagem por diária.
          </p>
          <p className="mt-3 leading-relaxed">
            Todos os imóveis do Viva Nomads em {name} são mobiliados e qualificados. Os que
            têm o selo <strong className="text-forest">{SELOS.prontoParaMorar.nome}</strong> são{" "}
            {SELOS.prontoParaMorar.resumo}; etiquetas como{" "}
            <strong className="text-forest">{SELOS.homeOffice.nome}</strong> ({SELOS.homeOffice.resumo})
            e <strong className="text-forest">{SELOS.bemLocalizado.nome}</strong> ({SELOS.bemLocalizado.resumo})
            ajudam quem trabalha remoto ou está em projeto temporário na cidade.
          </p>
        </div>


        <div className="mt-10 max-w-3xl" data-testid="faq-cidade">
          <h3 className="font-title text-xl font-bold text-ink">Perguntas frequentes sobre {name}</h3>
          <dl className="mt-3 space-y-4">
            {perguntasCidade(name).map((q) => (
              <div key={q.pergunta}>
                <dt className="font-semibold text-ink">{q.pergunta}</dt>
                <dd className="mt-1 text-muted">{q.resposta}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
