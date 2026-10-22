/*
  IDs das etapas do Anunciar em 6 passos (Prompt 43, adendo "Anunciar em 6 passos") — PURO, sem dependências, para
  a prontidão, a nota do anúncio e o editor apontarem a etapa pelo NOME (nunca por número solto).
    1 Endereço e dados · 2 Tipo e quartos · 3 Fotos · 4 Comodidades e segurança · 5 Regras, valores e
    disponibilidade · 6 Revisar e publicar.
*/
export const ETAPA = { onde: 0, espaco: 1, fotos: 2, comodidades: 3, regras: 4, revisar: 5 } as const;
export type IdEtapa = (typeof ETAPA)[keyof typeof ETAPA];
