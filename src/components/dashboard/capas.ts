/**
 * Capas fotográficas do painel logado (ordem 9f3085d8). Cada tela principal abre
 * com uma faixa de foto full-width — uma imagem por tela, nunca repetida (o guarda
 * src/lib/imagens-unicas.test.ts falha se a mesma foto aparecer em duas telas).
 */
const DIR = "/images/painel";

export const CAPAS = {
  imoveis: { src: `${DIR}/painel-imoveis.webp`, alt: "Sala mobiliada e iluminada com chaves sobre a mesa de centro" },
  leads: { src: `${DIR}/painel-leads.webp`, alt: "Celular sobre a mesa ao lado de uma xícara de café" },
  "pedidos-cidade": { src: `${DIR}/painel-pedidos-cidade.webp`, alt: "Vista da varanda para um bairro arborizado no fim de tarde" },
  fechamento: { src: `${DIR}/painel-fechamento.webp`, alt: "Mãos assinando um contrato de locação sobre a mesa" },
  contratos: { src: `${DIR}/painel-contratos.webp`, alt: "Pasta de documentos organizada sobre a escrivaninha" },
  garantias: { src: `${DIR}/painel-garantias.webp`, alt: "Porta de entrada de apartamento com fechadura digital" },
  conta: { src: `${DIR}/painel-conta.webp`, alt: "Cantinho de trabalho em casa com notebook e planta" },
  verificacao: { src: `${DIR}/painel-verificacao.webp`, alt: "Documento e celular sobre a mesa, prontos para a verificação" },
  favoritos: { src: `${DIR}/painel-favoritos.webp`, alt: "Quarto aconchegante com almofadas e luz da manhã" },
  buscas: { src: `${DIR}/painel-buscas.webp`, alt: "Mapa da cidade aberto sobre a mesa com notebook e café" },
  pedidos: { src: `${DIR}/painel-pedidos.webp`, alt: "Janela de apartamento com mala ao lado, pronta para a mudança" },
  candidaturas: { src: `${DIR}/painel-candidaturas.webp`, alt: "Mala e mochila junto à porta de um apartamento" },
  locacoes: { src: `${DIR}/painel-locacoes.webp`, alt: "Mesa de jantar posta para dois em apartamento mobiliado" },
  solicitacoes: { src: `${DIR}/painel-solicitacoes.webp`, alt: "Profissional ajustando a torneira de uma cozinha" },
  avaliacoes: { src: `${DIR}/painel-avaliacoes.webp`, alt: "Cama arrumada com manta dobrada e um cartão em branco" },
  notificacoes: { src: `${DIR}/painel-notificacoes.webp`, alt: "Criado-mudo com abajur aceso e celular" },
  carteira: { src: `${DIR}/painel-carteira.webp`, alt: "Calculadora e caderno de anotações sobre a bancada" },
  indicacoes: { src: `${DIR}/painel-indicacoes.webp`, alt: "Duas canecas de café brindando na varanda" },
  reembolsos: { src: `${DIR}/painel-reembolsos.webp`, alt: "Comprovantes organizados com clipe sobre a mesa" },
  comparar: { src: `${DIR}/painel-comparar.webp`, alt: "Duas plantas de apartamento lado a lado sobre a mesa" },
} as const;

export type CapaPainel = keyof typeof CAPAS;
