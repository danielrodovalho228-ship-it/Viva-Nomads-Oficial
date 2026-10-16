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
  // 6ª caixa (ordem de7b27fd): "Com garagem" usa o filtro de comodidade que a /buscar já lê (?comod=garagem).
  { rotulo: "Com garagem", icone: "CarFront", href: "/buscar?comod=garagem" },
] as const;
