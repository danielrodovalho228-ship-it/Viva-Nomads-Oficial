/*
  Central de Guias (ordem 1438f18d, Próximo do FF 6/6): textos escritos pela Viva, só com regras
  que a plataforma já publica (prazo, Caução, conferência de entrada, taxa por faixa). Nenhum número
  de mercado: preço e bairro dependem do imóvel, e o guia diz isso em vez de inventar média.
  Puro e testável: o teste confere título ≤ 46 (+ sufixo da marca ≤ 60) e as palavras proibidas.
*/
import { CAUCAO_FRASE } from "../faixas.ts";

export interface Guia {
  slug: string;
  titulo: string;
  descricao: string;
  publico: "proprietarios" | "inquilinos" | "todos";
  secoes: { titulo: string; paragrafos: string[] }[];
}

export const GUIAS: Guia[] = [
  {
    slug: "como-precificar-estadia-de-meses",
    titulo: "Como precificar uma estadia de meses",
    descricao: "Passo a passo para o proprietário definir o valor mensal de um imóvel mobiliado para estadias de 30 a 180 dias.",
    publico: "proprietarios",
    secoes: [
      {
        titulo: "Comece pelo valor mensal",
        paragrafos: [
          "Na Viva Nomads o anúncio mostra um valor por mês, e o contrato é de 30 a 180 dias. Pense no valor de um mês morando no imóvel, já mobiliado, e não no preço de uma diária.",
          "Olhe anúncios parecidos na própria busca: mesmo bairro, mesmo número de quartos, mesmo nível de mobília. Compare o seu com eles e anote o que o seu tem a mais (vaga, home office, ar-condicionado) ou a menos.",
        ],
      },
      {
        titulo: "O que entra e o que fica de fora",
        paragrafos: [
          "Diga no anúncio o que o valor mensal já inclui (condomínio, internet, contas) e o que é cobrado à parte. Quem não encontra isso claro costuma desistir ou perguntar de novo.",
          "Taxa de limpeza e valor extra para pet também aparecem no anúncio. Combine-os antes de publicar, para o inquilino ver o total desde a primeira tela.",
        ],
      },
      {
        titulo: "Como a taxa da Viva entra na conta",
        paragrafos: [
          "Anunciar é grátis. A Viva cobra uma taxa sobre o valor total de cada contrato fechado e de cada renovação (valor mensal × meses), e a taxa cai conforme você tem mais imóveis. A tabela completa está em /precos.",
          "Faça a conta com a taxa da sua faixa antes de definir o valor, para saber o seu resultado depois da taxa.",
        ],
      },
      {
        titulo: "Ajuste com o tempo",
        paragrafos: [
          "Se passaram semanas sem interessados, revise fotos e descrição antes de baixar o valor. Se os pedidos chegam rápido demais, talvez haja espaço para subir um pouco no próximo período.",
        ],
      },
    ],
  },
  {
    slug: "o-que-e-a-caucao",
    titulo: "O que é a Caução e como funciona",
    descricao: "Entenda a Caução nos contratos da Viva Nomads: quanto pode ser, onde fica o dinheiro e quando volta para o inquilino.",
    publico: "todos",
    secoes: [
      {
        titulo: "Em uma frase",
        paragrafos: [CAUCAO_FRASE],
      },
      {
        titulo: "Para o inquilino",
        paragrafos: [
          "A Caução fica em uma poupança e volta para você no fim do contrato, depois da conferência de saída, se não houver pendência combinada entre as partes.",
          "A plataforma não recebe nem guarda esse dinheiro. Desconfie de qualquer pedido de pagamento fora do que está no contrato (veja /seguranca).",
        ],
      },
      {
        titulo: "Para o proprietário",
        paragrafos: [
          "A Caução dá tranquilidade para entregar um imóvel mobiliado. O valor e o que é coberto ficam registrados no contrato, e a conferência de entrada e de saída serve de base para qualquer conversa sobre o estado do imóvel.",
        ],
      },
    ],
  },
  {
    slug: "checklist-imovel-mobiliado",
    titulo: "Checklist de um imóvel mobiliado",
    descricao: "Lista do que conferir e registrar em um imóvel mobiliado antes de anunciar ou de se mudar.",
    publico: "todos",
    secoes: [
      {
        titulo: "Cozinha",
        paragrafos: [
          "Fogão, geladeira, micro-ondas, panelas, pratos, talheres e copos. Teste o que liga na tomada e anote o que já tem marca de uso.",
        ],
      },
      {
        titulo: "Quartos e sala",
        paragrafos: [
          "Cama e colchão, roupa de cama se estiver inclusa, guarda-roupa, sofá, mesa e cadeiras. Fotografe cada peça e cada canto, de perto e de longe.",
        ],
      },
      {
        titulo: "Banheiro, lavanderia e conforto",
        paragrafos: [
          "Chuveiro, descarga, torneiras, máquina de lavar, ventilador ou ar-condicionado, internet e fechaduras. Veja se há vazamento ou mofo e registre.",
        ],
      },
      {
        titulo: "Registre tudo na plataforma",
        paragrafos: [
          "O checklist vira a conferência de entrada: cada parte registra cômodos, itens e fotos, e confirma ou contesta uma vez. Quanto mais completo, menos dúvida no fim do contrato.",
        ],
      },
    ],
  },
  {
    slug: "como-funciona-a-conferencia-de-entrada",
    titulo: "Como funciona a conferência de entrada",
    descricao: "O que é a conferência de entrada, quem faz, em quanto tempo e o que acontece se houver discordância.",
    publico: "todos",
    secoes: [
      {
        titulo: "O que é",
        paragrafos: [
          "É o registro do estado do imóvel e dos móveis no começo do contrato, com cômodos, itens e fotos. Ela é feita pelo proprietário e pelo inquilino, cada um do seu lado.",
        ],
      },
      {
        titulo: "Prazo",
        paragrafos: ["A conferência de entrada vale até 48 horas depois do início do contrato."],
      },
      {
        titulo: "Confirmar ou contestar",
        paragrafos: [
          "Cada parte confirma ou contesta uma única vez. Depois da primeira resposta, os itens não mudam mais. Se alguém contesta, o motivo fica registrado, e o atendimento da Viva ajuda a encaminhar.",
        ],
      },
      {
        titulo: "Por que importa",
        paragrafos: [
          "No fim do contrato, a conferência de saída é comparada com a de entrada. Ela é a base para a devolução da Caução.",
        ],
      },
    ],
  },
  {
    slug: "como-escolher-bairro-em-uberlandia",
    titulo: "Como escolher o bairro em Uberlândia",
    descricao: "Perguntas para escolher o bairro de uma estadia de meses em Uberlândia, sem depender de média de preço.",
    publico: "inquilinos",
    secoes: [
      {
        titulo: "Comece pelo seu dia a dia",
        paragrafos: [
          "Pense no caminho até o trabalho, a faculdade ou o hospital onde você vai estar. Na busca, os atalhos “Perto do HC-UFU” e “Perto do Umuarama” já filtram os imóveis por proximidade.",
        ],
      },
      {
        titulo: "Perguntas que ajudam",
        paragrafos: [
          "Você vai de carro, ônibus ou a pé? Precisa de mercado e farmácia por perto? Precisa de silêncio para trabalhar em casa? Tem pet? Responda antes de olhar preço.",
        ],
      },
      {
        titulo: "Use o mapa e os filtros",
        paragrafos: [
          "O mapa da busca mostra a região aproximada de cada imóvel. O endereço exato aparece só depois do aceite. Combine o bairro com os filtros de valor mensal, quartos e pet.",
        ],
      },
      {
        titulo: "Converse antes de decidir",
        paragrafos: [
          "Pergunte ao proprietário sobre barulho, trânsito e estacionamento. A conversa fica registrada na plataforma.",
        ],
      },
    ],
  },
  {
    slug: "documentos-para-morar-em-imovel-mobiliado",
    titulo: "Documentos para morar em imóvel mobiliado",
    descricao: "Quais informações e documentos o inquilino costuma precisar ter à mão para fechar um contrato de 30 a 180 dias.",
    publico: "inquilinos",
    secoes: [
      {
        titulo: "Antes de se candidatar",
        paragrafos: [
          "Complete seu perfil: nome, profissão e o motivo da estadia (trabalho, estudo, tratamento, mudança). O proprietário só vê sua identidade completa depois do aceite.",
        ],
      },
      {
        titulo: "Documento do inquilino",
        paragrafos: [
          "Tenha à mão um documento oficial com foto. Ele é enviado dentro da plataforma, e você acompanha a análise no seu painel. Não envie documento por mensagem nem por e-mail comum.",
        ],
      },
      {
        titulo: "No fechamento",
        paragrafos: [
          "O contrato é digital e assinado pelas duas partes. A Caução e o valor mensal seguem o que está no contrato; a plataforma não recebe esse dinheiro.",
        ],
      },
      {
        titulo: "Se pedirem algo diferente",
        paragrafos: ["Se alguém pedir documento ou pagamento por fora da plataforma, pare e leia /seguranca."],
      },
    ],
  },
  {
    // 65-B: linkado da seção Vídeo do editor e do bloco de vídeo do passo Fotos (GUIA_VIDEO_HREF).
    slug: "como-por-um-video-no-anuncio",
    titulo: "Como pôr um vídeo no anúncio",
    descricao: "Onde enviar o vídeo do imóvel, os limites de tamanho e duração, como gravar pelo celular e como trocar ou remover.",
    publico: "proprietarios",
    secoes: [
      {
        titulo: "Onde fica",
        paragrafos: [
          "No anúncio já criado: em Meus imóveis, toque em Editar e abra a seção Vídeo, logo depois das Fotos.",
          "No cadastro de um anúncio novo: no passo Fotos, no bloco Vídeo do imóvel, logo depois do envio das fotos. O vídeo é opcional e nunca impede publicar.",
        ],
      },
      {
        titulo: "Limites e formatos",
        paragrafos: [
          "Um vídeo por anúncio, de até 60 segundos e até 50 MB, em MP4 ou MOV (os formatos que o celular grava). Se passar disso, a tela avisa na hora e nada é gravado.",
          "Se preferir, cole um link do YouTube ou do Vimeo. Com um vídeo enviado, o anúncio mostra o vídeo enviado; o link só aparece quando não há vídeo enviado.",
        ],
      },
      {
        titulo: "Como gravar",
        paragrafos: [
          "Grave pelo celular, na horizontal ou na vertical, andando devagar pelos ambientes: entrada, sala, cozinha, quartos, banheiro e o espaço de trabalho.",
          "Mostre o imóvel por dentro, com luz natural. Não grave pessoas, documentos, a fachada com o número nem a vista que identifique o endereço exato.",
        ],
      },
      {
        titulo: "Trocar ou remover",
        paragrafos: [
          "Para trocar, toque em Trocar vídeo e escolha o novo: o anterior é apagado. Para tirar, toque em Remover; o vídeo sai do anúncio na hora.",
          "Se a conexão cair no meio do envio, nada é gravado. Toque em Tentar de novo quando a internet voltar.",
        ],
      },
    ],
  },
];

export function guiaPorSlug(slug: string): Guia | undefined {
  return GUIAS.find((g) => g.slug === slug);
}

/** Texto corrido do guia (para teste de palavras proibidas e contagem). */
export function textoDoGuia(g: Guia): string {
  return [g.titulo, g.descricao, ...g.secoes.flatMap((s) => [s.titulo, ...s.paragrafos])].join("\n");
}

/** JSON-LD Article. Só fatos do próprio guia: sem nota, sem data inventada, sem coordenada. */
export function artigoGuia(siteUrl: string, g: Guia) {
  return {
    "@context": "https://schema.org",
    "@type": "Article" as const,
    "@id": `${siteUrl}/guias/${g.slug}#artigo`,
    headline: g.titulo,
    description: g.descricao,
    url: `${siteUrl}/guias/${g.slug}`,
    inLanguage: "pt-BR",
    author: { "@type": "Organization", name: "Viva Nomads", url: siteUrl },
    publisher: { "@type": "Organization", name: "Viva Nomads", url: siteUrl },
    mainEntityOfPage: `${siteUrl}/guias/${g.slug}`,
  };
}
