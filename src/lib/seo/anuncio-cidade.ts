/*
  Dados estruturados do anúncio e da página de cidade — construtores PUROS e testáveis.
  Só fatos que o site já publica. Localização aproximada: cidade/bairro, NUNCA endereço
  completo nem coordenada (o endereço só é liberado após o aceite).
*/

import { calcularTudoIncluido, type CamposTotalMes } from "../precos.ts";

export interface AnuncioParaSchema extends Partial<Omit<CamposTotalMes, "monthlyPrice">> {
  id: string;
  monthlyPrice: number;
  city: string;
  state: string;
  neighborhood?: string;
  bedrooms: number;
  bathrooms: number;
  areaM2: number;
  minPeriodDays: number;
  maxPeriodDays?: number;
  furnished?: boolean;
}

/** O que o preço da oferta inclui (E98-A). */
export const DESCRICAO_PRECO_MES = "Valor do mês com condomínio e contas fixas incluídos";

/** Limite de estadia da plataforma (regra de negócio: 30 a 180 dias). */
const MAXIMO_PADRAO_DIAS = 180;

/**
 * Oferta (Offer) do anúncio, com o imóvel como Accommodation: preço mensal,
 * estadia mínima/máxima, mobiliado, disponibilidade, cidade e bairro.
 * `disponibilidade` já vem em URL schema.org (InStock/PreOrder/OutOfStock).
 */
export function ofertaDoAnuncio(siteUrl: string, p: AnuncioParaSchema, disponibilidade: string) {
  const url = `${siteUrl}/imoveis/${p.id}`;
  // O preço é o TOTAL do mês (a mesma conta do cartão e da página), não só o valor mensal.
  const totalMes = calcularTudoIncluido(p as CamposTotalMes).total;
  return {
    "@type": "Offer" as const,
    "@id": `${url}#oferta`,
    url,
    priceCurrency: "BRL",
    price: totalMes,
    description: DESCRICAO_PRECO_MES,
    // O preço é por mês.
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: totalMes,
      priceCurrency: "BRL",
      unitCode: "MON",
      referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
    },
    availability: disponibilidade,
    eligibleDuration: {
      "@type": "QuantitativeValue",
      minValue: p.minPeriodDays,
      maxValue: p.maxPeriodDays ?? MAXIMO_PADRAO_DIAS,
      unitCode: "DAY",
    },
    itemOffered: {
      "@type": "Accommodation",
      "@id": `${url}#imovel`,
      numberOfBedrooms: p.bedrooms,
      numberOfBathroomsTotal: p.bathrooms,
      floorSize: { "@type": "QuantitativeValue", value: p.areaM2, unitCode: "MTK" },
      amenityFeature: [{ "@type": "LocationFeatureSpecification", name: "Mobiliado", value: p.furnished !== false }],
      address: { "@type": "PostalAddress", addressLocality: p.city, ...(p.state?.trim() ? { addressRegion: p.state.trim().toUpperCase() } : {}), addressCountry: "BR" },
      ...(p.neighborhood ? { containedInPlace: { "@type": "Place", name: p.neighborhood } } : {}),
    },
  };
}

export interface PerguntaCidade {
  pergunta: string;
  resposta: string;
}

/** Perguntas da página de cidade. A MESMA lista aparece na tela e no FAQPage. Texto fixo, sem número de mercado. */
export function perguntasCidade(cidade: string): PerguntaCidade[] {
  return [
    {
      pergunta: `Por quanto tempo posso ficar em ${cidade}?`,
      resposta: "As estadias vão de 30 a 180 dias, com contrato registrado na plataforma.",
    },
    {
      pergunta: `Os imóveis em ${cidade} são mobiliados?`,
      resposta: "Sim. Todos os anúncios são de imóveis mobiliados, e o anúncio mostra o que está incluso.",
    },
    {
      pergunta: "Como funciona a garantia?",
      resposta:
        "A garantia é a Caução, combinada entre as partes no contrato. A Viva Nomads não recebe nem guarda o dinheiro de ninguém.",
    },
    {
      pergunta: "Vejo o endereço completo antes de fechar?",
      resposta: "Não. O anúncio mostra cidade e bairro. O endereço completo é liberado só depois do aceite.",
    },
    {
      pergunta: "Quanto custa anunciar?",
      resposta:
        "Anunciar não tem mensalidade. A taxa é cobrada só sobre o valor total do contrato fechado e é menor para quem tem mais imóveis. Veja os detalhes em Preços.",
    },
  ];
}

/** FAQPage da cidade, montado a partir de `perguntasCidade`. */
export function faqPageCidade(cidade: string) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage" as const,
    mainEntity: perguntasCidade(cidade).map((p) => ({
      "@type": "Question" as const,
      name: p.pergunta,
      acceptedAnswer: { "@type": "Answer" as const, text: p.resposta },
    })),
  };
}
