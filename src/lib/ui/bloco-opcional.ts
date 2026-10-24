/*
  C9/E56 — padrão TOGGLE para blocos opcionais (decisão do Daniel, 23/10): o bloco condicional/opcional nasce FECHADO
  atrás de um toggle claro; ligar abre o grupo inteiro; com dados já salvos nasce ABERTO. Desligar com dados salvos pede
  confirmação na própria tela (nunca window.confirm) e só então limpa. Puro (node --test).
*/

/** Estado inicial do toggle: aberto só quando já há dados salvos. */
export const toggleInicial = (temDados: boolean): boolean => temDados;

/** O que acontece ao desligar: sem dados fecha na hora; com dados, primeiro a confirmação. */
export const aoDesligar = (temDados: boolean): "fechar" | "confirmar" => (temDados ? "confirmar" : "fechar");

/** Os blocos da Conta convertidos para o padrão (a lista que a spec da rodada confere). */
export const BLOCOS_TOGGLE_CONTA = [
  { id: "pets", pergunta: "Você tem pet?", confirmar: "Remover os pets do seu perfil? Eles saem da sua candidatura." },
  {
    id: "local-trabalho",
    pergunta: "Quer ver o tempo até o trabalho?",
    confirmar: "Remover o seu local de trabalho? A busca e os alertas deixam de mostrar o tempo até lá.",
  },
  {
    id: "redes",
    pergunta: "Quer informar suas redes sociais?",
    confirmar: "Remover as suas redes? Elas saem do seu cadastro.",
  },
] as const;

export type BlocoToggleId = (typeof BLOCOS_TOGGLE_CONTA)[number]["id"];
export const textosToggle = (id: BlocoToggleId) => BLOCOS_TOGGLE_CONTA.find((b) => b.id === id)!;
