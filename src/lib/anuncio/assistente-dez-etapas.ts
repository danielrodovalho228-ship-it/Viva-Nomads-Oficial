/**
 * Assistente de cadastro em 10 etapas (mockups aprovados em 23/10 20:48, docs/mockups/cadastro-imovel-01..10).
 * CAMPOS-3 (Pista B): o MAPA DE DADOS que as telas da Pista A consomem — que campo do anúncio cada etapa preenche e
 * quais itens da prontidão (src/lib/anuncio/prontidao.ts, a única regra de "pode publicar") ela resolve.
 * A etapa 10 ("Revise e publique") usa `conferenciaAssistente`: a lista de conferência agrupa os itens da prontidão
 * pelas etapas, sem regra nova. Puro: sem banco, sem tela. Detalhes e divergências em docs/specs/assistente-cadastro-dados.md.
 */
import type { Prontidao } from "./prontidao.ts";

export type IdEtapaAssistente =
  | "tipo"
  | "fotos"
  | "endereco"
  | "detalhes"
  | "comodidades"
  | "regras"
  | "descricao"
  | "preco"
  | "disponibilidade"
  | "revisao";

export interface EtapaAssistente {
  n: number;
  id: IdEtapaAssistente;
  titulo: string;
  /** Prefixo do arquivo em docs/mockups (desktop e mobile). */
  mockup: string;
  /** Campos de `Property` (src/lib/types.ts) que a etapa lê e grava. */
  campos: string[];
  /** Chaves dos itens da prontidão que se resolvem nesta etapa. */
  prontidao: string[];
}

export const ETAPAS_ASSISTENTE: readonly EtapaAssistente[] = [
  { n: 1, id: "tipo", titulo: "Tipo do imóvel", mockup: "cadastro-imovel-01-tipo", campos: ["propertyType"], prontidao: ["qualificacao"] },
  { n: 2, id: "fotos", titulo: "Fotos", mockup: "cadastro-imovel-02-fotos", campos: ["photos", "videoUrl", "videoArquivo"], prontidao: ["fotos"] },
  {
    n: 3,
    id: "endereco",
    titulo: "Endereço",
    mockup: "cadastro-imovel-03-endereco",
    campos: ["exactAddress", "neighborhood", "city", "state", "lat", "lng"],
    prontidao: ["endereco"],
  },
  { n: 4, id: "detalhes", titulo: "Detalhes", mockup: "cadastro-imovel-04-detalhes", campos: ["bedrooms", "bathrooms", "areaM2", "maxGuests"], prontidao: ["detalhes", "chacara", "sem_internet"] },
  {
    n: 5,
    id: "comodidades",
    titulo: "Comodidades",
    mockup: "cadastro-imovel-05-comodidades",
    campos: ["amenities", "internetMbps", "privacidade", "detalhesAnuncio"],
    prontidao: ["internet", "privacidade", "conforto"],
  },
  {
    n: 6,
    id: "regras",
    titulo: "Regras",
    mockup: "cadastro-imovel-06-regras",
    campos: ["regrasCasa", "petsAllowed", "smokingAllowed", "chegadaEPedido"],
    prontidao: ["tipo_entrada"],
  },
  { n: 7, id: "descricao", titulo: "Título e descrição", mockup: "cadastro-imovel-07-descricao", campos: ["title", "description", "furnished"], prontidao: ["titulo", "descricao"] },
  {
    n: 8,
    id: "preco",
    titulo: "Preço",
    mockup: "cadastro-imovel-08-preco",
    campos: ["monthlyPrice", "condoFee", "utilitiesMode", "utilitiesEstimate", "garantiasAceitas"],
    prontidao: ["preco", "garantia"],
  },
  {
    n: 9,
    id: "disponibilidade",
    titulo: "Disponibilidade",
    mockup: "cadastro-imovel-09-disponibilidade",
    campos: ["availableFrom", "availableUntil", "minPeriodDays", "bloqueios"],
    prontidao: ["periodo"],
  },
  // E104: quem opera, o documento da operação e o documento do imóvel ficam no cartão "Antes de publicar" da Revisão.
  { n: 10, id: "revisao", titulo: "Revise e publique", mockup: "cadastro-imovel-10-revisao", campos: ["ownershipType"], prontidao: ["limite", "documento", "sublocacao"] },
];

/** Etapa onde um item da prontidão se resolve; item desconhecido cai na revisão (nunca some da lista). */
export function etapaDoItemProntidao(chave: string): EtapaAssistente {
  return ETAPAS_ASSISTENTE.find((e) => e.prontidao.includes(chave)) ?? ETAPAS_ASSISTENTE[ETAPAS_ASSISTENTE.length - 1];
}

export interface ItemConferencia {
  /** Etapa do assistente (1..9) que o item representa. */
  etapa: number;
  id: IdEtapaAssistente;
  rotulo: string;
  ok: boolean;
  /** O que falta, nas palavras da prontidão (vazio quando ok). */
  faltam: string[];
}

/**
 * Lista de conferência da etapa 10. Uma linha por etapa 1..9 que tem item obrigatório nesta prontidão (no mockup:
 * Fotos, Endereço, Detalhes, Comodidades, Regras, Preço, Disponibilidade; "Tipo" e "Título e descrição" entram quando
 * têm obrigatório — a descrição é obrigatória para publicar, mesmo fora da lista do mockup). As etapas sem obrigatório
 * (ex.: Regras sem o tipo de entrada pendente) aparecem como feitas: o que nelas é opcional não segura a publicação.
 * `podePublicar` é o da prontidão; o item "Vaga no seu plano" (etapa 10) vai em `pendentesNaRevisao`.
 */
export function conferenciaAssistente(p: Prontidao): {
  itens: ItemConferencia[];
  pendentesNaRevisao: string[];
  podePublicar: boolean;
} {
  const porEtapa = new Map<number, { ok: boolean; faltam: string[] }>();
  const pendentesNaRevisao: string[] = [];
  for (const item of p.obrigatorios) {
    const e = etapaDoItemProntidao(item.key);
    const texto = item.detalhe ? `${item.label} (${item.detalhe})` : item.label;
    if (e.id === "revisao") {
      if (!item.ok) pendentesNaRevisao.push(texto);
      continue;
    }
    const atual = porEtapa.get(e.n) ?? { ok: true, faltam: [] };
    if (!item.ok) {
      atual.ok = false;
      atual.faltam.push(texto);
    }
    porEtapa.set(e.n, atual);
  }
  const SEMPRE = new Set<IdEtapaAssistente>(["fotos", "endereco", "detalhes", "comodidades", "regras", "preco", "disponibilidade"]);
  const itens: ItemConferencia[] = [];
  for (const e of ETAPAS_ASSISTENTE) {
    if (e.id === "revisao") continue;
    const estado = porEtapa.get(e.n);
    if (!estado && !SEMPRE.has(e.id)) continue;
    itens.push({ etapa: e.n, id: e.id, rotulo: e.titulo, ok: estado?.ok ?? true, faltam: estado?.faltam ?? [] });
  }
  return { itens, pendentesNaRevisao, podePublicar: p.podePublicar };
}
