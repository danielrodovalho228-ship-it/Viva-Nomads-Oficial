/**
 * Abas e filtros do admin (Onda 5, matriz admin-*): o estado ATIVO é pílula branca com texto colorido — o padrão do admin
 * (E351 c, "sem fundo colorido"; o mesmo de /admin/parceiros). Verde cheio fica só para o botão principal da tela.
 */
export const ABA_ADMIN = {
  ativa: "border border-ink bg-white font-semibold text-forest",
  inativa: "border border-line bg-white text-ink hover:border-ink",
} as const;

/** Selo de estado "ok" no admin (E351 c): branco com texto verde, sem fundo colorido. */
export const SELO_OK_ADMIN = "border border-forest/30 bg-white text-forest";
