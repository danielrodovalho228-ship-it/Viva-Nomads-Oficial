/*
  E1158 (ORDENS-DUET 658 e 659) — os rótulos do pedido de avaliação, numa fonte só. Antes cada tela tinha os seus: o
  avaliador lia "Visita agendada" e a equipe lia o código da base ("agendado"); "sem avaliador elegível" estava escrito
  em quatro sítios; as respostas tinham uma redação em cada lado. PURO (node --test), sem imports @/.
  Leve de propósito (só tipos importados): telas que correm no navegador leem daqui. Os rótulos da fila da equipe,
  que precisam dos prazos do laudo, moram em rotulos-da-fila.ts.
*/
import type { TipoPedido } from "./regras.ts";

// ── (18) "sem avaliador elegível": o título do painel, o item da fila, o número do topo e o assunto do e-mail ──
export const SEM_AVALIADOR_ELEGIVEL = "sem avaliador elegível";
/** O título do painel da equipe. */
export const TITULO_PEDIDOS_SEM_AVALIADOR = `Pedidos ${SEM_AVALIADOR_ELEGIVEL}`;
/** O rótulo do número no "Para decidir". */
export const ROTULO_NUMERO_SEM_AVALIADOR = `pedidos ${SEM_AVALIADOR_ELEGIVEL}`;
/** O assunto do e-mail aos admins. */
export const ASSUNTO_SEM_AVALIADOR = `Avaliação ${SEM_AVALIADOR_ELEGIVEL}`;

// ── (16) O estado e o tipo do pedido, com os rótulos da casa — o avaliador e a equipe leem o mesmo ─────────────
export const STATUS_PEDIDO: Record<string, string> = {
  pedido: "Aguardando a escolha do proprietário",
  designado: "Escolhido pelo proprietário",
  agendado: "Visita agendada",
  realizada: "Visita feita",
  laudo_emitido: "Laudo emitido",
  cancelada: "Cancelada",
  ausencia: "Ausência registrada",
};
/** O pedido que ainda não tem ninguém para o dono escolher. */
export const ROTULO_AGUARDANDO_AVALIADOR = "Aguardando avaliador";
export const rotuloDoStatus = (status: string): string => STATUS_PEDIDO[status] ?? status;

export const ROTULO_TIPO_PEDIDO: Record<TipoPedido, string> = {
  inicial: "Avaliação inicial",
  reverificacao: "Reverificação",
  contestacao: "2ª avaliação (contestação)",
  verificacao: "Verificação aberta pela Viva",
  nova_avaliacao: "Nova avaliação",
  nova_90d: "Nova avaliação",
};
export const rotuloDoTipo = (tipo: string): string => (ROTULO_TIPO_PEDIDO as Record<string, string>)[tipo] ?? tipo;

// ── (17) A resposta do avaliador ao pedido, nas duas vozes: a equipe fala dele; a tela dele fala com ele ───────
// "expirada" não está aqui: lê o prazo que o avaliador declarou (`rotuloSemResposta`, E1157). A proposta que venceu
// ou que o dono descartou tem rótulo próprio (ROTULO_PROPOSTA_EXPIRADA e ROTULO_PROPOSTA_DESCARTADA).
export const RESPOSTA_DO_AVALIADOR: { equipe: Record<string, string>; avaliador: Record<string, string> } = {
  equipe: { recusada: "Recusou", ausencia: "Não foi à visita" },
  avaliador: { recusada: "Você recusou", ausencia: "Ausência registrada" },
};
