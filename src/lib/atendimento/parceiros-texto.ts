/*
  Textos oficiais sobre PARCEIROS (ordem 7b7eaca9). FONTE ÚNICA para o chat da Viva
  (viva-prompt.ts), a Central de Ajuda (faq.ts) e os testes. Puro (node --test).
  Taxa: a taxa fixa por pedido (11/10) saiu no complemento do Prompt 29. Vale a taxa de serviço de 10%
  sobre o valor do serviço, para todas as categorias (texto único em config/taxa-servico-parceiros.ts).
*/
import { TEXTO_TAXA_SERVICO_PARCEIROS } from "../../config/taxa-servico-parceiros.ts";

export const TIPOS_PARCEIRO =
  "Categorias abertas: Fotografia, mudança, limpeza, lavanderia, montagem de móveis, manutenção e outros serviços para imóveis mobiliados. Empresas que hospedam equipes seguem por /empresas e gestores de imóveis pelo Plano Gestor.";

export const MODOS_CONTA =
  "Uma conta só: quem aluga ou anuncia pode ser parceiro na mesma conta. O pedido é feito em /parceiros (\"Seja parceiro\") ou na Conta (\"Quero ser parceiro\"), com o e-mail da conta confirmado. Aprovado, o item \"Parceiro\" aparece no menu do painel.";

export const CADASTRO_PARCEIRO =
  "O pedido pede nome, pessoa física (CPF) ou empresa/MEI (CNPJ), categorias, cidades e uma descrição; para fotografia, o link do portfólio; para mudança, a empresa e o veículo. A equipe confere identidade e documento e responde por e-mail. Aprovado, chega um link para ativar a página (vale 7 dias, uma vez): foto, capa, descrição, serviços com preço ou \"sob consulta\", galeria, redes, cidades e agenda. A página só vai ao ar quando o parceiro publica.";

export const TAXA_PARCERIA_TEXTO = `${TEXTO_TAXA_SERVICO_PARCEIROS} Sem mensalidade e sem exclusividade. Enquanto o pagamento pela plataforma não estiver ativo, o valor do serviço é combinado e pago direto entre parceiro e proprietário.`;

export const CONTATO_NO_ACEITE =
  "O contato e o endereço do proprietário só são liberados ao parceiro depois que ele aceita o pedido. Antes disso ficam protegidos.";

export const REGRAS_ENTREGA =
  "A contratação pela plataforma (orçamento, conversa, entrega e avaliação) chega em breve. Até lá, a página mostra os serviços e o parceiro é avaliado só por avaliações reais.";

export const BUSCA_FOTOGRAFOS =
  "Começamos por Uberlândia (MG) e avisamos quando chegarmos a outras cidades. A busca de parceiros é em /parceiros/buscar (categoria, cidade ou CEP); a de fotógrafos, em /parceiros/fotografos. Sem parceiro na cidade, dá para pedir aviso.";

export const CONTRATAR_FOTOGRAFO =
  "No passo Fotos do cadastro do imóvel, toque em \"Quer um fotógrafo profissional?\" para ver os fotógrafos parceiros da cidade do imóvel e a página de cada um. Você combina tudo pelas mensagens da Viva; contato e endereço só depois do aceite.";

export const EMPRESAS_E_GESTORES =
  "Empresa que quer moradia para funcionários: /empresas. Empresa que quer ser parceira (mudança, limpeza, montagem, manutenção): peça a parceria em /parceiros. Proprietário que quer anunciar imóveis mobiliados: crie a conta em /auth. Gestor ou administradora de imóveis: não é parceria separada; veja o Plano Gestor (taxa menor por volume, 12/10/8/6%, e Plano Gestor para quem tem 31 imóveis ativos ou mais).";

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
