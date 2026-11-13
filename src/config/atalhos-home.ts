import { POLOS } from "../lib/polos.ts";
/**
 * Atalhos por categoria da home (ordem bab1b2aa): cada um abre a /buscar já
 * filtrada — os parâmetros são os mesmos que a busca lê da URL.
 * Fotos dos cartões (ordens 0f93aa8c e 5ade9aaa): uma por atalho, únicas no site,
 * em public/images/home/cartao-*.webp (4:3).
 */
/** E830: o atalho do HC-UFU sai do polo (fonte única dos bairros); "Umuarama" casa também "Jardim Umuarama". */
const POLO_HC = POLOS.find((p) => p.slug === "hc-ufu-umuarama")!;
export const BAIRRO_HC = POLO_HC.bairros[0];
export const ROTULO_ATALHO_HC = `Bairro ${BAIRRO_HC} (HC-UFU)`;

export const ATALHOS_CATEGORIA = [
  // Faixas = as do filtro de preço da /buscar (2500/3500/5000), comparadas ao TOTAL do mês (ordem 544b148a, D15).
  { rotulo: "Até R$ 2.500/mês", icone: "Wallet", href: "/buscar?preco=2500", foto: "/images/home/cartao-ate-2000.webp", alt: "Sala ampla e clara com vista para a cidade" },
  { rotulo: "Aceita pets", icone: "PawPrint", href: "/buscar?pet=1", foto: "/images/home/cartao-aceita-pets.webp", alt: "Cachorro deitado no sofá de um imóvel mobiliado" },
  { rotulo: "Para trabalhar de casa", icone: "Laptop", href: "/buscar?homeoffice=1", foto: "/images/home/cartao-home-office.webp", alt: "Escritório em casa com mesa, notebook e cadeira ergonômica" },
  { rotulo: "3+ quartos", icone: "BedDouble", href: "/buscar?quartos=3", foto: "/images/home/cartao-3-quartos.webp", alt: "Sala de estar espaçosa de imóvel mobiliado para família" },
  // E830: o critério é o BAIRRO (o texto de local da /buscar, casaLocal), e o nome diz isso: os bairros do polo do
  // HC-UFU (Umuarama e Jardim Umuarama), que é onde o hospital fica. Antes, "Perto do HC-UFU/Umuarama" prometia
  // proximidade e excluía anúncio de outro bairro que se diz "próximo à UFU".
  { rotulo: ROTULO_ATALHO_HC, icone: "MapPin", href: `/buscar?local=${encodeURIComponent(BAIRRO_HC)}`, foto: "/images/home/cartao-hc-ufu.webp", alt: "Rua arborizada de bairro residencial" },
  // 6ª caixa (ordem de7b27fd): "Com garagem" usa o filtro de comodidade que a /buscar já lê (?comod=garagem).
  { rotulo: "Com garagem", icone: "CarFront", href: "/buscar?comod=garagem", foto: "/images/home/cartao-garagem.webp", alt: "Garagem coberta de prédio com carro na vaga" },
] as const;
