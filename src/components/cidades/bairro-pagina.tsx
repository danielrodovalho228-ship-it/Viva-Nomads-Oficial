import type { Metadata } from "next";
import Link from "next/link";
import { isExemplo } from "@/lib/demo-listing";
import { PONTOS_REFERENCIA } from "@/config/pontos-referencia";
import { CITIES } from "@/lib/constants";
import { calcularPrecosMedios, rotuloQuartos } from "@/lib/preco-medio";
import { type BairroResumo, centroDoBairro, distanciasDoBairro, perguntasDoBairro, resumoDoBairro } from "@/lib/bairros";
import { SalvarBusca } from "@/components/busca/salvar-busca";
import { PropertyCard } from "@/components/property-card";
import { PropertyMap } from "@/components/property-map-lazy";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL } from "@/lib/site";
import { descricaoBairro } from "@/lib/seo/meta-descricao";
import type { Property } from "@/lib/types";

type Cidade = (typeof CITIES)[number];
export interface BairroDados {
  slug: string;
  nome: string;
  imoveis: Property[];
}

export function metadadosDoBairro(cidade: Cidade, b: BairroDados): Metadata {
  const semImovel = b.imoveis.filter((i) => !isExemplo(i.id)).length === 0;
  const title = `Imóveis mobiliados em ${b.nome} · ${cidade.name}`;
  const description = descricaoBairro(b.nome, cidade.name);
  const url = `/cidades/${cidade.slug}/${b.slug}`;
  return {
    title,
    description,
    robots: semImovel ? { index: false, follow: true } : { index: true, follow: true },
    alternates: { canonical: url },
    openGraph: { title, description, locale: "pt_BR", url, images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: title }] },
  };
}

/** Página de bairro (ordem 7000fbe0, tela 5). Só existe com anúncio real; sem endereço e sem coordenada exata. */
export function BairroPagina({ cidade, bairro, vizinhos = [], totalCidade = 0 }: { cidade: Cidade; bairro: BairroDados; vizinhos?: BairroResumo[]; totalCidade?: number }) {
  const url = `${SITE_URL}/cidades/${cidade.slug}/${bairro.slug}`;
  const medias = calcularPrecosMedios(bairro.imoveis);
  const comMedia = medias.filter((g) => g.media !== null);
  const mediaGeral =
    comMedia.length > 0
      ? Math.round(comMedia.reduce((s, g) => s + (g.media as number) * g.anuncios, 0) / comMedia.reduce((s, g) => s + g.anuncios, 0))
      : null;
  const centro = centroDoBairro(bairro.imoveis);
  const distancias = distanciasDoBairro(centro, PONTOS_REFERENCIA.filter((p) => p.cidade === cidade.slug));
  const total = bairro.imoveis.filter((i) => !isExemplo(i.id)).length;
  const faq = perguntasDoBairro(bairro.nome, cidade.name, mediaGeral, total);

  const dados = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#pagina`,
        url,
        name: `Imóveis mobiliados em ${bairro.nome}, ${cidade.name}`,
        about: { "@type": "Place", name: `${bairro.nome}, ${cidade.name}` },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: cidade.name, item: `${SITE_URL}/cidades/${cidade.slug}` },
          { "@type": "ListItem", position: 3, name: bairro.nome, item: url },
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
            <Link href={`/cidades/${cidade.slug}`} className="hover:text-champagne">{cidade.name}</Link> /{" "}
            <span className="text-white/80">{bairro.nome}</span>
          </nav>
          <h1 className="mt-4 max-w-3xl font-title text-[28px] font-semibold">Imóveis mobiliados em {bairro.nome}</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80" data-testid="bairro-resumo">{resumoDoBairro(bairro.nome, cidade.name, total)}</p>
        </div>
      </section>

      <section className="container-page section-y">
        <div className="grid gap-8 lg:grid-cols-2">
          {centro && (
            <div data-testid="bairro-mapa">
              <h2 className="font-title text-2xl font-semibold text-ink">Área aproximada</h2>
              <PropertyMap className="mt-4 aspect-[16/10] w-full" center={centro} markers={[]} approximate />
              <p className="mt-2 text-sm text-muted">Mapa da região. O endereço exato só é liberado depois do aceite.</p>
            </div>
          )}
          {distancias.length > 0 && (
            <div data-testid="bairro-distancias">
              <h2 className="font-title text-2xl font-semibold text-ink">Distâncias</h2>
              <ul className="mt-4 divide-y divide-sage-200 rounded-xl border border-sage-200">
                {distancias.map((d) => (
                  <li key={d.slug} className="flex items-center justify-between gap-4 px-4 py-3">
                    <span className="text-ink">{d.nome}</span>
                    <span className="shrink-0 font-semibold text-forest">{d.texto}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {total === 0 ? (
          <div className="mt-12 rounded-xl border border-dashed border-sage-200 p-8 text-center" data-testid="bairro-vazio">
            <p className="font-semibold text-ink">Ainda não há imóveis mobiliados publicados no {bairro.nome}</p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
              Salve esta busca e avisamos quando o primeiro imóvel for publicado.
            </p>
            <div className="mt-4 flex justify-center">
              <SalvarBusca versao={bairro.slug} qs={`?local=${encodeURIComponent(`${bairro.nome}, ${cidade.name}`)}`} rotulo="Avise-me quando houver" rotuloSalva="Aviso ativado" />
            </div>
            <p className="mt-4 text-sm">
              <Link href={`/buscar?${new URLSearchParams({ local: cidade.name }).toString()}`} className="font-semibold text-forest hover:underline" data-testid="bairro-ver-cidade">
                Ver {totalCidade > 0 ? `todos os ${totalCidade} ${totalCidade === 1 ? "imóvel" : "imóveis"}` : "todos os imóveis"} em {cidade.name}
              </Link>
            </p>
            {vizinhos.length > 0 && (
              <p className="mt-4 text-sm text-muted" data-testid="bairro-vizinhos">
                Veja também:{" "}
                {vizinhos.map((v, k) => (
                  <span key={v.slug}>
                    {k > 0 && ", "}
                    <Link href={`/cidades/${cidade.slug}/${v.slug}`} className="font-semibold text-forest hover:underline">
                      {v.nome} ({v.total} {v.total === 1 ? "imóvel" : "imóveis"})
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </div>
        ) : (
          <>
            <h2 className="mt-12 font-title text-2xl font-semibold text-ink">
              {total} {total === 1 ? "anúncio" : "anúncios"} em {bairro.nome}
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="bairro-anuncios">
              {bairro.imoveis.map((i) => (
                <PropertyCard key={i.id} property={i} />
              ))}
            </div>
            <p className="mt-6 text-sm">
              <Link href={`/buscar?${new URLSearchParams({ local: cidade.name }).toString()}`} className="font-semibold text-forest hover:underline" data-testid="bairro-ver-cidade">
                Ver {totalCidade > 0 ? `todos os ${totalCidade} ${totalCidade === 1 ? "imóvel" : "imóveis"}` : "todos os imóveis"} em {cidade.name}
              </Link>
            </p>
          </>
        )}

        <div className="mt-12 max-w-3xl" data-testid="bairro-precos">
          <h2 className="font-title text-2xl font-semibold text-ink">Valor médio por mês no bairro</h2>
          {comMedia.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Dados insuficientes: a média aparece quando houver pelo menos 3 anúncios reais no mesmo grupo.</p>
          ) : (
            <ul className="mt-4 divide-y divide-sage-200 rounded-xl border border-sage-200">
              {comMedia.map((g) => (
                <li key={`${g.bairro}-${g.quartos}`} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-ink"><span className="text-muted">{rotuloQuartos(g.quartos)}</span></span>
                  <span className="shrink-0 font-semibold text-forest">R$ {(g.media as number).toLocaleString("pt-BR")} por mês</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-12 max-w-3xl" data-testid="bairro-faq">
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
