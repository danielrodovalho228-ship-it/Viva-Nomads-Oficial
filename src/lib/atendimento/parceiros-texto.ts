/*
  Textos oficiais sobre PARCEIROS (ordem 7b7eaca9). FONTE ÚNICA para o chat da Viva
  (viva-prompt.ts), a Central de Ajuda (faq.ts) e os testes. Puro (node --test).
  Taxa: a taxa fixa por pedido (11/10) saiu no complemento do Prompt 29. Vale a taxa de serviço de 10%
  sobre o valor do serviço, para todas as categorias (texto único em config/taxa-servico-parceiros.ts).
*/
import { TEXTO_TAXA_SERVICO_PARCEIROS } from "../../config/taxa-servico-parceiros.ts";
import { PORTA_GESTOR_TEXTO } from "../../config/planos.ts";
import { TEXTO_PRAZO_PARCERIA } from "../../config/prazos-canais.ts";

/** E937: a validade do link de ativação da página — a mesma em /parceiros e na Ajuda. */
export const VALIDADE_LINK_ATIVACAO = "vale 7 dias, uma vez";
/** E937 (O-27): as duas regras que só existiam na Ajuda — agora também em /parceiros, pela mesma fonte. */
export const PAGAMENTO_DIRETO_TRANSITORIO = "Enquanto o pagamento pela plataforma não estiver ativo, o valor do serviço é combinado e pago direto entre parceiro e proprietário.";
export const ENDERECO_APOS_ACEITE = "O endereço do imóvel só chega ao parceiro depois que ele aceita o pedido.";
/** E935: a regra das relações do avaliador — a mesma frase da porta /parceiros/avaliadores e da Ajuda. */
export const REGRA_RELACOES_AVALIADOR = "Quem tem relação com o dono ou o imóvel fica de fora.";

export const TIPOS_PARCEIRO =
  "Categorias abertas: Fotografia, mudança, limpeza, lavanderia, montagem de móveis, manutenção e outros serviços para imóveis mobiliados. Empresas que hospedam equipes seguem por /empresas e gestores de imóveis pelo Plano Gestor.";

export const MODOS_CONTA =
  "Uma conta só: quem aluga ou anuncia pode ser parceiro na mesma conta. O pedido é feito em /parceiros (\"Seja parceiro\") ou na Conta (\"Quero ser parceiro\"), com o e-mail da conta confirmado. Aprovado, o item \"Parceiro\" aparece no menu do painel.";

// E860: o prazo da análise é o do canal parceiro (o mesmo de /parceiros), pela fonte única.
export const CADASTRO_PARCEIRO =
  `O pedido pede nome, empresa com CNPJ (MEI, onde a atividade permite; o CPF não é aceito), categorias, cidades e uma descrição; para fotografia, o link do portfólio; para mudança, a empresa e o veículo; se emite nota fiscal de serviço para o cliente; e, se quiser, um telefone, que nunca aparece em público. A equipe confere identidade e documento. ${TEXTO_PRAZO_PARCERIA} Aprovado, chega um link para ativar a página (${VALIDADE_LINK_ATIVACAO}): foto, capa, descrição, serviços com preço ou \"sob consulta\", galeria, redes, cidades e agenda. A página só vai ao ar quando o parceiro publica.`;

export const TAXA_PARCERIA_TEXTO = `${TEXTO_TAXA_SERVICO_PARCEIROS} Sem mensalidade e sem exclusividade. ${PAGAMENTO_DIRETO_TRANSITORIO}`;

export const CONTATO_NO_ACEITE = `O contato direto do proprietário não é trocado: a conversa com o parceiro fica nas mensagens da Viva. ${ENDERECO_APOS_ACEITE}`;

/**
 * E934 + E935: o artigo do avaliador credenciado. E934 — o caminho da página escrito (vira ligação pelas remissões da
 * Ajuda). E935 — a lista do que a Viva pede inclui a declaração de relações e a regra de exclusão da porta.
 */
export const AVALIADOR_TEXTO =
  `O avaliador credenciado faz a avaliação do imóvel pelo checklist da Viva. É independente: a Viva sugere os avaliadores da cidade, o dono escolhe quem quer e o avaliador define o próprio valor e prazo. Para pedir o credenciamento, abra a página Seja avaliador credenciado, em /parceiros/avaliadores, e toque em Pedir credenciamento: é um só pedido, mesmo para quem ainda não é parceiro. A Viva pede a identidade verificada, CNPJ válido (CPF não é aceito), experiência comprovada, o aceite do código de conduta, a declaração de relações e uma avaliação de teste revisada antes da primeira real. ${REGRA_RELACOES_AVALIADOR}`;

export const REGRAS_ENTREGA =
  "A contratação pela plataforma (orçamento, conversa, entrega e avaliação) chega em breve. Até lá, a página mostra os serviços e o parceiro é avaliado só por avaliações reais.";

export const BUSCA_FOTOGRAFOS =
  "Começamos por Uberlândia (MG) e avisamos quando chegarmos a outras cidades. A busca de parceiros é em /parceiros/buscar (categoria, cidade ou CEP); a de fotógrafos, em /parceiros/fotografos. Sem parceiro na cidade, dá para pedir aviso.";

export const CONTRATAR_FOTOGRAFO =
  "No passo Fotos do cadastro do imóvel, toque em \"Quer um fotógrafo profissional?\" para ver os fotógrafos parceiros da cidade do imóvel e a página de cada um. Você combina tudo pelas mensagens da Viva, e o seu contato não é trocado.";

export const EMPRESAS_E_GESTORES =
  `Empresa que quer moradia para funcionários: /empresas. Empresa que quer ser parceira (mudança, limpeza, montagem, manutenção): peça a parceria em /parceiros. Proprietário que quer anunciar imóveis mobiliados: crie a conta em /auth. Gestor ou administradora de imóveis: não é parceria separada; veja o Plano Gestor (taxa menor por volume, 12/10/8/6%, e Plano Gestor, 4% sem mensalidade, para ${PORTA_GESTOR_TEXTO}).`;

/** Bloco para o prompt da Viva. */
export function blocoParceirosPrompt(): string {
  return [
    TIPOS_PARCEIRO,
    MODOS_CONTA,
    CADASTRO_PARCEIRO,
    TAXA_PARCERIA_TEXTO,
    CONTATO_NO_ACEITE,
    REGRAS_ENTREGA,
    EMPRESAS_E_GESTORES,
    BUSCA_FOTOGRAFOS,
  ].join(" ");
}
