/**
 * Atalhos por categoria da home (ordem bab1b2aa): cada um abre a /buscar já
 * filtrada — os parâmetros são os mesmos que a busca lê da URL.
 */
export const ATALHOS_CATEGORIA = [
  { rotulo: "Até R$ 2.000/mês", icone: "Wallet", href: "/buscar?orcamento=2000" },
  { rotulo: "Aceita pets", icone: "PawPrint", href: "/buscar?pet=1" },
  { rotulo: "Para trabalhar de casa", icone: "Laptop", href: "/buscar?homeoffice=1" },
  { rotulo: "3+ quartos", icone: "BedDouble", href: "/buscar?quartos=3" },
  // "Perto do HC-UFU/Umuarama" usa o texto de local que a /buscar já lê (bairro/cidade).
  { rotulo: "Perto do HC-UFU/Umuarama", icone: "MapPin", href: "/buscar?local=Umuarama" },
] as const;
