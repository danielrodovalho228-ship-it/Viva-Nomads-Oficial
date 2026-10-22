import { descricaoCidade } from "@/lib/cidades-meta";
import { isExemplo } from "@/lib/demo-listing";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
import { bairrosDaGrade } from "@/lib/bairros";
import { tituloContagemCidade } from "@/lib/cidades";
import { MapPin } from "lucide-react";
import { faqPageCidade, perguntasCidade } from "@/lib/seo/anuncio-cidade";

// F9: dados frescos (revalidatePath nas ações + rede de segurança de 60 s).
export const revalidate = 60;

interface Params {
  params: Promise<{ cidade: string }>;
}

/**
 * Cidade válida (QA do Moacir, 17/10): está na lista liberada (CITIES) OU tem anúncio REAL ativo
 * (o breadcrumb do anúncio aponta para cá). Qualquer outro slug (/cidades/xpto123) é 404 com noindex.
 */
async function cidadeValida(cidade: string): Promise<boolean> {
  if (CITIES.some((c) => c.slug === cidade)) return true;
  if (!/^[a-z0-9-]{2,60}$/.test(cidade)) return false;
  const imoveis = await listPropertiesByCity(cityFromSlug(cidade));
  return imoveis.some((p) => !isExemplo(p));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { cidade } = await params;
  // Fora da lista: a página chama notFound() e o Next põe o noindex do 404 sozinho.
  if (!(await cidadeValida(cidade))) return { title: "Página não encontrada" };
  const name = cityFromSlug(cidade);
  const title = `Imóveis mobiliados mensais em ${name}`;
  const description = descricaoCidade(name);
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
  if (!(await cidadeValida(cidade))) notFound();
  const name = cityFromSlug(cidade);
  const properties = await listPropertiesByCity(name);
  const infoCidade = CITIES.find((c) => c.slug === cidade);
  const precosMedios = calcularPrecosMedios(properties);
  const bairros = bairrosDaGrade(cidade, properties, isExemplo);
  const atualizadoEm = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());

  return (
    <>
      {infoCidade && <JsonLd dados={paginaCidade(SITE_URL, infoCidade, properties, (id) => isExemplo(id))} />}
      {infoCidade && <JsonLd dados={faqPageCidade(name)} />}
      <section className="bg-forest section-y text-white">
        <div className="container-page">
          <nav className="text-sm text-white/60">
            <Link href="/" className="underline-offset-4 hover:underline">
              Início
            </Link>{" "}
            / <span className="text-white/80">{name}</span>
          </nav>
          <h1 className="mt-4 max-w-3xl font-title text-2xl font-semibold md:text-[28px]">
            Imóveis mobiliados mensais em {name}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/80">
            Imóveis mobiliados e prontos para morar em {name}, para estadias de 30 a 180 dias.
            Para executivos em transferência, profissionais de saúde, famílias em transição,
            estudantes e nômades digitais — instalados e em casa desde o primeiro dia.
          </p>
        </div>
      </section>

      <section className="container-page section-y">
        <div className="flex items-center justify-between">
          <h2 className="font-title text-2xl font-semibold tabular-nums text-ink">
            {tituloContagemCidade(
              properties.filter((p) => !isExemplo(p.id)).length,
              properties.filter((p) => isExemplo(p.id)).length,
              name,
            )}
          </h2>
          <ButtonLink href="/buscar" variant="outline" size="sm">
            Ver toda a busca
          </ButtonLink>
        </div>

        {properties.length > 0 ? (
          <div className="mt-8 grid auto-rows-fr gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4" data-testid="cidade-imoveis">
            {properties.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-dashed border-line p-12 text-center">
            <p className="text-muted">
              Ainda não há imóveis publicados em {name}. É proprietário aqui?
            </p>
            <ButtonLink href="/dashboard/imoveis/novo" variant="primary" className="mt-4">
              Anuncie seu imóvel em {name}
            </ButtonLink>
          </div>
        )}

        {precosMedios.length > 0 && (
          <div className="mt-12 max-w-3xl" data-testid="precos-medios">
            <h2 className="font-title text-2xl font-semibold text-ink">Valor médio por mês em {name}</h2>
            <p className="mt-2 text-sm text-muted">
              Média dos anúncios publicados na Viva, por bairro e número de quartos. Só mostramos a média
              quando há pelo menos 3 anúncios no grupo. Atualizado em {atualizadoEm}.
            </p>
            <ul className="mt-4 divide-y divide-divisor rounded-xl border border-line">
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

        {bairros.length > 0 && (
          <div className="mt-12" data-testid="bairros-grade">
            <h2 className="font-title text-2xl font-semibold text-ink">Bairros de {name}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {bairros.map((b) => (
                <li key={b.slug}>
                  <Link
                    href={`/cidades/${cidade}/${b.slug}`}
                    data-testid="bairro-cartao"
                    className="flex items-center gap-4 rounded-xl border border-line p-4 hover:border-ink"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink" aria-hidden>
                      <MapPin className="h-6 w-6" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{b.nome}</span>
                      <span className="block text-sm text-muted">{b.total === 0 ? "Sem imóveis no momento" : `${b.total} ${b.total === 1 ? "imóvel" : "imóveis"}`}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {polosDaCidade(cidade).length > 0 && (
          <div className="mt-12 max-w-3xl" data-testid="polos-da-cidade">
            <h2 className="font-title text-2xl font-semibold text-ink">Por região de {name}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {polosDaCidade(cidade).map((p) => (
                <li key={p.slug}>
                  <Link href={`/cidades/${cidade}/${p.slug}`} className="block rounded-xl border border-line p-4 font-semibold text-ink hover:border-ink">
                    {p.nome}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Texto otimizado para SEO */}
        <div className="prose mt-12 max-w-3xl text-muted">
          <h3 className="font-title text-xl font-semibold text-ink">
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
            têm o selo <strong className="text-ink">{SELOS.prontoParaMorar.nome}</strong> são{" "}
            {SELOS.prontoParaMorar.resumo}; etiquetas como{" "}
            <strong className="text-ink">{SELOS.homeOffice.nome}</strong> ({SELOS.homeOffice.resumo})
            e <strong className="text-ink">{SELOS.bemLocalizado.nome}</strong> ({SELOS.bemLocalizado.resumo})
            ajudam quem trabalha remoto ou está em projeto temporário na cidade.
          </p>
        </div>


        <div className="mt-10 max-w-3xl" data-testid="faq-cidade">
          <h3 className="font-title text-xl font-semibold text-ink">Perguntas frequentes sobre {name}</h3>
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
