/*
  Cartões de "Tipos de parceria" em /parceiros (ordem b6621ca2 + prompt 14). Cada cartão aponta para
  public/images/unicas/parceiros-<id>.webp (fotos geradas sem texto, marca nem lugar real).
  Grade 3 + 3 (número PAR, regra do site): todos com lg:col-span-2 numa grade de 6 colunas.
  src/lib/parceiros-cartoes.test.ts barra `fotoPronta` sem arquivo.
*/
export type CartaoParceria = {
  id: "fotografos" | "empresas" | "gestores" | "servicos" | "mobilia" | "seguros";
  foto: string;
  fotoPronta: boolean;
  alt: string;
  /** O que a foto mostra (tabela do PR para a coordenação). */
  briefing: string;
  classeGrade: string;
};

const CELULA = "sm:col-span-1 lg:col-span-2";

export const FOTOS_PARCERIA: CartaoParceria[] = [
  { id: "fotografos", foto: "/images/unicas/parceiros-fotografos.webp", fotoPronta: true, alt: "Fotógrafo com câmera no tripé fotografando uma sala mobiliada",
    briefing: "Fotógrafo com câmera no tripé fotografando uma sala mobiliada.", classeGrade: CELULA },
  { id: "empresas", foto: "/images/unicas/parceiros-empresas.webp", fotoPronta: true, alt: "Três profissionais trabalhando com notebooks numa sala de imóvel mobiliado",
    briefing: "Três profissionais trabalhando com notebooks numa sala mobiliada.", classeGrade: CELULA },
  { id: "gestores", foto: "/images/unicas/parceiros-gestores.webp", fotoPronta: true, alt: "Mão entregando chaves na porta de um imóvel mobiliado",
    briefing: "Mão entregando chaves na porta de um imóvel mobiliado.", classeGrade: CELULA },
  { id: "servicos", foto: "/images/unicas/parceiros-servicos.webp", fotoPronta: true, alt: "Profissional arrumando a cama com roupa de cama limpa",
    briefing: "Profissional arrumando a cama com roupa de cama limpa.", classeGrade: CELULA },
  { id: "mobilia", foto: "/images/unicas/parceiros-mobilia.webp", fotoPronta: true, alt: "Dois carregadores entrando com caixa e poltrona embalada",
    briefing: "Dois carregadores entrando com caixa e poltrona embalada.", classeGrade: CELULA },
  { id: "seguros", foto: "/images/unicas/parceiros-seguros.webp", fotoPronta: true, alt: "Apólice sem texto legível, caneta e chaveiro de casinha sobre a mesa",
    briefing: "Apólice sem texto legível, caneta e chaveiro de casinha na mesa.", classeGrade: CELULA },
];
