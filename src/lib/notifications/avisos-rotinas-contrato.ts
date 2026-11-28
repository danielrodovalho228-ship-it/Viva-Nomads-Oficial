/*
  E1247, passo 1 (ORDEM-DUET 1233, decisão do coordenador) — os avisos do site das rotinas que viajam com o evento do
  contrato (caução, parcela mensal, pré-aceite de 72 h). Uma tabela só:
   - o título é o ASSUNTO do e-mail do mesmo evento, lido da mesma constante (ASSUNTOS);
   - o botão leva ao lugar da ação daquele evento, nunca "Assinar o contrato";
   - crítico só quando pede uma ação da pessoa com prazo em até 24 h ou já vencido; o resto é normal.
  O passo 2 (eventos próprios, ref_id, resolução pela ação) é a condição para ligar cada chave.
  Puro.
*/
import { ASSUNTOS } from "./assuntos.ts";

export type RotinaDoContrato =
  | "caucaoLiberacaoIntegral"
  | "caucaoDevolucaoAtraso"
  | "lembreteParcelaAluguel"
  | "pagamentoRegistradoMorador"
  | "preAceitacaoLembrete"
  | "preAceitacaoExpirou"
  | "preAceitacaoPerdeuVez"
  | "preAceitacaoEncerrada";

export interface AvisoDaRotina {
  titulo: string;
  prioridade: "critico" | "normal";
  botao: string;
}

const VER_CAUCAO = "Ver a caução";
const VER_PAGAMENTOS = "Ver os pagamentos";
const VER_PROPOSTA = "Ver a proposta";
const RESPONDER_PROPOSTA = "Responder à proposta";

/** O aviso de cada rotina, para cada papel. */
export function avisoDaRotina(chave: RotinaDoContrato, papel: "proprietario" | "inquilino"): AvisoDaRotina {
  const titulo = ASSUNTOS[chave];
  switch (chave) {
    // O prazo da caução aproxima-se (a devolução é devida, com o teto dos 30 dias): normal.
    case "caucaoLiberacaoIntegral":
      return { titulo, prioridade: "normal", botao: VER_CAUCAO };
    // O prazo da caução venceu: crítico.
    case "caucaoDevolucaoAtraso":
      return { titulo, prioridade: "critico", botao: VER_CAUCAO };
    // O lembrete da próxima parcela, e o pagamento registrado pelo morador (confirmar, sem prazo de 24 h): normal.
    case "lembreteParcelaAluguel":
    case "pagamentoRegistradoMorador":
      return { titulo, prioridade: "normal", botao: VER_PAGAMENTOS };
    // Faltam ≤ 24 h para o morador concluir: crítico para ele; para o dono só informa.
    case "preAceitacaoLembrete":
      return papel === "inquilino" ? { titulo, prioridade: "critico", botao: RESPONDER_PROPOSTA } : { titulo, prioridade: "normal", botao: VER_PROPOSTA };
    // O prazo expirou, a vez passou, a candidatura encerrou: só informa.
    case "preAceitacaoExpirou":
    case "preAceitacaoPerdeuVez":
    case "preAceitacaoEncerrada":
      return { titulo, prioridade: "normal", botao: VER_PROPOSTA };
  }
}

const ROTINAS: RotinaDoContrato[] = ["caucaoLiberacaoIntegral", "caucaoDevolucaoAtraso", "lembreteParcelaAluguel", "pagamentoRegistradoMorador", "preAceitacaoLembrete", "preAceitacaoExpirou", "preAceitacaoPerdeuVez", "preAceitacaoEncerrada"];

/**
 * O aviso já gravado é de uma destas rotinas? Pelo título (o assunto da constante; o nome do imóvel pode vir depois).
 * O botão da faixa é o do papel que vê o crítico: só o morador recebe o lembrete do pré-aceite como crítico.
 */
export function rotinaDoTitulo(titulo: string | null | undefined): RotinaDoContrato | null {
  const t = String(titulo ?? "");
  return ROTINAS.find((k) => t === ASSUNTOS[k] || t.startsWith(`${ASSUNTOS[k]} ·`)) ?? null;
}

/** O botão da faixa para um aviso de rotina (o do crítico: caução vencida, ou o lembrete do pré-aceite ao morador). */
export function botaoDaRotina(titulo: string | null | undefined): string | null {
  const k = rotinaDoTitulo(titulo);
  return k ? avisoDaRotina(k, "inquilino").prioridade === "critico" ? avisoDaRotina(k, "inquilino").botao : avisoDaRotina(k, "proprietario").botao : null;
}
