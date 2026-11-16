/*
  E967 — no chat, a mensagem aparece antes da confirmação do servidor (eco otimista) e sumia sem aviso se a rede caísse:
  `enviar()` ignorava o retorno de `semQuedaDeRede(sendMessage(...))`, e ao recarregar a mensagem não existia. PURO.
  A bolha otimista fica, marcada como NÃO ENVIADA com o motivo e o botão "Tentar de novo" (que reenvia o MESMO texto e
  grava uma vez). Ofensa (E445) segue o caminho próprio (aviso antes de gravar), não é falha.
*/
import { MSG_SEM_CONEXAO } from "../erro-de-rede.ts";

export const TEXTO_NAO_ENVIADA = "Não foi enviada.";
export const ROTULO_TENTAR_DE_NOVO = "Tentar de novo";
const PADRAO = "Não foi possível enviar a mensagem agora.";

type Retorno = { ok?: boolean; ofensa?: boolean; erro?: string; error?: string } | null | undefined;

/** O motivo da falha do envio (para a bolha), ou null quando gravou (ou quando é o aviso de ofensa, que não é falha). */
export function falhaDoEnvio(r: Retorno): string | null {
  if (r && r.ofensa) return null;
  if (r && r.ok !== false) return null;
  const motivo = String(r?.erro || r?.error || "").trim();
  return motivo || (r ? PADRAO : MSG_SEM_CONEXAO);
}
