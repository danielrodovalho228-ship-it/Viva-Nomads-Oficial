/*
  Textos oficiais sobre PARCEIROS (ordem 7b7eaca9). FONTE ÚNICA para o chat da Viva
  (viva-prompt.ts), a Central de Ajuda (faq.ts) e os testes. Puro (node --test).
  Decisões do Daniel em 11/10: taxa de parceria 40/60/80 por tamanho do pacote,
  paga só ao aceitar o pedido; sem mensalidade; a Viva não recebe o dinheiro do serviço.
*/

export const TIPOS_PARCEIRO =
  "Fotografia (aberto agora); limpeza, manutenção, mobília/enxoval e seguro entram em lista de espera por cidade (em breve). Empresas que hospedam equipes seguem por /empresas e gestores de imóveis pelo Plano Gestor.";

export const MODOS_CONTA =
  "Uma conta só, com até três modos: Proprietário, Inquilino e Parceiro. O modo Parceiro é ativado em /parceiros (\"Quero ser parceiro\"), ou na Conta, no cartão \"Ativar perfil de parceiro\", sem novo cadastro. Ele só aparece no chip do topo depois de ativado.";

export const CADASTRO_PARCEIRO =
  "O cadastro tem 4 passos: tipo de serviço; negócio (nome comercial, CNPJ ou MEI, cidades atendidas); vitrine (pelo menos 6 fotos de portfólio e os pacotes); e o termo de parceria. Depois a equipe analisa: aprova, pede ajuste ou recusa com motivo, e o parceiro acompanha o andamento no app. O perfil só aparece no site depois de aprovado.";

export const TAXA_PARCERIA_TEXTO =
  "A taxa de parceria é R$ 40 até 20 fotos, R$ 60 de 21 a 40 fotos e R$ 80 acima de 40 fotos. É paga pelo parceiro só ao aceitar um pedido; sem mensalidade e sem exclusividade. O valor aparece antes do aceite. A Viva não recebe o dinheiro do serviço: o valor do serviço é combinado entre parceiro e proprietário.";

export const CONTATO_NO_ACEITE =
  "O contato e o endereço do proprietário só são liberados ao parceiro depois que ele aceita o pedido e paga a taxa de parceria. Antes disso ficam protegidos.";

export const REGRAS_ENTREGA =
  "Depois da entrega das fotos, o proprietário aprova ou pede ajuste (até 2 vezes); sem resposta em 5 dias, a entrega é aprovada automaticamente. Se o proprietário cancelar depois do aceite, a taxa paga vira crédito para o parceiro. Se o parceiro não entregar, perde a taxa e recebe uma advertência; com 2 advertências, o perfil é suspenso.";

export const BUSCA_FOTOGRAFOS =
  "Começamos por Uberlândia (MG) e avisamos quando chegarmos a outras cidades. A busca de fotógrafos funciona por CEP: o proprietário informa o CEP do imóvel no passo Fotos do cadastro e vê os fotógrafos que atendem a região, em /parceiros/fotografos.";

export const CONTRATAR_FOTOGRAFO =
  "No passo Fotos do cadastro do imóvel, escolha \"Contratar fotógrafo parceiro\", veja quem atende o CEP do imóvel, escolha o pacote e envie o pedido. O contato do fotógrafo vem depois que ele aceita; o rascunho fica \"Aguardando fotos do fotógrafo\" e você segue preenchendo à mão.";

export const EMPRESAS_E_GESTORES =
  "Empresa que quer moradia para funcionários: /empresas. Empresa que quer ser parceira (limpeza, manutenção, mobília, seguro): deixe seu contato em /parceiros (em breve). Proprietário que quer anunciar imóveis mobiliados: crie a conta em /auth. Gestor ou administradora de imóveis: não é parceria separada; veja o Plano Gestor (taxa menor por volume, 12/10/8/6%, e Plano Gestor para quem tem 31 imóveis ativos ou mais).";

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
