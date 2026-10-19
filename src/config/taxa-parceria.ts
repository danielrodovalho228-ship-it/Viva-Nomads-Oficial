/*
  Faixas da taxa de parceria dos fotógrafos (decisão do Daniel, 11/10; ordem 39cc7c00).
  FONTE ÚNICA para /parceiros, /parceiros/fotografos e o /admin. É só constante: o banco
  (faixas_*) não é tocado aqui; uma etapa futura liga estas faixas ao banco.
*/
export type FaixaTaxaParceria = { rotulo: string; valor: number };

export const FAIXAS_TAXA_PARCERIA: readonly FaixaTaxaParceria[] = [
  { rotulo: "Até 20 fotos", valor: 40 },
  { rotulo: "21 a 40 fotos", valor: 60 },
  { rotulo: "Acima de 40 fotos", valor: 80 },
];

export const REGRA_TAXA_PARCERIA =
  "Paga à Viva Nomads só quando você aceita o pedido; o serviço é pago direto pelo proprietário a você, e a Viva não recebe esse valor; sem mensalidade e sem exclusividade.";

/**
 * Quem paga e quem recebe (Prompt 29, item 12) — o texto do /admin/fotografos. Não muda a regra (a migração dos
 * fotógrafos para o modelo percentual aguarda decisão do Daniel).
 */
export const TEXTO_QUEM_RECEBE_TAXA_PARCERIA =
  "Taxa de parceria (R$ 40/60/80, por faixa de fotos): paga pelo fotógrafo à Viva Nomads ao aceitar o pedido. O serviço é pago direto do proprietário ao fotógrafo; a Viva não recebe esse valor.";

export const reais = (valor: number) => `R$ ${valor}`;
