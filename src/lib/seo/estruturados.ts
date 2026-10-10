/*
  Dados estruturados (JSON-LD, schema.org) — construtores PUROS e testáveis.
  Só fatos que o site já publica: nada de nota, avaliação ou preço inventado.
*/
import { FAQ } from "../atendimento/faq.ts";
import { PLANOS } from "../../config/planos.ts";

export const ORG = { nome: "Viva Nomads", url: "https://vivanomads.com.br" } as const;

export function organizacao(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organizacao`,
        name: ORG.nome,
        url: siteUrl,
        logo: `${siteUrl}/icon-512.png`,
        description: "Plataforma de locação de imóveis mobiliados por temporada, de 30 a 180 dias, com contrato e conversa registrada na plataforma.",
        areaServed: { "@type": "Country", name: "Brasil" },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#site`,
        url: siteUrl,
        name: ORG.nome,
        inLanguage: "pt-BR",
        publisher: { "@id": `${siteUrl}/#organizacao` },
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteUrl}/buscar?local={local}`,
          "query-input": "required name=local",
        },
      },
    ],
  };
}

/** FAQPage da Central de Ajuda: as mesmas perguntas e respostas da tela. */
export function faqPage() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((p) => ({
      "@type": "Question",
      name: p.pergunta,
      acceptedAnswer: { "@type": "Answer", text: p.resposta },
    })),
  };
}

/** Planos de /precos como ofertas (Gestor é sob consulta: sem preço). */
export function ofertasPlanos(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Planos para proprietários — Viva Nomads",
    itemListElement: PLANOS.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Offer",
        name: `Plano ${p.nome}`,
        description: p.publico,
        url: `${siteUrl}/precos`,
        seller: { "@type": "Organization", name: ORG.nome },
        ...(p.precoMensal !== null
          ? {
              priceSpecification: {
                "@type": "UnitPriceSpecification",
                price: p.precoMensal,
                priceCurrency: "BRL",
                unitText: "MONTH",
              },
            }
          : {}),
      },
    })),
  };
}

/** Lista da busca: só imóveis REAIS (os de exemplo nunca entram). */
export function listaImoveis(siteUrl: string, imoveis: { id: string; title: string }[], ehExemplo: (id: string) => boolean) {
  const reais = imoveis.filter((p) => !ehExemplo(p.id)).slice(0, 50);
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Imóveis mobiliados para locação por temporada",
    numberOfItems: reais.length,
    itemListElement: reais.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${siteUrl}/imoveis/${p.id}`, name: p.title })),
  };
}

/** Página da cidade (#34): Place (a cidade) + ItemList só com imóveis reais (lista vazia é honesta). */
export function paginaCidade(
  siteUrl: string,
  cidade: { slug: string; name: string; state: string },
  imoveis: { id: string; title: string }[],
  ehExemplo: (id: string) => boolean
) {
  const url = `${siteUrl}/cidades/${cidade.slug}`;
  const { numberOfItems, itemListElement } = listaImoveis(siteUrl, imoveis, ehExemplo);
  const lugar = {
    "@type": "Place",
    "@id": `${url}#cidade`,
    name: `${cidade.name}, ${cidade.state}`,
    url,
    address: { "@type": "PostalAddress", addressLocality: cidade.name, addressRegion: cidade.state, addressCountry: "BR" },
  };
  const lista = {
    "@type": "ItemList",
    "@id": `${url}#imoveis`,
    name: `Imóveis mobiliados por temporada em ${cidade.name}`,
    url,
    about: { "@id": `${url}#cidade` },
    numberOfItems,
    itemListElement,
  };
  return { "@context": "https://schema.org", "@graph": [lugar, lista] as [typeof lugar, typeof lista] };
}

/** /para-proprietarios (#34): o serviço oferecido ao proprietário. Preço fica nas ofertas de /precos. */
export function servicoProprietarios(siteUrl: string, cidades: { name: string; state: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${siteUrl}/para-proprietarios#servico`,
    name: "Anúncio e gestão de locação por temporada para proprietários",
    serviceType: "Locação por temporada de imóveis mobiliados (30 a 180 dias)",
    description:
      "Anuncie seu imóvel mobiliado para locação por temporada de 30 a 180 dias, com contrato e conversa registrada na plataforma.",
    url: `${siteUrl}/para-proprietarios`,
    provider: { "@type": "Organization", "@id": `${siteUrl}/#organizacao`, name: ORG.nome, url: siteUrl },
    areaServed: cidades.map((c) => ({ "@type": "City", name: `${c.name}, ${c.state}` })),
    audience: { "@type": "Audience", audienceType: "Proprietários de imóveis mobiliados" },
    offers: { "@type": "Offer", url: `${siteUrl}/precos`, seller: { "@type": "Organization", name: ORG.nome } },
  };
}

/** Páginas institucionais (#38: /como-funciona, /empresas): WebPage ligada ao site. Só texto fixo, nunca do usuário. */
export function paginaInstitucional(siteUrl: string, p: { caminho: string; nome: string; descricao: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage" as const,
    "@id": `${siteUrl}${p.caminho}#pagina`,
    name: p.nome,
    description: p.descricao,
    url: `${siteUrl}${p.caminho}`,
    inLanguage: "pt-BR",
    isPartOf: { "@type": "WebSite", "@id": `${siteUrl}/#site`, name: ORG.nome, url: siteUrl },
  };
}

/** JSON seguro para <script>: escapa <, > e & (título é texto do usuário). */
export function jsonSeguro(dados: unknown): string {
  return JSON.stringify(dados).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
