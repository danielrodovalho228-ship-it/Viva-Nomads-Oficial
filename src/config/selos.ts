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
    resumo: "cômodo de trabalho, mesa, cadeira e internet informada pelo proprietário",
  },
  /** Prompt 57: os 4 essenciais + internet medida no imóvel que passa a regra de videochamada (config/internet.ts). */
  homeOfficeMedido: {
    nome: "Para trabalhar de casa · internet medida",
    resumo: "cômodo de trabalho, mesa, cadeira e internet medida no imóvel, boa para videochamadas",
  },
  bemLocalizado: {
    nome: "Bem localizado p/ trabalho",
    resumo: "coworkings e cafés de trabalho na região",
  },
  aceitoCondominio: {
    nome: "Aceito em condomínio",
    resumo: "condomínio ciente das estadias de 30 a 180 dias",
  },
  documentacaoConferida: {
    nome: "Documentação conferida",
    resumo: "a equipe conferiu o documento enviado do imóvel (não a titularidade)",
  },
  /** Ordem 512f3ed0: selos de estrutura. Só aparecem com TODOS os itens do checklist marcados (src/lib/selos-estrutura.ts). */
  acessivel: {
    nome: "Acessível",
    resumo: "entrada sem degrau ou rampa, elevador ou térreo, portas de 80 cm ou mais e banheiro adaptado",
  },
  mobilidadeReduzida: {
    nome: "Mobilidade reduzida / idosos",
    resumo: "barras de apoio no banheiro, piso antiderrapante, box sem degrau e cama em altura confortável",
  },
  pertoHospital: {
    nome: "Perto de hospital",
    resumo: "a até 2 km de um hospital da lista da cidade (calculado pela localização)",
  },
  pertoUniversidade: {
    nome: "Perto de universidade",
    resumo: "a até 2 km de uma universidade da lista da cidade (calculado pela localização)",
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

/**
 * Camada "Ideal para" (ordem 507074ce): derivada dos dados do anúncio por
 * src/lib/ideal-para.ts. Não é selo novo nem renomeia nenhum selo acima.
 */
export const IDEAL_PARA = {
  homeOfficeMedido: { nome: "Home office · internet medida", resumo: "mesa de trabalho e internet medida no imóvel, boa para videochamadas" },
  homeOffice: { nome: "Home office", resumo: "mesa de trabalho e internet informada" },
  familia: { nome: "Família", resumo: "2 ou mais quartos" },
  executivo: { nome: "Executivo", resumo: "mobiliado completo, com recibo para reembolso" },
  comPet: { nome: "Com pet", resumo: "aceita pet" },
} as const satisfies Record<string, SeloDef>;

export type IdealParaId = keyof typeof IDEAL_PARA;
