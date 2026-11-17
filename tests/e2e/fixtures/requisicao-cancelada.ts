export const MOTIVO_ACAO_CANCELADA = "ação do servidor cancelada pelo navegador ao trocar de tela (net::ERR_ABORTED; decisão do Muse, 22/10)";
export const MOTIVO_LEITURA_CANCELADA = "leitura cancelada pela tela: GET em /api do próprio site (rodada de 22/10) ou leitura do banco em /rest/v1 (E1009) (net::ERR_ABORTED)";
export const MOTIVO_ARQUIVO_CANCELADO = "arquivo do próprio site (/_next/static, /_next/image ou /favicon.ico) cancelado pelo navegador ao trocar de tela (net::ERR_ABORTED; L-3, 22/10)";

/**
 * Critério d da t249: requisição que o próprio navegador cancelou ao trocar de tela não é erro da página.
 *  - "prefetch": pré-carregamento de link do Next (RSC, `?_rsc=`). Rodada 1 (21/10): era a única coisa no critério d,
 *    em todas as 16 telas, nos dois tamanhos.
 *  - "acao": ação do servidor (POST com next-action) abortada pela navegação. Mesma lógica do prefetch (decisão do
 *    Muse, 22/10); entra na lista de exceções do relatório em vez de sumir.
 *  - "arquivo": script ou estilo do próprio site (GET em /_next/static/) abortado pela navegação. Lab de 22/10 (L-3):
 *    painéis às 07h23 e 09h58. Mesma lógica, mesma lista de exceções. Vale também para imagem otimizada
 *    (/_next/image), cancelada no painel do inquilino a 390 px no lab-crítico do #1024; imagem que não carrega
 *    continua no critério a.
 *  - "leitura": GET do próprio site em /api/ cancelado (o painel aborta /api/painel/contadores de propósito ao trocar
 *    de tela; /pedidos/novo cancela /api/conta/local-trabalho). Rodada de 22/10. Mesma lógica, mesma lista.
 *  E1009 (Gerente, 17/11/2026; re-triagem da noturna, t1409 e t1442 instáveis): mais dois pedidos que o navegador cancela
 *  ao trocar de tela, nas mesmas classes e na mesma lista de exceções do relatório:
 *  - "arquivo": o ícone do site (GET /favicon.ico), cancelado quando a tela troca antes de ele chegar.
 *  - "leitura": a leitura do banco (GET em /rest/v1/), cancelada pela tela que saiu (a casca lê `profiles`). Só GET:
 *    escrita cancelada (POST, PATCH, PUT, DELETE) continua acusando, porque pode ser dado que não gravou.
 * Só net::ERR_ABORTED: qualquer outro erro de rede (recusa, tempo, DNS) continua acusando.
 */
export function canceladaPeloNavegador(motivo: string, metodo: string, url: string, cabecalhos: Record<string, string>): "prefetch" | "acao" | "arquivo" | "leitura" | null {
  if (motivo !== "net::ERR_ABORTED") return null;
  if (/[?&]_rsc=/.test(url) || cabecalhos["rsc"] === "1") return "prefetch";
  if (metodo === "POST" && cabecalhos["next-action"]) return "acao";
  if (metodo === "GET" && /^\/_next\/(static\/|image$)/.test(caminho(url))) return "arquivo";
  if (metodo === "GET" && caminho(url) === "/favicon.ico") return "arquivo";
  if (metodo === "GET" && caminho(url).startsWith("/api/")) return "leitura";
  if (metodo === "GET" && caminho(url).startsWith("/rest/v1/")) return "leitura";
  return null;
}

function caminho(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}
