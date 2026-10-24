/*
  IDs das etapas do assistente de cadastro em 10 passos (mockups cadastro-imovel-01..10, aprovados em 23/10; mapa de
  dados da Pista B em assistente-dez-etapas.ts) — PURO, sem dependências, para a prontidão, a nota do anúncio e o editor
  apontarem a etapa pelo NOME (nunca por número solto).
    1 Tipo · 2 Fotos · 3 Endereço · 4 Detalhes · 5 Comodidades · 6 Regras · 7 Título e descrição · 8 Preço ·
    9 Disponibilidade · 10 Revise e publique.
  `onde`, `espaco` e `revisar` são os nomes dos 6 passos anteriores (Prompt 43), mantidos como apelidos.
*/
export const ETAPA = {
  tipo: 0,
  fotos: 1,
  endereco: 2,
  detalhes: 3,
  comodidades: 4,
  regras: 5,
  descricao: 6,
  preco: 7,
  disponibilidade: 8,
  revisao: 9,
  onde: 2,
  espaco: 3,
  revisar: 9,
} as const;
export type IdEtapa = (typeof ETAPA)[keyof typeof ETAPA];
