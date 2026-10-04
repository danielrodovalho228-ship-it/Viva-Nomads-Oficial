/**
 * SELOS E ETIQUETAS — fonte ÚNICA do nome + critério + texto curto de cada selo.
 *
 * Antes, o nome e a explicação de cada selo eram reescritos em prosa em cada
 * página (home, cidade, para-proprietários, como-funciona) e divergiam. Aqui fica
 * a definição canônica; os componentes de badge (badge.tsx) e os textos das
 * páginas consomem daqui, para dizerem sempre a MESMA coisa.
 *
 * Regra de vocabulário (ver scripts/check-consistency.mjs): "Documentação
 * conferida" nunca vira "propriedade verificada" — o selo confirma o DOCUMENTO
 * do imóvel, não a titularidade.
 */
export interface SeloDef {
  /** Rótulo exibido (o mesmo no badge e no texto). */
  nome: string;
  /** Frase curta do que o selo significa (critério objetivo, sem promessa). */
  resumo: string;
}

export const SELOS = {
  prontoParaMorar: {
    nome: "Pronto para Morar",
    resumo: "mobiliado e equipado para morar desde o primeiro dia",
  },
  homeOffice: {
    nome: "Para trabalhar de casa",
    resumo: "cômodo de trabalho, mesa e internet boa para o home office",
  },
  bemLocalizado: {
    nome: "Bem localizado p/ trabalho",
    resumo: "coworkings e cafés de trabalho na região",
  },
  aceitoCondominio: {
    nome: "Aceito em condomínio",
    resumo: "condomínio ciente da locação por temporada",
  },
  documentacaoConferida: {
    nome: "Documentação conferida",
    resumo: "a equipe conferiu o documento enviado do imóvel (não a titularidade)",
  },
} as const satisfies Record<string, SeloDef>;

/** Critérios objetivos do selo "Pronto para Morar" (espelham qualification.ts). */
export const PRONTO_PARA_MORAR_CRITERIOS = [
  "mobília",
  "cozinha equipada",
  "roupa de cama",
  "eletrodomésticos",
  "internet",
  "climatização",
  "limpeza",
] as const;
