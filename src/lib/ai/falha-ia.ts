import Anthropic from "@anthropic-ai/sdk";

/*
  Prompt 22 (QA do Muse, 18/10): a IA do cadastro (fotos, documento, matrícula) NUNCA falha em silêncio. Cada falha
  vira um MOTIVO que a tela mostra ("arquivo grande demais", "imagem ilegível", "leitura indisponível agora — tente de
  novo") e uma linha no registro ia_chamadas (0163), sem dado pessoal: status HTTP, tipo do erro, tipo e tamanho do
  arquivo, modelo. Arquivo puro (sem "server-only"): a rota e os testes usam o mesmo código.
*/

export type RotaIa = "fotos" | "documento" | "matricula";
export type MotivoFalhaIa = "desligada" | "limite" | "arquivo_grande" | "ilegivel" | "indisponivel";

export interface FalhaIa {
  motivo: MotivoFalhaIa;
  /** Status HTTP da API (null: sem resposta — rede, tempo esgotado, resposta inválida). */
  status: number | null;
  /** Tipo curto do erro, para o admin (ex.: "invalid_request_error", "conexao", "json_invalido", "max_tokens"). */
  tipo: string;
}

/** O que a tela diz em cada caso (o dono sempre sabe o que houve e o que fazer). */
export const MENSAGEM_FALHA_IA: Record<MotivoFalhaIa, string> = {
  desligada: "A IA do cadastro está desligada no momento. Você preenche os campos na próxima etapa.",
  limite: "Limite de análises por hoje atingido. Tente de novo amanhã ou preencha os campos na próxima etapa.",
  arquivo_grande: "Arquivo grande demais para a leitura automática. Envie um PDF ou uma foto menor.",
  ilegivel: "Imagem ilegível. Envie uma foto mais nítida, com o documento inteiro e boa luz.",
  indisponivel: "Leitura indisponível agora — tente de novo em alguns minutos.",
};

/** Mensagens de erro da API que indicam arquivo grande demais (imagem acima do limite, páginas demais, pedido grande). */
const RE_GRANDE = /too large|exceed|maximum|size|dimension|pixels|pages|request_too_large/i;

/**
 * Classifica uma falha da chamada à IA. Usa as classes do SDK (status e tipo do corpo), nunca o texto para decidir
 * entre "tente de novo" e "não adianta tentar"; o texto só separa "arquivo grande" dos outros 400.
 */
export function classificarFalhaIa(e: unknown): FalhaIa {
  if (e instanceof Anthropic.APIConnectionTimeoutError) return { motivo: "indisponivel", status: null, tipo: "tempo_esgotado" };
  if (e instanceof Anthropic.APIConnectionError) return { motivo: "indisponivel", status: null, tipo: "conexao" };
  if (e instanceof Anthropic.APIError) {
    const status = typeof e.status === "number" ? e.status : null;
    // Tipo do erro: o que o SDK leu do corpo (`type`) ou, se não leu, o `error.type` do corpo da resposta.
    const doCorpo = (e.error as { error?: { type?: unknown } } | undefined)?.error?.type;
    const tipo = (e.type ?? (typeof doCorpo === "string" ? doCorpo : null) ?? (status ? `http_${status}` : "api")).slice(0, 60);
    if (status === 413) return { motivo: "arquivo_grande", status, tipo };
    if (e instanceof Anthropic.BadRequestError && RE_GRANDE.test(e.message)) return { motivo: "arquivo_grande", status, tipo };
    return { motivo: "indisponivel", status, tipo };
  }
  if (e instanceof SyntaxError) return { motivo: "ilegivel", status: 200, tipo: "json_invalido" };
  if (e instanceof RespostaIaIncompleta) return { motivo: e.motivo, status: 200, tipo: e.tipo };
  return { motivo: "indisponivel", status: null, tipo: "desconhecido" };
}

/** A API respondeu, mas a resposta não serve (cortada por max_tokens, recusa, sem texto). */
export class RespostaIaIncompleta extends Error {
  readonly motivo: MotivoFalhaIa;
  readonly tipo: string;
  constructor(tipo: "max_tokens" | "refusal" | "sem_texto") {
    super(`Resposta da IA incompleta: ${tipo}`);
    this.name = "RespostaIaIncompleta";
    this.tipo = tipo;
    // Recusa ou nada lido: o documento não deu para ler. Cortada no meio: tente de novo (é do nosso lado).
    this.motivo = tipo === "max_tokens" ? "indisponivel" : "ilegivel";
  }
}

/** Texto da resposta, ou lança RespostaIaIncompleta (nunca entrega JSON cortado para o JSON.parse). */
export function textoDaResposta(res: Pick<Anthropic.Message, "content" | "stop_reason">): string {
  if (res.stop_reason === "max_tokens") throw new RespostaIaIncompleta("max_tokens");
  if (res.stop_reason === "refusal") throw new RespostaIaIncompleta("refusal");
  const bloco = res.content.find((b) => b.type === "text");
  if (!bloco || bloco.type !== "text" || !bloco.text.trim()) throw new RespostaIaIncompleta("sem_texto");
  return bloco.text;
}

/**
 * Status HTTP da rota /api/ai/fotos → motivo para a tela (a tela não depende do texto do erro para decidir).
 * 503 = IA desligada ou fora do ar; 429 = limite do dia; 413 = fotos demais; 422 = não parece imóvel.
 */
export function motivoDoStatusFotos(status: number, desligada: boolean): MotivoFalhaIa {
  if (status === 429) return "limite";
  if (status === 413) return "arquivo_grande";
  if (status === 422) return "ilegivel";
  if (status === 503 && desligada) return "desligada";
  return "indisponivel";
}

/** A IA do cadastro está ligada? (laboratório simulado conta como ligada; produção exige a flag E a chave). */
export function iaCadastroLigada(env: { simulado: boolean; flag: boolean; chave: boolean }): boolean {
  return env.simulado || (env.flag && env.chave);
}
