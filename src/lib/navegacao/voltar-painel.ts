/*
  E720 — "← Voltar" em TODAS as telas internas do painel. Puro (node --test).
  O painel (casca do /dashboard) mostra o mesmo "← Voltar" no topo de toda tela interna, exceto onde já existe um
  voltar próprio (as telas da Conta, as filhas de estadia/contrato/visita e as de fluxo) e na página inicial.
*/
export const ROTULO_VOLTAR_PAINEL = "Voltar";
export const DESTINO_VOLTAR_PAINEL = "/dashboard";

/** Telas que já trazem o próprio voltar (CascaConta, VoltarLista, fluxo do fechamento, verificação). */
const PREFIXOS_COM_VOLTAR_PROPRIO = ["/dashboard/conta", "/dashboard/notificacoes", "/dashboard/verificacao", "/dashboard/fechamento"];
/** Listas cujas telas de detalhe (um nível abaixo) trazem o "← lista" próprio (E176). */
const LISTAS_COM_DETALHE_PROPRIO = ["/dashboard/estadia", "/dashboard/visitas", "/dashboard/contratos", "/dashboard/leads"];
/** Telas de fluxo ou edição com o "Voltar" próprio no rodapé ou no topo. */
const TELAS_COM_VOLTAR_PROPRIO = [/^\/dashboard\/imoveis\/novo$/, /^\/dashboard\/imoveis\/[^/]+\/editar$/, /^\/dashboard\/parceiro\/avaliacao\/[^/]+$/, /^\/dashboard\/avaliacoes$/];

export function painelMostraVoltar(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (!p.startsWith("/dashboard/")) return false; // inclui "/dashboard" (início) e "/admin"
  if (p === "/dashboard/conta") return true; // o menu da Conta (celular) não tinha voltar
  if (p === "/dashboard/qa" || p.startsWith("/dashboard/qa/")) return false; // páginas internas de teste
  if (PREFIXOS_COM_VOLTAR_PROPRIO.some((x) => p === x || p.startsWith(x + "/"))) return false;
  if (LISTAS_COM_DETALHE_PROPRIO.some((x) => p.startsWith(x + "/"))) return false;
  if (TELAS_COM_VOLTAR_PROPRIO.some((r) => r.test(p))) return false;
  return true;
}
