/*
  E276/E277 — a foto de cada categoria de parceiro (cartões de "Serviços" dos painéis e a busca de parceiros), 4:3.
  Limpeza, lavanderia, mudança e manutenção: fotos reais do catálogo de serviços (branch fotos-servicos-cartoes).
  PROVISÓRIAS (`provisoria: true`) até chegar a foto própria da categoria: fotografia e montagem usam as fotos dos
  cartões de /parceiros (fotógrafo no tripé; carregadores com a poltrona embalada).
*/
export interface FotoCategoria {
  src: string;
  alt: string;
  provisoria?: boolean;
}

export const FOTOS_CATEGORIA_PARCEIRO: Record<string, FotoCategoria> = {
  fotografia: { src: "/images/unicas/parceiros-fotografos.webp", alt: "Fotógrafo com câmera no tripé fotografando uma sala mobiliada", provisoria: true },
  mudanca: { src: "/images/parceiros-categorias/mudanca.webp", alt: "Caixas de mudança e um carregador entrando em apartamento mobiliado" },
  limpeza: { src: "/images/parceiros-categorias/limpeza.webp", alt: "Pessoa de luvas limpando a mesa de madeira da sala" },
  lavanderia: { src: "/images/parceiros-categorias/lavanderia.webp", alt: "Toalhas brancas dobradas num cesto sobre a cama arrumada" },
  montagem: { src: "/images/unicas/parceiros-mobilia.webp", alt: "Dois carregadores levando caixa e poltrona embalada", provisoria: true },
  manutencao: { src: "/images/parceiros-categorias/manutencao.webp", alt: "Profissional consertando o encanamento sob a pia da cozinha" },
};

export const fotoDaCategoria = (categoria: string): FotoCategoria | null => FOTOS_CATEGORIA_PARCEIRO[categoria] ?? null;
