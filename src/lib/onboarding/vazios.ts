/*
  Estados vazios do onboarding (Prompt 43, adendo de onboarding, item 4) — PURO. Uma frase do que acontece aqui +
  o próximo passo como botão. Sem ilustração. Os demais estados vazios ficam no Prompt 48.
  Roda: node --test src/lib/onboarding/vazios.test.ts
*/
export interface VazioOnboarding {
  frase: string;
  acao: { rotulo: string; href: string };
}

export const VAZIOS_ONBOARDING = {
  interessados: {
    frase: "Aqui aparecem os pedidos dos moradores. Publique seu anúncio para receber o primeiro.",
    acao: { rotulo: "Continuar meu anúncio", href: "/dashboard/imoveis/novo" },
  },
  favoritos: {
    frase: "Aqui ficam os imóveis que você salvar. Toque no coração de um imóvel na busca.",
    acao: { rotulo: "Buscar imóveis", href: "/buscar" },
  },
  pedidosMorador: {
    frase: "Aqui aparecem seus pedidos de moradia. Pedido não é contrato: nada é cobrado até vocês assinarem.",
    acao: { rotulo: "Fazer um pedido de moradia", href: "/pedidos/novo" },
  },
  pedidosParceiro: {
    frase: "Aqui aparecem os pedidos de orçamento. Publique sua página para receber o primeiro.",
    acao: { rotulo: "Abrir minha página", href: "/dashboard/parceiro" },
  },
} as const satisfies Record<string, VazioOnboarding>;
