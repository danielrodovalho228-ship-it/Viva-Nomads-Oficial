/*
  E897: os caminhos do cartão "Limpeza e manutenção" de /parceiros — um por categoria, para atender e para procurar, no padrão
  do cartão "Montagem e mudança" (E301). Antes, "Quero atender" e "Procurar" levavam só a Limpeza. PURO.
*/
export const CATEGORIAS_CARTAO_SERVICOS = ["limpeza", "lavanderia", "manutencao"] as const;

const NOME: Record<(typeof CATEGORIAS_CARTAO_SERVICOS)[number], string> = { limpeza: "limpeza", lavanderia: "lavanderia", manutencao: "manutenção" };

export function linksDoCartaoServicos(): { href: string; rotulo: string }[] {
  return [
    ...CATEGORIAS_CARTAO_SERVICOS.map((c) => ({ href: `/parceiros?categoria=${c}#quero-ser-parceiro`, rotulo: `Atender ${NOME[c]}` })),
    ...CATEGORIAS_CARTAO_SERVICOS.map((c) => ({ href: `/parceiros/buscar?categoria=${c}`, rotulo: `Procurar ${NOME[c]}` })),
  ];
}
