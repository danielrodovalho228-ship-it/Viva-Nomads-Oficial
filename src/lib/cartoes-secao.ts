/*
  Cartões de seção que eram só um ícone solitário (ordem b6621ca2, item 3): /empresas (pilares) e
  /para-proprietarios (benefícios). Cada um aponta para public/images/unicas/<pagina>-<cartao>.webp.
  Enquanto o arquivo não existe, `fotoPronta` fica false e o cartão mostra fundo neutro (sem ícone).
  Quando a coordenação colocar a foto, basta virar `fotoPronta` para true. As 7 fotos (PR #1144) foram geradas por
  briefing, não são do imóvel nem de cliente: `ilustrativa` põe o selo "Imagem ilustrativa" no canto (adendo EMPRESAS-A).
  src/lib/cartoes-secao.test.ts barra `fotoPronta` sem arquivo e foto repetida.
*/
export type CartaoSecao = {
  id: string;
  pagina: "empresas" | "para-proprietarios";
  foto: string;
  fotoPronta: boolean;
  /** Foto gerada por briefing (não é do imóvel nem de cliente): o cartão mostra o selo "Imagem ilustrativa". */
  ilustrativa: boolean;
  alt: string;
  /** O que a foto deve mostrar (tabela do PR para a coordenação). */
  briefing: string;
};

export const CARTOES_SECAO: CartaoSecao[] = [
  { id: "mobilidade", pagina: "empresas", foto: "/images/unicas/empresas-mobilidade.webp", fotoPronta: true, ilustrativa: true,
    alt: "Profissional chegando a um imóvel mobiliado com mala de viagem", briefing: "Pessoa de mala na porta de um apartamento mobiliado, sem rosto identificável, sem texto." },
  { id: "recibo", pagina: "empresas", foto: "/images/unicas/empresas-recibo.webp", fotoPronta: true, ilustrativa: true,
    alt: "Mesa de trabalho com notebook e recibo impresso", briefing: "Mesa com notebook e papel sem texto legível, luz natural." },
  { id: "relatorios", pagina: "empresas", foto: "/images/unicas/empresas-relatorios.webp", fotoPronta: true, ilustrativa: true,
    alt: "Tela de notebook com gráficos sobre uma mesa de escritório", briefing: "Notebook com gráficos genéricos sem números legíveis." },
  { id: "custos", pagina: "para-proprietarios", foto: "/images/unicas/proprietarios-custos.webp", fotoPronta: true, ilustrativa: true,
    alt: "Contas de casa organizadas sobre uma mesa ao lado de uma planta", briefing: "Envelopes e calculadora sem texto legível sobre a mesa." },
  { id: "ocupacao", pagina: "para-proprietarios", foto: "/images/unicas/proprietarios-ocupacao.webp", fotoPronta: true, ilustrativa: true,
    alt: "Sala mobiliada e arrumada, pronta para receber o morador", briefing: "Sala mobiliada, clara e vazia, sem pessoas." },
  { id: "contrato", pagina: "para-proprietarios", foto: "/images/unicas/proprietarios-contrato.webp", fotoPronta: true, ilustrativa: true,
    alt: "Pessoa assinando um documento no celular", briefing: "Mãos assinando na tela do celular, sem texto legível." },
  { id: "caucao", pagina: "para-proprietarios", foto: "/images/unicas/proprietarios-caucao.webp", fotoPronta: true, ilustrativa: true,
    alt: "Chaves de um imóvel sobre um documento dobrado", briefing: "Chaveiro e papel sem texto sobre a mesa." },
];

export function cartaoSecao(pagina: CartaoSecao["pagina"], id: string): CartaoSecao {
  const c = CARTOES_SECAO.find((x) => x.pagina === pagina && x.id === id);
  if (!c) throw new Error(`cartão de seção inexistente: ${pagina}/${id}`);
  return c;
}
