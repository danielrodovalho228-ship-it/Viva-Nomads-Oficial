/**
 * E1187 — conta ao roteador que o endereço ganhou uma âncora.
 * Uma âncora simples (`<a href="#secao">`) é um salto do navegador: o roteador do Next não sabe dele. Quando, depois,
 * uma ação de servidor responde a dizer que a página mudou, o roteador volta a escrever o endereço que ELE conhece —
 * sem a âncora — e empurra uma entrada a mais no histórico. Na área da equipe isso acontece logo ao abrir a tela: o
 * cookie de atividade renova-se a cada pedido e as leituras da casca contam como mudança.
 * A cura: depois do salto, reescrever o MESMO endereço pelo histórico. O Next acompanha `history.replaceState`, e o
 * roteador passa a conhecer a âncora. Não toca no toque nem na rolagem: quem leva a tela é o navegador (E1184).
 *
 * Só age numa entrada que o navegador criou sozinho e que tem âncora. A entrada do roteador reconhece-se pela marca
 * que o Next põe no estado do histórico (`__NA`): é um pormenor interno da biblioteca. Se uma subida do Next o mudar,
 * a trava de tela t1784 é quem avisa.
 * Devolve se escreveu no histórico.
 */
export type JanelaComHistorico = {
  location: { hash: string; href: string };
  history: { state: unknown; replaceState(estado: unknown, titulo: string, url: string): void };
};

export function contarAncoraAoRoteador(janela: JanelaComHistorico): boolean {
  if (!janela.location.hash) return false;
  const estado = janela.history.state as { __NA?: unknown } | null;
  if (estado?.__NA) return false;
  janela.history.replaceState(estado, "", janela.location.href);
  return true;
}
