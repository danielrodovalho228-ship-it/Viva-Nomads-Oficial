import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isExemplo } from "@/lib/demo-listing";
import { listPropertiesByCity } from "@/lib/data/properties";
import { CITIES } from "@/lib/constants";
import { POLOS, acharPolo, imoveisDoPolo, tituloDoPolo, perguntasDoPolo } from "@/lib/polos";
import { calcularPrecosMedios, rotuloQuartos } from "@/lib/preco-medio";
import { PropertyCard } from "@/components/property-card";
import { ButtonLink } from "@/components/ui/button";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL } from "@/lib/site";
import { acharBairroCurado, bairrosDaGrade, imoveisDoBairro } from "@/lib/bairros";
import { BairroPagina, metadadosDoBairro, type BairroDados } from "@/components/cidades/bairro-pagina";
import { descricaoPolo } from "@/lib/seo/meta-descricao";
import { destinosAtivos } from "@/lib/data/tempos";

export const revalidate = 60;

interface Params {
  params: Promise<{ cidade: string; polo: string }>;
}

export function generateStaticParams() {
  return POLOS.map((p) => ({ cidade: p.cidade, polo: p.slug }));
}

/** O 2º trecho da URL é um polo (lista fixa) ou um BAIRRO com anúncio real (ordem 7000fbe0). */
async function acharBairro(cidadeSlug: string, cidadeNome: string, slug: string): Promise<BairroDados | null> {
  const imoveis = imoveisDoBairro(slug, await listPropertiesByCity(cidadeNome), isExemplo);
  if (imoveis.length > 0) return { slug, nome: imoveis[0].neighborhood.trim(), imoveis };
  // Bairro da lista curada sem anúncio real: página com estado vazio (noindex), nunca 404.
  const curado = acharBairroCurado(cidadeSlug, slug);
  return curado ? { slug, nome: curado.nome, imoveis: [] } : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { cidade, polo } = await params;
  const p = acharPolo(cidade, polo);
  const c = CITIES.find((x) => x.slug === cidade);
  if (!c) return { robots: { index: false } };
  if (!p) {
    const b = await acharBairro(cidade, c.name, polo);
    return b ? metadadosDoBairro(c, b) : { robots: { index: false } };
  }
  const title = `Imóveis mobiliados ${tituloDoPolo(p.nome)} · ${c.name}`;
  const description = descricaoPolo(p, c.name);
  const url = `/cidades/${cidade}/${polo}`;
  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: url },
    openGraph: { title, description, locale: "pt_BR", url, images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: title }] },
  };
}

export default async function PoloPage({ params }: Params) {
  const { cidade, polo } = await params;
  const p = acharPolo(cidade, polo);
  const c = CITIES.find((x) => x.slug === cidade);
  if (!c) notFound();
  if (!p) {
    const b = await acharBairro(cidade, c.name, polo);
    if (!b) notFound();
    const daCidade = await listPropertiesByCity(c.name);
    const vizinhos = bairrosDaGrade(cidade, daCidade, isExemplo).filter((x) => x.total > 0 && x.slug !== b.slug);
    return <BairroPagina cidade={c} bairro={b} vizinhos={vizinhos} totalCidade={daCidade.filter((i) => !isExemplo(i.id)).length} />;
  }

  const todos = await listPropertiesByCity(c.name);
  const imoveis = imoveisDoPolo(p, todos);
  const medias = calcularPrecosMedios(imoveis);
  const reais = imoveis.filter((i) => !isExemplo(i.id));
  const comMedia = medias.filter((g) => g.media !== null);
  const mediaGeral =
    comMedia.length > 0
      ? Math.round(comMedia.reduce((s, g) => s + (g.media as number) * g.anuncios, 0) / comMedia.reduce((s, g) => s + g.anuncios, 0))
      : null;
  const faq = perguntasDoPolo(p, c.name, mediaGeral);
  // Prompt 37: lista por TEMPO até cada destino ativo do polo (a página do polo continua sendo o guia do bairro).
  const destinosDoPolo = p.destinos?.length ? (await destinosAtivos()).filter((d) => p.destinos!.includes(d.slug)) : [];
  const url = `${SITE_URL}/cidades/${cidade}/${polo}`;

  const dados = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: c.name, item: `${SITE_URL}/cidades/${cidade}` },
          { "@type": "ListItem", position: 3, name: p.nome, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <JsonLd dados={dados} />
      <section className="bg-forest section-y text-white">
        <div className="container-page">
          <nav className="text-sm text-white/60">
            <Link href="/" className="hover:text-champagne">Início</Link> /{" "}
            <Link href={`/cidades/${cidade}`} className="hover:text-champagne">{c.name}</Link> /{" "}
            <span className="text-white/80">{p.nome}</span>
          </nav>
          <h1 className="mt-4 max-w-3xl font-title text-[28px] font-semibold">
            Imóveis mobiliados {tituloDoPolo(p.nome)}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">{p.intro}</p>
          <p className="mt-3 max-w-2xl text-sm text-white/70">{p.publico}</p>
        </div>
      </section>

      <section className="container-page section-y">
        <h2 className="font-title text-2xl font-semibold text-ink">
          {imoveis.length === 0 ? "Em breve, imóveis nesta região" : `${imoveis.length} ${imoveis.length === 1 ? "anúncio" : "anúncios"} nesta região`}
        </h2>
        {imoveis.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="polo-anuncios">
            {imoveis.map((i) => (
              <PropertyCard key={i.id} property={i} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-dashed border-sage-200 p-8 text-center">
            <p className="text-muted">Ainda não há imóveis publicados perto de {p.referencia}.</p>
            <ButtonLink href={`/cidades/${cidade}`} variant="outline" className="mt-4">
              Ver todos os imóveis em {c.name}
            </ButtonLink>
          </div>
        )}

        {destinosDoPolo.length > 0 && (
          <ul className="mt-6 space-y-1 text-sm" data-testid="polo-perto-de">
            {destinosDoPolo.map((d) => (
              <li key={d.slug}>
                <Link href={`/imoveis-perto-de/${d.slug}`} className="font-semibold text-forest underline">
                  Em ordem de tempo até {d.artigo ? `${d.artigo} ` : ""}{d.nome}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-12 max-w-3xl" data-testid="polo-precos">
          <h2 className="font-title text-2xl font-semibold text-ink">Valor médio por mês na região</h2>
          {medias.length === 0 || reais.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Dados insuficientes: a média aparece quando houver pelo menos 3 anúncios reais no mesmo grupo.</p>
          ) : (
            <ul className="mt-4 divide-y divide-sage-200 rounded-xl border border-sage-200">
              {medias.map((g) => (
                <li key={`${g.bairro}-${g.quartos}`} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-ink">{g.bairro} <span className="text-muted">· {rotuloQuartos(g.quartos)}</span></span>
                  <span className="shrink-0 text-right font-semibold text-forest">
                    {g.media === null ? <span className="text-sm font-normal text-muted">Dados insuficientes</span> : `R$ ${g.media.toLocaleString("pt-BR")} por mês`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-12 max-w-3xl" data-testid="polo-faq">
          <h2 className="font-title text-2xl font-semibold text-ink">Perguntas frequentes</h2>
          <dl className="mt-4 space-y-4">
            {faq.map((f) => (
              <div key={f.q}>
                <dt className="font-semibold text-ink">{f.q}</dt>
                <dd className="mt-1 text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
