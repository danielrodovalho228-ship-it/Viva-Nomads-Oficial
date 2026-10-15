/*
  /llms.txt e /llms-full.txt — resumo do Viva Nomads para assistentes de IA
  (formato llmstxt.org). Só fatos públicos e fontes oficiais do próprio site
  (preço, regras do contrato, FAQ). Nenhum imóvel de exemplo.
*/
import { FAQ } from "../atendimento/faq.ts";
import { REGRAS_CONTRATO } from "../../config/planos.ts";
import { TEXTO_REGRA_UNICA } from "../cobranca/regra.ts";

const PAGINAS: [string, string, string][] = [
  ["Como funciona", "/como-funciona", "o passo a passo para inquilinos e proprietários"],
  ["Buscar imóveis", "/buscar", "imóveis mobiliados disponíveis, com filtros por cidade, preço e período"],
  ["Para proprietários", "/para-proprietarios", "como anunciar e qualificar um imóvel"],
  ["Planos e preços", "/precos", "taxa sobre o valor total do contrato fechado (12%, menor com mais imóveis) e comparação"],
  ["Para empresas", "/empresas", "moradia para equipes e profissionais transferidos"],
  ["Sua segurança", "/seguranca", "contrato, Caução, conversa registrada e proteção contra golpe"],
  ["Central de Ajuda", "/ajuda", "perguntas frequentes, chat com a assistente virtual e chamados"],
  ["Guias", "/guias", "guias sobre preço da estadia, Caução, conferência de entrada, bairro e documentos"],
  ["Conferir documento", "/conferir", "confere se um recibo emitido pela plataforma é verdadeiro"],
  ["Termos de Uso", "/termos", ""],
  ["Privacidade", "/privacidade", ""],
];

function cabecalho(): string {
  return [
    "# Viva Nomads",
    "",
    `> Plataforma brasileira de locação de imóveis mobiliados para estadias de ${REGRAS_CONTRATO.prazoMinMeses} a ${REGRAS_CONTRATO.prazoMaxMeses} meses (até ${REGRAS_CONTRATO.prazoMaxDias} dias), para profissionais em transição. Contrato com validade jurídica, Caução como garantia e toda a conversa registrada na plataforma. O inquilino não paga taxa à plataforma; o proprietário paga só uma taxa sobre o valor total do contrato fechado (12%, menor com mais imóveis), sem mensalidade.`,
    "",
    "Plataforma em fase de testes. Lançamento oficial em 2027.",
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
    `- [Versão completa para IA](${siteUrl}/llms-full.txt): preço, regras do contrato e perguntas frequentes`,
    "",
  ].join("\n");
}

export function llmsFullTxt(siteUrl: string): string {
  return [
    cabecalho(),
    "",
    "## Preços para proprietários",
    `- ${TEXTO_REGRA_UNICA}`,
    "",
    "## Regras do contrato",
    `- Estadias de ${REGRAS_CONTRATO.prazoMinMeses} a ${REGRAS_CONTRATO.prazoMaxMeses} meses, em blocos de até ${REGRAS_CONTRATO.maxDiasBloco} dias.`,
    `- Caução: ${Math.round(REGRAS_CONTRATO.caucaoFracaoBloco * 100)}% do valor de cada bloco, até ${REGRAS_CONTRATO.caucaoMaxAlugueis} aluguéis no total; volta no fim, depois da conferência de saída.`,
    "",
    "## Perguntas frequentes",
    ...FAQ.flatMap((p) => [`### ${p.pergunta}`, p.resposta, ""]),
    "## Páginas",
    ...PAGINAS.map(([nome, path]) => `- [${nome}](${siteUrl}${path})`),
    "",
  ].join("\n");
}
