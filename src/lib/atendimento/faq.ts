/*
  Perguntas frequentes da Central de Ajuda. FONTE ÚNICA das respostas: as
  regras do produto (config/planos.ts, REGRAS_CONTRATO, CAUCAO_FRASE). A IA do
  PR 2 também responde a partir daqui. Puro (testável com node --test).
*/
import { REGRAS_CONTRATO } from "../../config/planos.ts";
import { TEXTO_REGRA_UNICA } from "../cobranca/regra.ts";
import { CAUCAO_FRASE } from "../faixas.ts";
import { OBRIGATORIOS_ROTULOS } from "../anuncio/prontidao.ts";

export interface Pergunta {
  id: string;
  pergunta: string;
  resposta: string;
  /** Palavras que a busca também reconhece. */
  termos: string[];
  /** Resposta diferente conforme quem lê (ex.: só quem tem contrato ativo vê a opção de manutenção). */
  porPerfil?: Partial<Record<PerfilAjuda, string>>;
}

/** Quem está lendo a Central de Ajuda. */
export type PerfilAjuda = "visitante" | "sem_contrato" | "com_contrato";

const PRAZOS_MANUTENCAO =
  "O proprietário é avisado na hora e tem prazo para responder: 4 horas em urgências (sem água, sem luz, vazamento), 24 horas nos casos médios e 72 horas nos demais.";

export const FAQ: Pergunta[] = [
  {
    id: "caucao",
    pergunta: "Como funciona a caução?",
    resposta: `${CAUCAO_FRASE} Em cada bloco do contrato, a caução é de ${Math.round(REGRAS_CONTRATO.caucaoFracaoBloco * 100)}% do valor do bloco, sem passar de ${REGRAS_CONTRATO.caucaoMaxAlugueis} aluguéis no total (art. 38, §2º da Lei 8.245/91). Ela volta para o inquilino no fim, depois da vistoria de saída.`,
    termos: ["caucao", "deposito", "garantia", "poupanca", "devolucao"],
  },
  {
    id: "custo-anunciar",
    pergunta: "Quanto custa anunciar?",
    resposta: `${TEXTO_REGRA_UNICA} Num aluguel de R$ 4.320 por mês, são R$ 518,40 no primeiro aluguel do contrato e R$ 518,40 em cada renovação. Veja a comparação com outras opções em /precos.`,
    termos: ["preco", "taxa", "anunciar", "comissao", "mensalidade", "quanto custa", "airbnb", "12"],
  },
  {
    id: "inquilino-paga",
    pergunta: "O inquilino paga alguma taxa para a plataforma?",
    resposta:
      "Não. Buscar, se candidatar, publicar um Pedido de Moradia e conversar não têm custo para o inquilino. A taxa de 12% do primeiro aluguel é cobrada só do proprietário. O aluguel e a caução são combinados entre as partes e não passam pela plataforma.",
    termos: ["taxa", "inquilino", "custo", "gratis"],
  },
  {
    id: "prazo",
    pergunta: "Qual o prazo mínimo e máximo da locação?",
    resposta: `De ${REGRAS_CONTRATO.prazoMinMeses} a ${REGRAS_CONTRATO.prazoMaxMeses} meses — de 30 a ${REGRAS_CONTRATO.prazoMaxDias} dias no total, em blocos de até ${REGRAS_CONTRATO.maxDiasBloco} dias (locação para temporada, art. 48 da Lei 8.245/91).`,
    termos: ["prazo", "minimo", "maximo", "meses", "dias", "duracao"],
  },
  {
    id: "renovar",
    pergunta: "Posso renovar o contrato?",
    resposta: `Sim, enquanto o total não passar de ${REGRAS_CONTRATO.prazoMaxDias} dias. A renovação é um novo bloco, só vale com o aceite do proprietário e do inquilino, e tem a mesma taxa de 12% do primeiro aluguel do período, paga pelo proprietário. Depois de ${REGRAS_CONTRATO.prazoMaxDias} dias, é preciso um novo contrato.`,
    termos: ["renovar", "renovacao", "prorrogar", "estender"],
  },
  {
    id: "anuncio-nao-publica",
    pergunta: "Por que meu anúncio não publica?",
    resposta:
      // Mesma lista da prontidão (lib/anuncio/prontidao): o que o FAQ diz é o que o Publicar confere.
      `Para publicar, o anúncio precisa de: ${OBRIGATORIOS_ROTULOS.map((r) => r.charAt(0).toLowerCase() + r.slice(1)).join("; ")}. Selo Pronto para Morar e vídeo ajudam, mas não impedem a publicação. Em Meus imóveis e na etapa Revisão aparece exatamente o que falta. Se o documento está "Em análise", é só aguardar: avisamos por e-mail quando for aprovado.`,
    termos: ["publicar", "anuncio", "documento", "analise", "fotos", "travado"],
  },
  {
    id: "email-confirmacao",
    pergunta: "Não recebi o e-mail de confirmação",
    resposta:
      "Confira a caixa de spam e as abas Promoções/Atualizações. Se não estiver lá, vá em Entrar e digite o seu e-mail e a senha: como a conta ainda não foi confirmada, aparece o botão \"Reenviar e-mail de confirmação\". Persistindo, abra um chamado.",
    termos: ["email", "confirmacao", "confirmar", "nao recebi", "spam"],
  },
  {
    id: "senha",
    pergunta: "Esqueci minha senha",
    resposta:
      "Em Entrar, toque em \"Esqueci minha senha\" e informe o seu e-mail: enviamos um link para criar uma nova. Nunca pedimos a sua senha — nem por chamado, nem por e-mail.",
    termos: ["senha", "esqueci", "redefinir", "acesso"],
  },
  {
    id: "contato",
    pergunta: "Por que não vejo o telefone do proprietário (ou do inquilino)?",
    resposta:
      "Para a sua segurança, a conversa acontece toda pela plataforma: telefone, e-mail e redes sociais aparecem como \"contato protegido\". Assim tudo fica registrado e vale como prova se houver qualquer problema.",
    termos: ["telefone", "whatsapp", "contato", "zap", "numero"],
  },
  {
    id: "manutencao",
    pergunta: "Algo quebrou no imóvel. O que eu faço?",
    resposta: `Entre na sua conta e abra pelo seu contrato ("Problema com isto?"). ${PRAZOS_MANUTENCAO}`,
    termos: ["manutencao", "quebrou", "conserto", "chuveiro", "agua", "luz", "vazamento"],
    porPerfil: {
      sem_contrato: `O pedido de manutenção é aberto pelo contrato ("Problema com isto?" em Contratos) e aparece para quem tem contrato ativo pela plataforma. ${PRAZOS_MANUTENCAO}`,
      com_contrato: `Abra um chamado em "Manutenção no imóvel" (ou pelo "Problema com isto?" no seu contrato). ${PRAZOS_MANUTENCAO}`,
    },
  },
  {
    id: "golpe",
    pergunta: "Pediram para eu pagar por fora (Pix direto). É seguro?",
    resposta:
      "Não pague nada fora do que está no contrato assinado pela plataforma. A Viva Nomads nunca pede Pix ou depósito. Abra um chamado em \"Segurança, golpe ou pagamento por fora\" — uma pessoa da equipe responde com prioridade máxima.",
    termos: ["golpe", "pix", "por fora", "fraude", "pagamento"],
  },
  {
    id: "cancelar-pedido",
    pergunta: "Como cancelo um Pedido de Moradia?",
    resposta: "Em Pedidos de moradia, abra o seu pedido e use \"Pausar\" ou \"Marcar como atendido\". Ele sai do mural na hora.",
    termos: ["cancelar", "pedido", "pausar", "excluir pedido"],
  },
];

/** A resposta certa para quem está lendo. */
export function respostaPara(p: Pergunta, perfil: PerfilAjuda): string {
  return p.porPerfil?.[perfil] ?? p.resposta;
}

function normalizar(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Busca simples por palavras (pergunta, resposta e termos). */
export function buscarFaq(consulta: string, lista: Pergunta[] = FAQ): Pergunta[] {
  const palavras = normalizar(consulta)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 3);
  if (palavras.length === 0) return lista;
  return lista
    .map((p) => {
      const alvo = normalizar(`${p.pergunta} ${p.resposta} ${p.termos.join(" ")}`);
      const pontos = palavras.reduce((s, w) => s + (alvo.includes(w) ? (p.termos.some((t) => normalizar(t).includes(w)) ? 3 : 1) : 0), 0);
      return { p, pontos };
    })
    .filter((x) => x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .map((x) => x.p);
}
