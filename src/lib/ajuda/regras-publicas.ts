/*
  Família 6 (lote da Ajuda) — três regras que a Ajuda, /como-funciona e a home não declaravam (achados do Lótus,
  RELATORIO-L-036/037/038). Cada frase sai da regra do produto; nada de número escrito à mão.
    • E956 — pré-aceite: a janela é a menor entre as 72 h corridas (PRAZO_PRE_ACEITACAO_HORAS) e o tempo até a entrada, e a taxa congela
      no pré-aceite (lib/propostas/pre-aceitacao.ts, E722). Só é declarada com a chave PRE_ACEITACAO_72H_ATIVA ligada:
      com ela desligada a pré-aceitação não existe, e a Ajuda não promete o que não acontece.
    • E957 — CPF/RG em mensagem é RECUSADO com aviso (lib/messages/contact-guard.ts: documento → envio bloqueado).
    • E958, metade E948 — prazos da Viva: a equipe (PRAZO_CANAL.suporte) e a análise do documento do imóvel
      (PRAZO_CANAL.documento), de config/prazos-canais.ts. A metade do prazo do dono (E395) aguarda decisão do coordenador.
  PURO: testável com node --test (imports relativos).
*/
import { MAX_REABERTURAS, PRAZO_PRE_ACEITACAO_HORAS } from "../propostas/pre-aceitacao.ts";
import { DOCUMENTO_BLOQUEADO } from "../messages/contact-guard.ts";
import { PRAZO_CANAL } from "../../config/prazos-canais.ts";

const POR_EXTENSO: Record<number, string> = { 1: "1 vez", 2: "2 vezes", 3: "3 vezes" };

/** E956 — o pré-aceite, para quem vai morar. */
export const TEXTO_PRE_ACEITE =
  `Quando o proprietário aceita a sua proposta, começa o pré-aceite: você tem ${PRAZO_PRE_ACEITACAO_HORAS} horas corridas para concluir o contrato, ` +
  `ou até a data de entrada, se ela chegar antes (vale o que terminar primeiro). A taxa de serviço congela no pré-aceite e não é recalculada, ` +
  `nem se o pré-aceite for reaberto. Se o prazo terminar sem o contrato, nada é cobrado nem anotado contra você, e o pré-aceite pode ser ` +
  `reaberto até ${POR_EXTENSO[MAX_REABERTURAS] ?? `${MAX_REABERTURAS} vezes`}.`;

/** E957 — documento na mensagem. */
export const TEXTO_DOCUMENTO_NA_MENSAGEM = `Mensagem com CPF ou RG é recusada com um aviso e não é enviada. ${DOCUMENTO_BLOQUEADO}.`;

/** E958 (metade E948) — os prazos de resposta da Viva. */
export const TEXTO_PRAZOS_DA_VIVA =
  `Uma pessoa da equipe responde aos chamados em até ${PRAZO_CANAL.suporte.texto}. ` +
  `A análise do documento do imóvel leva até ${PRAZO_CANAL.documento.texto}, e o proprietário é avisado por e-mail.`;

export interface RegraPublica {
  id: "pre-aceite" | "documento-na-mensagem" | "prazos-da-viva";
  titulo: string;
  texto: string;
}

/** As regras declaradas em /como-funciona e na home, na ordem do processo. */
export function regrasPublicas(preAceiteAtivo: boolean): RegraPublica[] {
  return [
    ...(preAceiteAtivo ? [{ id: "pre-aceite" as const, titulo: "Pré-aceite", texto: TEXTO_PRE_ACEITE }] : []),
    { id: "documento-na-mensagem", titulo: "CPF e RG fora da conversa", texto: TEXTO_DOCUMENTO_NA_MENSAGEM },
    { id: "prazos-da-viva", titulo: "Prazos da Viva", texto: TEXTO_PRAZOS_DA_VIVA },
  ];
}
