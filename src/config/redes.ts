/**
 * Redes sociais OFICIAIS da Viva Nomads (Prompt 35A, item 4 — D13). Constante ÚNICA: rodapé do site, Central de
 * Ajuda (/ajuda, bloco "Fale com a Viva") e rodapé dos e-mails (RODAPE_OPCIONAL.redes) leem daqui.
 * Só conta real, confirmada pelo Daniel. Puro (sem imports "@/…"): o modelo de e-mail importa por caminho relativo.
 */
export interface RedeOficial {
  nome: string;
  url: string;
}

export const REDES_OFICIAIS: readonly RedeOficial[] = [{ nome: "Instagram", url: "https://www.instagram.com/vivanomads/" }];
