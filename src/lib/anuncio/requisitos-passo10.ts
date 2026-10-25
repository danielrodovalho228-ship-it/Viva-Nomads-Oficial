/*
  E132-A, Parte C — REQUISITOS LEGAIS NO PASSO 10 (PURO). A antiga tela "Antes de anunciar" (/qualificar) pedia seis
  respostas; agora quatro saem do próprio cadastro e só três viram declaração de um toque no cartão "Antes de publicar":
   • mobiliado        ← o mobiliado do anúncio (Passo 7 / comodidade "mobiliado");
   • aceita 30 dias   ← sempre (o Passo 9 não aceita menos de 30 dias);
   • proprietário ou procurador ← "Quem opera este imóvel?" do mesmo cartão;
   • documento        ← o documento do mesmo cartão;
   • IPTU em dia e água, luz e gás funcionando ← declarações novas (toggle E56);
   • convenção do condomínio ← só nos tipos em condomínio (Sim / Não sei / Não); casa e chácara contam como "Sim".
  isEligible (lib/qualification.ts) segue a regra: "Não sei" publica com pendência; "Não" bloqueia.
*/
import type { EligibilityState, QualityState } from "../qualification.ts";

export type RespostaConvencao = "" | "yes" | "unknown" | "no";

export interface DeclaracoesPasso10 {
  iptuOk: boolean;
  habitavel: boolean;
  convencao: RespostaConvencao;
}

export const DECLARACOES_VAZIAS: DeclaracoesPasso10 = { iptuOk: false, habitavel: false, convencao: "" };

export const TEXTO_IPTU = "IPTU em dia";
export const TEXTO_HABITAVEL = "Água, luz e gás funcionando";
export const PERGUNTA_CONVENCAO = "A convenção do condomínio permite moradia mobiliada de 30 a 180 dias?";
export const COMO_DESCOBRIR_CONVENCAO = "Pergunte ao síndico ou consulte a convenção — em geral está no capítulo de uso das unidades.";
export const OPCOES_CONVENCAO = [
  { valor: "yes", rotulo: "Sim" },
  { valor: "unknown", rotulo: "Não sei" },
  { valor: "no", rotulo: "Não" },
] as const;

/** Alguma declaração já dita (rascunho com resposta não é sobrescrito pela qualificação antiga do servidor). */
export const declaracoesRespondidas = (d: DeclaracoesPasso10) => d.iptuOk || d.habitavel || d.convencao !== "";

/** As notas de qualidade vazias (a qualificação antiga ainda grava a coluna; o nível do anúncio é a fonte de verdade). */
export const QUALIDADE_INICIAL: QualityState = {
  furnishedFull: false,
  kitchenEquipped: false,
  beddingTowels: false,
  appliancesOk: false,
  internetTier: "basica",
  climateControl: false,
  cleanConserved: false,
  hasHomeOffice: false,
  hasDesk: false,
  hasChair: false,
  coworking2km: false,
  meetingRoom: false,
  cafe1km: false,
};

export function declaracoesDoRascunho(v: unknown): DeclaracoesPasso10 {
  if (!v || typeof v !== "object") return DECLARACOES_VAZIAS;
  const o = v as Record<string, unknown>;
  const conv = o.convencao;
  return {
    iptuOk: o.iptuOk === true,
    habitavel: o.habitavel === true,
    convencao: conv === "yes" || conv === "unknown" || conv === "no" ? conv : "",
  };
}

/** A elegibilidade derivada do cadastro (o que grava em qualification_checklists). */
export function elegibilidadeDoCadastro(i: {
  mobiliado: boolean;
  minimoDias: number;
  operacaoDeclarada: boolean;
  documentoEnviado: boolean;
  emCondominio: boolean;
  declaracoes: DeclaracoesPasso10;
}): EligibilityState {
  return {
    furnished: i.mobiliado,
    accepts30days: !(i.minimoDias > 0 && i.minimoDias < 30),
    iptuOk: i.declaracoes.iptuOk,
    habitable: i.declaracoes.habitavel,
    isOwnerOrAgent: i.operacaoDeclarada,
    hasDocument: i.documentoEnviado,
    condoAllows: i.emCondominio ? i.declaracoes.convencao : "yes",
  };
}
