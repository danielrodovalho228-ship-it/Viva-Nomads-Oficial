/*
  Cartões de "Tipos de parceria" em /parceiros (ordem b6621ca2). Cada cartão aponta para
  public/images/unicas/parceiros-<id>.webp. Enquanto a foto não existir, `fotoPronta` fica
  false e a tela mostra um fundo neutro do tema (sem ícone gigante); quem colocar o arquivo
  vira a chave para true. src/lib/parceiros-cartoes.test.ts barra `fotoPronta` sem arquivo.
*/
export type CartaoParceria = {
  id: "fotografos" | "empresas" | "gestores" | "servicos" | "seguros";
  foto: string;
  fotoPronta: boolean;
  alt: string;
  /** O que a foto deve mostrar (tabela do PR para a coordenação). */
  briefing: string;
  /** Posição na grade: 3 cartões em cima (2 de 6 colunas) e 2 embaixo (3 de 6). */
  classeGrade: string;
};

const EM_CIMA = "lg:col-span-2";
const EMBAIXO = "lg:col-span-3";

export const FOTOS_PARCERIA: CartaoParceria[] = [
  { id: "fotografos", foto: "/images/unicas/parceiros-fotografos.webp", fotoPronta: false, alt: "Fotógrafo fotografando a sala de um imóvel mobiliado",
    briefing: "Fotógrafo com câmera em uma sala mobiliada e iluminada, de frente ou de lado, sem rosto em destaque.", classeGrade: `sm:col-span-1 ${EM_CIMA}` },
  { id: "empresas", foto: "/images/unicas/parceiros-empresas.webp", fotoPronta: false, alt: "Equipe de trabalho em um apartamento mobiliado",
    briefing: "Duas ou três pessoas com notebook em uma sala de apartamento mobiliado, clima de trabalho.", classeGrade: `sm:col-span-1 ${EM_CIMA}` },
  { id: "gestores", foto: "/images/unicas/parceiros-gestores.webp", fotoPronta: false, alt: "Gestor entregando a chave de um imóvel mobiliado",
    briefing: "Mão entregando um molho de chaves na porta de um apartamento, sem rosto identificável.", classeGrade: `sm:col-span-1 ${EM_CIMA}` },
  { id: "servicos", foto: "/images/unicas/parceiros-servicos.webp", fotoPronta: false, alt: "Profissional de limpeza arrumando um quarto mobiliado",
    briefing: "Profissional arrumando cama ou limpando bancada em um quarto/cozinha mobiliados.", classeGrade: `sm:col-span-1 ${EMBAIXO}` },
  { id: "seguros", foto: "/images/unicas/parceiros-seguros.webp", fotoPronta: false, alt: "Documento de seguro sobre a mesa de um imóvel mobiliado",
    briefing: "Documento e caneta sobre uma mesa de sala mobiliada; sem texto legível nem marca.", classeGrade: `sm:col-span-2 ${EMBAIXO}` },
];
