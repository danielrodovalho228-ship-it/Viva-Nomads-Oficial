/**
 * Atalhos por categoria da home (ordem bab1b2aa): cada um abre a /buscar já
 * filtrada — os parâmetros são os mesmos que a busca lê da URL.
 */
export const ATALHOS_CATEGORIA = [
  { rotulo: "Até R$ 2.000/mês", href: "/buscar?orcamento=2000", foto: "/images/imoveis/ube/ube-005-quarto.webp", alt: "Quarto mobiliado e compacto" },
  { rotulo: "Aceita pets", href: "/buscar?pet=1", foto: "/images/imoveis/ube/ube-008-quintal.webp", alt: "Quintal de um imóvel mobiliado" },
  { rotulo: "Para trabalhar de casa", href: "/buscar?homeoffice=1", foto: "/images/imoveis/ube/ube-006-home-office.webp", alt: "Home office montado no imóvel" },
  { rotulo: "3+ quartos", href: "/buscar?quartos=3", foto: "/images/imoveis/ube/ube-003-sala.webp", alt: "Sala ampla de uma casa mobiliada" },
  // "Perto do HC-UFU/Umuarama" usa o texto de local que a /buscar já lê (bairro/cidade).
  { rotulo: "Perto do HC-UFU/Umuarama", href: "/buscar?local=Umuarama", foto: "/images/imoveis/ube/ube-002-vista.webp", alt: "Vista de um imóvel mobiliado no bairro Umuarama" },
] as const;
