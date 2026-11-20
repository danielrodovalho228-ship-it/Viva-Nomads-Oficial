/*
  E679-B — avaliações: critérios FIXOS por par, etiquetas rápidas, "recomendaria", e a regra
  "fato falso × caução". Regras PURAS (sem imports @/). Espelham os checks da migração 0322.

  Pares (mockups aprovados em 07/11/2026):
    morador_avalia_dono     imóvel como no anúncio · limpeza na chegada · comunicação
    dono_avalia_morador     cuidado com o imóvel · regras da casa · comunicação
    cliente_avalia_parceiro qualidade · pontualidade · cuidado com o imóvel
    parceiro_avalia_cliente comunicação · imóvel pronto para o serviço · combinado cumprido
*/
import { contemOfensa, LIMITE_COMENTARIO } from "./avaliacoes.ts";
import { contemContato } from "./pedidos/pedidos.ts";

export type ParAvaliacao = "morador_avalia_dono" | "dono_avalia_morador" | "cliente_avalia_parceiro" | "parceiro_avalia_cliente";

export const CRITERIOS: Record<ParAvaliacao, readonly { chave: string; rotulo: string }[]> = {
  morador_avalia_dono: [
    { chave: "imovel_como_anuncio", rotulo: "Imóvel como no anúncio" },
    { chave: "limpeza_chegada", rotulo: "Limpeza na chegada" },
    { chave: "comunicacao", rotulo: "Comunicação" },
  ],
  dono_avalia_morador: [
    { chave: "cuidado_imovel", rotulo: "Cuidado com o imóvel" },
    { chave: "regras_casa", rotulo: "Regras da casa" },
    { chave: "comunicacao", rotulo: "Comunicação" },
  ],
  cliente_avalia_parceiro: [
    { chave: "qualidade", rotulo: "Qualidade" },
    { chave: "pontualidade", rotulo: "Pontualidade" },
    { chave: "cuidado_imovel", rotulo: "Cuidado com o imóvel" },
  ],
  parceiro_avalia_cliente: [
    { chave: "comunicacao", rotulo: "Comunicação" },
    { chave: "imovel_pronto", rotulo: "Imóvel pronto para o serviço" },
    { chave: "combinado_cumprido", rotulo: "Combinado cumprido" },
  ],
};

export const chavesDoPar = (par: ParAvaliacao): string[] => CRITERIOS[par].map((c) => c.chave);

/** Etiquetas rápidas por par (positivas e neutras; nunca sobre dano, sujeira ou caução). */
export const ETIQUETAS: Record<ParAvaliacao, readonly string[]> = {
  morador_avalia_dono: ["Anúncio fiel", "Casa limpa", "Respondeu rápido", "Entrega de chaves tranquila", "Resolveu o que precisei", "Voltaria a alugar"],
  dono_avalia_morador: ["Cuidou bem da casa", "Respeitou as regras", "Respondeu rápido", "Saída combinada", "Pagou em dia", "Deixou a casa em ordem"],
  cliente_avalia_parceiro: ["Serviço bem feito", "Chegou no horário", "Cuidadoso", "Explicou o que fez", "Preço como combinado", "Deixou tudo em ordem"],
  parceiro_avalia_cliente: ["Acesso liberado", "Imóvel pronto", "Respondeu rápido", "Combinado respeitado", "Pagou como combinado", "Foi cordial"],
};

/** No máximo 5 etiquetas por avaliação (o banco aceita até 12; o desenho fica mais curto). */
export const MAX_ETIQUETAS = 5;

export interface EntradaAvaliacao {
  notaGeral: number;
  criterios: Record<string, unknown>;
  etiquetas: string[];
  recomendaria: boolean | null;
  comentarioPublico?: string | null;
}

export type ResultadoAvaliacao =
  | { ok: true; moderacao: boolean; notaGeral: number; criterios: Record<string, number>; etiquetas: string[]; recomendaria: boolean; comentarioPublico: string | null }
  | { ok: false; erro: string };

const inteiro1a5 = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5;

const RE_DOCUMENTO = /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/;

/** Dado pessoal no texto: contato (telefone, e-mail, rede) ou documento. Vai para a moderação, não é recusado. */
export const temDadoPessoal = (t: string): boolean => contemContato(t) || RE_DOCUMENTO.test(t);

/**
 * Valida a avaliação inteira do par. Texto com ofensa ou dado pessoal NÃO é recusado: a avaliação é gravada e vai
 * para `em_moderacao` (moderação só por ofensa ou dado pessoal; nota baixa legítima nunca é barrada nem apagada).
 */
export function validarAvaliacaoCompleta(par: ParAvaliacao, e: EntradaAvaliacao): ResultadoAvaliacao {
  if (!inteiro1a5(e.notaGeral)) return { ok: false, erro: "Escolha a nota geral, de 1 a 5." };
  const chaves = chavesDoPar(par);
  const recebidas = Object.keys(e.criterios ?? {});
  if (recebidas.some((k) => !chaves.includes(k))) return { ok: false, erro: "Esse critério não existe nesta avaliação." };
  const criterios: Record<string, number> = {};
  for (const c of CRITERIOS[par]) {
    const n = e.criterios?.[c.chave];
    if (!inteiro1a5(n)) return { ok: false, erro: `Dê uma nota de 1 a 5 para "${c.rotulo}".` };
    criterios[c.chave] = n;
  }
  const etiquetas = e.etiquetas ?? [];
  if (new Set(etiquetas).size !== etiquetas.length) return { ok: false, erro: "Etiqueta repetida." };
  if (etiquetas.length > MAX_ETIQUETAS) return { ok: false, erro: `Escolha até ${MAX_ETIQUETAS} etiquetas.` };
  if (etiquetas.some((t) => !ETIQUETAS[par].includes(t))) return { ok: false, erro: "Etiqueta inválida." };
  if (typeof e.recomendaria !== "boolean") return { ok: false, erro: "Diga se recomendaria (sim ou não)." };
  const comentario = (e.comentarioPublico ?? "").trim();
  if (comentario.length > LIMITE_COMENTARIO) return { ok: false, erro: `Comentário muito longo (máx. ${LIMITE_COMENTARIO}).` };
  return {
    ok: true,
    moderacao: !!comentario && (temDadoPessoal(comentario) || contemOfensa(comentario)),
    notaGeral: e.notaGeral,
    criterios,
    etiquetas,
    recomendaria: e.recomendaria,
    comentarioPublico: comentario || null,
  };
}

/**
 * "Fato falso" só vale para fato VERIFICÁVEL pela Viva (a estadia não aconteceu; o avaliador não foi).
 * Nunca sobre dano, sujeira ou valor de caução: a avaliação pública não é prova em disputa de caução e a Viva não a
 * usa para decidir a disputa. A mesma regra está no gatilho do banco (0322).
 */
export const RE_ASSUNTO_CAUCAO =
  /(?<![\p{L}\d])(cau[cç][aã]o|dep[oó]sito|garantia|dano|danific|estrag|quebr|sujeir|sujo|suja|limpeza|conserto|desconto|descontad|ressarc|indeniza|devolu[cç][aã]o)/iu;

export const TEXTO_FATO_FALSO_CAUCAO =
  "“Fato falso” vale só para o que a Viva consegue conferir (por exemplo, a estadia não aconteceu). Dano, sujeira e valor de caução não entram aqui: a avaliação não decide a disputa da caução.";

export function validarFatoFalso(detalhe: string | null | undefined): { ok: true } | { ok: false; erro: string } {
  const d = (detalhe ?? "").trim();
  if (d.length < 20) return { ok: false, erro: "Explique em pelo menos 20 caracteres." };
  if (d.length > 500) return { ok: false, erro: "Explicação muito longa (máx. 500)." };
  if (RE_ASSUNTO_CAUCAO.test(d)) return { ok: false, erro: TEXTO_FATO_FALSO_CAUCAO };
  return { ok: true };
}

/**
 * Quem lê o quê no pedido de parceiro. A nota do CLIENTE sobre o PARCEIRO aparece às duas partes depois de publicada.
 * A nota do PARCEIRO sobre o CLIENTE só é lida por outros parceiros (premissa fechada do Daniel): o cliente avaliado
 * não a vê na tela do pedido, e ela nunca aparece no perfil público nem para proprietário/morador.
 */
export function podeLerAvaliacaoDoPedido(leitor: "cliente" | "parceiro", papelAutor: "cliente" | "parceiro"): boolean {
  // Nota do cliente: as duas partes. Nota do parceiro: só o próprio parceiro (autor) dentro do pedido.
  return papelAutor === "cliente" || leitor === "parceiro";
}
