export const MOTIVO_ACAO_CANCELADA = "ação do servidor cancelada pelo navegador ao trocar de tela (net::ERR_ABORTED; decisão do Muse, 22/10)";

/**
 * Critério d da t249: requisição que o próprio navegador cancelou ao trocar de tela não é erro da página.
 *  - "prefetch": pré-carregamento de link do Next (RSC, `?_rsc=`). Rodada 1 (21/10): era a única coisa no critério d,
 *    em todas as 16 telas, nos dois tamanhos.
 *  - "acao": ação do servidor (POST com next-action) abortada pela navegação. Mesma lógica do prefetch (decisão do
 *    Muse, 22/10); entra na lista de exceções do relatório em vez de sumir.
 * Só net::ERR_ABORTED: qualquer outro erro de rede (recusa, tempo, DNS) continua acusando.
 */
export function canceladaPeloNavegador(motivo: string, metodo: string, url: string, cabecalhos: Record<string, string>): "prefetch" | "acao" | null {
  if (motivo !== "net::ERR_ABORTED") return null;
  if (/[?&]_rsc=/.test(url) || cabecalhos["rsc"] === "1") return "prefetch";
  if (metodo === "POST" && cabecalhos["next-action"]) return "acao";
  return null;
}
