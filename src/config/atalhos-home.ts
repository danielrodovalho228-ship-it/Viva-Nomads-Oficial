/**
 * Atalhos por categoria da home (ordem bab1b2aa): cada um abre a /buscar já
 * filtrada — os parâmetros são os mesmos que a busca lê da URL.
 * Fotos dos cartões (ordens 0f93aa8c e 5ade9aaa): uma por atalho, únicas no site,
 * em public/images/home/cartao-*.webp (4:3).
 */
export const ATALHOS_CATEGORIA = [
  { rotulo: "Até R$ 2.000/mês", icone: "Wallet", href: "/buscar?orcamento=2000", foto: "/images/home/cartao-ate-2000.webp", alt: "Sala ampla e clara com vista para a cidade" },
  { rotulo: "Aceita pets", icone: "PawPrint", href: "/buscar?pet=1", foto: "/images/home/cartao-aceita-pets.webp", alt: "Cachorro deitado no sofá de um apartamento mobiliado" },
  { rotulo: "Para trabalhar de casa", icone: "Laptop", href: "/buscar?homeoffice=1", foto: "/images/home/cartao-home-office.webp", alt: "Escritório em casa com mesa, notebook e cadeira ergonômica" },
  { rotulo: "3+ quartos", icone: "BedDouble", href: "/buscar?quartos=3", foto: "/images/home/cartao-3-quartos.webp", alt: "Sala de estar espaçosa de apartamento para família" },
  // "Perto do HC-UFU/Umuarama" usa o texto de local que a /buscar já lê (bairro/cidade).
  { rotulo: "Perto do HC-UFU/Umuarama", icone: "MapPin", href: "/buscar?local=Umuarama", foto: "/images/home/cartao-hc-ufu.webp", alt: "Rua arborizada de bairro residencial" },
  // 6ª caixa (ordem de7b27fd): "Com garagem" usa o filtro de comodidade que a /buscar já lê (?comod=garagem).
  { rotulo: "Com garagem", icone: "CarFront", href: "/buscar?comod=garagem", foto: "/images/home/cartao-garagem.webp", alt: "Garagem coberta de prédio com carro na vaga" },
] as const;
