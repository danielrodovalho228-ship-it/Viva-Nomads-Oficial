/**
 * Seleção do modelo de contrato por FAIXA DE PRAZO (Onda 1 · Dra. Beatriz).
 *
 * ESTRUTURA apenas — o TEXTO jurídico NÃO é escrito aqui. Cada faixa tem um
 * modelo (tabela `modelos_contrato`, migração 0022 + tipo_imovel na 0025) cujo
 * `conteudo` começa vazio ("aguardando texto jurídico da advogada"). O sistema
 * seleciona automaticamente o modelo ATIVO da faixa correspondente ao prazo.
 *
 * Os pontos onde entrarão as cláusulas que a advogada vai redigir estão
 * marcados em `CLAUSULAS_PLACEHOLDER` — só o LOCAL, sem o texto.
 */

import { FAIXAS, type FaixaPrazo } from "@/lib/faixas";

export interface ModeloContratoRef {
  faixa: FaixaPrazo;
  titulo: string;
  /** true enquanto o `conteudo` no banco estiver vazio (texto jurídico pendente). */
  textoPendente: boolean;
}

/** Título do modelo por faixa (mesmos títulos do esqueleto da migração 0022). */
const TITULO_POR_FAIXA: Record<FaixaPrazo, string> = {
  temporada: "Contrato de locação por temporada",
  media_estadia: "Contrato de média estadia",
  longa: "Contrato de locação de longa duração",
};

/**
 * Seleciona o modelo de contrato da faixa (estrutura). O `tipoImovel` é aceito
 * para casar variações específicas quando existirem no banco (0025 adiciona a
 * coluna `tipo_imovel`); por ora as variações não estão cadastradas.
 *
 * NOTA: em produção, o modelo ATIVO vem de `modelos_contrato` (RLS "modelos
 * ativos públicos"). Enquanto o `conteudo` estiver vazio, `textoPendente` = true
 * e a UI mostra "aguardando texto jurídico".
 */
export function selecionarModeloContrato(
  faixa: FaixaPrazo,
  _tipoImovel?: string,
): ModeloContratoRef {
  return { faixa, titulo: TITULO_POR_FAIXA[faixa], textoPendente: true };
}

/** Rótulo curto da faixa (para exibição). */
export function faixaResumo(faixa: FaixaPrazo): string {
  return FAIXAS.find((f) => f.key === faixa)?.resumo ?? "";
}

/**
 * Cláusulas que a Dra. Beatriz vai redigir — apenas o LOCAL onde entram, sem o
 * texto. A UI lista estes pontos como "a incluir" no modelo selecionado.
 */
export const CLAUSULAS_PLACEHOLDER: { key: string; titulo: string; nota: string }[] = [
  { key: "ocupacao", titulo: "Ocupação", nota: "Nº de pessoas autorizadas a morar (capacidade × ocupantes)." },
  { key: "posse", titulo: "Posse", nota: "O proprietário não acessa o imóvel durante a locação." },
  { key: "mobilia", titulo: "Mobília", nota: "Proibição de trocar/retirar a mobília do imóvel." },
  { key: "sublocacao", titulo: "Sublocação", nota: "Proibição de sublocar o imóvel." },
  { key: "lgpd", titulo: "LGPD", nota: "Tratamento de dados pessoais das partes." },
];
