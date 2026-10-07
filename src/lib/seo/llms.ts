/*
  /llms.txt e /llms-full.txt — resumo do Viva Nomads para assistentes de IA
  (formato llmstxt.org). Só fatos públicos e fontes oficiais do próprio site
  (planos, regras do contrato, FAQ). Nenhum imóvel de exemplo.
*/
import { FAQ } from "../atendimento/faq.ts";
import { PLANOS, REGRAS_CONTRATO, textoComissao, ALUGUEL_EXEMPLO } from "../../config/planos.ts";

const PAGINAS: [string, string, string][] = [
  ["Como funciona", "/como-funciona", "o passo a passo para inquilinos e proprietários"],
  ["Buscar imóveis", "/buscar", "imóveis mobiliados disponíveis, com filtros por cidade, preço e período"],
  ["Para proprietários", "/para-proprietarios", "como anunciar e qualificar um imóvel"],
  ["Planos e preços", "/precos", "planos para proprietários e comparação com o Airbnb"],
  ["Para empresas", "/empresas", "moradia para equipes e profissionais transferidos"],
  ["Sua segurança", "/seguranca", "contrato, Caução, conversa registrada e proteção contra golpe"],
  ["Central de Ajuda", "/ajuda", "perguntas frequentes, chat com a assistente virtual e chamados"],
  ["Conferir documento", "/conferir", "confere se um recibo emitido pela plataforma é verdadeiro"],
  ["Termos de Uso", "/termos", ""],
  ["Privacidade", "/privacidade", ""],
];

function cabecalho(): string {
  return [
    "# Viva Nomads",
    "",
    `> Plataforma brasileira de locação de imóveis mobiliados por temporada, de ${REGRAS_CONTRATO.prazoMinMeses} a ${REGRAS_CONTRATO.prazoMaxMeses} meses (até ${REGRAS_CONTRATO.prazoMaxDias} dias), para profissionais em transição. Contrato com validade jurídica, Caução como garantia e toda a conversa registrada na plataforma. O inquilino não paga taxa à plataforma; o proprietário paga uma comissão única por contrato ou uma assinatura.`,
    "",
    "Regras que não mudam: o contato direto (telefone, e-mail, redes) não é trocado antes do aceite; a Viva Nomads nunca pede Pix ou depósito fora do contrato da plataforma; não é locadora, fiadora nem intermediária de pagamento.",
  ].join("\n");
}

export function llmsTxt(siteUrl: string): string {
  return [
    cabecalho(),
    "",
    "## Páginas",
    ...PAGINAS.map(([nome, path, desc]) => `- [${nome}](${siteUrl}${path})${desc ? `: ${desc}` : ""}`),
    "",
    "## Mais detalhes",
    `- [Versão completa para IA](${siteUrl}/llms-full.txt): planos, regras do contrato e perguntas frequentes`,
    "",
  ].join("\n");
}

export function llmsFullTxt(siteUrl: string): string {
  const planos = PLANOS.map(
    (p) =>
      `- ${p.nome} (${p.publico}): ${p.precoMensal === null ? "assinatura sob consulta" : p.precoMensal > 0 ? `R$ ${p.precoMensal}/mês` : "sem mensalidade"}; comissão: ${textoComissao(p.comissao, ALUGUEL_EXEMPLO)} num aluguel de R$ ${ALUGUEL_EXEMPLO.toLocaleString("pt-BR")}; ${p.limiteAnuncios >= 999 ? "anúncios ilimitados" : p.limiteAnuncios === 1 ? "até 1 anúncio ativo" : `até ${p.limiteAnuncios} anúncios ativos`}.`
  );
  return [
    cabecalho(),
    "",
    "## Planos para proprietários",
    ...planos,
    "",
    "## Regras do contrato",
    `- Locação por temporada (art. 48 da Lei 8.245/91): de ${REGRAS_CONTRATO.prazoMinMeses} a ${REGRAS_CONTRATO.prazoMaxMeses} meses, em blocos de até ${REGRAS_CONTRATO.maxDiasBloco} dias.`,
    `- Caução: ${Math.round(REGRAS_CONTRATO.caucaoFracaoBloco * 100)}% do valor de cada bloco, até ${REGRAS_CONTRATO.caucaoMaxAlugueis} aluguéis no total; volta no fim, depois da vistoria de saída.`,
    "",
    "## Perguntas frequentes",
    ...FAQ.flatMap((p) => [`### ${p.pergunta}`, p.resposta, ""]),
    "## Páginas",
    ...PAGINAS.map(([nome, path]) => `- [${nome}](${siteUrl}${path})`),
    "",
  ].join("\n");
}
