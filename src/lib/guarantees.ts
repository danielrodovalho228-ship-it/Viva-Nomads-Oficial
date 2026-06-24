/*
  Modelo de dados — Garantia locatícia + Serviços adicionais (orientado a dados).

  Decisões travadas:
  - Garantia: UMA só por contrato (Lei 8.245, art. 37). A seleção é única.
  - Duas trilhas por duração: < 90 dias (temporada) e 90–180 dias (residencial).
  - Caução e título: ATIVOS, cobrem 1..180 dias. A plataforma registra e
    documenta — não retém dinheiro, não é garantidora.
  - Garantidor digital (parceiro): slot "Em breve" controlado por feature flag —
    vira selecionável SEM mexer em código (mudar a flag + status para 'ativo').
  - Serviços (ex.: Aqui Resolve): NÃO são garantia — seção separada, opcional, a
    plataforma só intermedeia e roteia o pagamento.

  Esta é a fonte de verdade do catálogo (mesmo formato da tabela em
  0014_guarantees_catalog.sql) — ligar um parceiro = editar um registro + flag.
*/

export type GarantiaTipo = "caucao" | "titulo" | "garantidor_digital";
export type CatalogStatus = "ativo" | "em_breve" | "inativo";
export type QuemPaga = "inquilino" | "proprietario";
export type ServicoCategoria = "assistencia_inquilino" | "manutencao_proprietario";

export interface Garantia {
  id: string;
  nome: string;
  tipo: GarantiaTipo;
  prazoMinDias: number;
  prazoMaxDias: number;
  quemPaga: QuemPaga;
  reembolsavel: boolean;
  status: CatalogStatus;
  parceiroNome: string | null;
  observacao: string | null;
}

export interface ServicoAdicional {
  id: string;
  nome: string;
  categoria: ServicoCategoria;
  quemPaga: QuemPaga;
  parceiroNome: string | null;
  status: CatalogStatus;
  descricao: string;
}

/**
 * Feature flag do garantidor digital. Desligada por padrão: o slot aparece como
 * "Em breve" e não é selecionável. Ligue (NEXT_PUBLIC_GARANTIDOR_DIGITAL_ATIVO=
 * true) + cadastre o parceiro (status 'ativo') para torná-lo selecionável, sem
 * mudar o fluxo.
 */
export const GARANTIDOR_DIGITAL_ATIVO =
  process.env.NEXT_PUBLIC_GARANTIDOR_DIGITAL_ATIVO === "true";

/** Texto jurídico canônico — sempre visível na etapa de garantia. */
export const REGRA_DE_OURO =
  "A plataforma conecta, verifica, documenta e registra — não é locadora, fiadora, garantidora nem executora.";

export const GARANTIAS: Garantia[] = [
  {
    id: "caucao",
    nome: "Caução",
    tipo: "caucao",
    prazoMinDias: 1,
    prazoMaxDias: 180,
    quemPaga: "inquilino",
    reembolsavel: true,
    status: "ativo",
    parceiroNome: null,
    observacao:
      "Depósito em conta vinculada (locador + locatário), devolvido ao fim. A plataforma registra; nunca recebe nem retém o valor.",
  },
  {
    id: "titulo",
    nome: "Título de capitalização",
    tipo: "titulo",
    prazoMinDias: 1,
    prazoMaxDias: 180,
    quemPaga: "inquilino",
    reembolsavel: true,
    status: "ativo",
    parceiroNome: null,
    observacao: "Resgatável ao fim do contrato. A plataforma documenta o número do título.",
  },
  {
    id: "garantidor_digital",
    nome: "Garantidor digital",
    tipo: "garantidor_digital",
    prazoMinDias: 90,
    prazoMaxDias: 180,
    quemPaga: "inquilino",
    reembolsavel: false,
    // Selecionável só quando a flag liga E um parceiro estiver cadastrado.
    status: GARANTIDOR_DIGITAL_ATIVO ? "ativo" : "em_breve",
    parceiroNome: null,
    observacao: null,
  },
];

export const SERVICOS_ADICIONAIS: ServicoAdicional[] = [
  {
    id: "assistencia_24h",
    nome: "Assistência 24h",
    categoria: "assistencia_inquilino",
    quemPaga: "inquilino",
    parceiroNome: null,
    status: "em_breve",
    descricao:
      "Chaveiro, encanador, elétrica e mais — acionável a qualquer hora. A plataforma intermedeia e roteia o pagamento ao prestador; não executa o serviço.",
  },
  {
    id: "plano_manutencao",
    nome: "Plano de manutenção",
    categoria: "manutencao_proprietario",
    quemPaga: "proprietario",
    parceiroNome: null,
    status: "em_breve",
    descricao:
      "Manutenção preventiva e corretiva do imóvel. A plataforma intermedeia e roteia o pagamento ao prestador; não executa o serviço.",
  },
];

/**
 * Garantias ELEGÍVEIS para a duração da estadia (em dias): o prazo da garantia
 * cobre a duração. Inclui "em_breve" (mostradas como slot desabilitado);
 * exclui "inativo". Ex.: < 90 dias → caução e título; 90–180 → + garantidor.
 */
export function garantiasElegiveis(duracaoDias: number): Garantia[] {
  return GARANTIAS.filter(
    (g) =>
      g.status !== "inativo" &&
      g.prazoMinDias <= duracaoDias &&
      duracaoDias <= g.prazoMaxDias
  );
}

/** Uma garantia pode ser SELECIONADA? (somente status 'ativo'). */
export function garantiaSelecionavel(g: Garantia): boolean {
  return g.status === "ativo";
}

/** Serviços adicionais disponíveis (status 'ativo'); opcionais e combináveis. */
export function servicosDisponiveis(): ServicoAdicional[] {
  return SERVICOS_ADICIONAIS.filter((s) => s.status === "ativo");
}

/**
 * Serviços VISÍVEIS: mostra também os "em_breve" (como slot desabilitado, para
 * sinalizar o que vem); esconde só os "inativo". Simétrico a garantiasElegiveis.
 */
export function servicosVisiveis(): ServicoAdicional[] {
  return SERVICOS_ADICIONAIS.filter((s) => s.status !== "inativo");
}

/** Um serviço pode ser SELECIONADO/contratado? (somente status 'ativo'). */
export function servicoSelecionavel(s: ServicoAdicional): boolean {
  return s.status === "ativo";
}
