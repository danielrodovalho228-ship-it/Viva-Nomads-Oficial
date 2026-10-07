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

/** JSON seguro para <script>: escapa <, > e & (título é texto do usuário). */
export function jsonSeguro(dados: unknown): string {
  return JSON.stringify(dados).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
