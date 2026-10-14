/**
 * Atalhos por categoria da home (ordem bab1b2aa): cada um abre a /buscar já
 * filtrada — os parâmetros são os mesmos que a busca lê da URL.
 */
export const ATALHOS_CATEGORIA = [
  { rotulo: "Até R$ 2.500/mês", href: "/buscar?orcamento=2500", foto: "/images/imoveis/ube/ube-005-quarto.webp", alt: "Quarto mobiliado e compacto" },
  { rotulo: "Aceita pets", href: "/buscar?pet=1", foto: "/images/imoveis/ube/ube-008-quintal.webp", alt: "Quintal de um imóvel mobiliado" },
  { rotulo: "Para trabalhar de casa", href: "/buscar?homeoffice=1", foto: "/images/imoveis/ube/ube-006-home-office.webp", alt: "Home office montado no imóvel" },
  { rotulo: "3+ quartos", href: "/buscar?quartos=3", foto: "/images/imoveis/ube/ube-003-sala.webp", alt: "Sala ampla de uma casa mobiliada" },
] as const;
