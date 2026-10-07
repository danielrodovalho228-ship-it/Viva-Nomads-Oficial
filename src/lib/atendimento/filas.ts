/*
  Atendimento — TRIAGEM e FILAS (PURO).
  Ao abrir o chamado, o texto refina a categoria escolhida (quem escolhe
  "Dúvida" e escreve sobre Caução cai em Caução) e a categoria define a FILA.
  Enquanto os agentes de cada fila não existem, todas chegam ao admin, já
  separadas. Sem migração: a fila é derivada da categoria (coluna livre).
*/
import { detectarRiscoP1 } from "./classificar.ts";

export type Fila = "suporte" | "manutencao_caucao" | "antifraude" | "financeiro" | "anuncios";

export const FILAS: Record<Fila, { rotulo: string; agente: string; categorias: string[] }> = {
  suporte: { rotulo: "Suporte (Viva)", agente: "viva", categorias: ["duvida", "conta", "contrato", "conflito", "sugestao"] },
  manutencao_caucao: { rotulo: "Manutenção e Caução (Caio)", agente: "caio", categorias: ["manutencao", "caucao", "imovel", "acesso_imovel"] },
  antifraude: { rotulo: "Antifraude (Fernanda)", agente: "fernanda", categorias: ["seguranca"] },
  financeiro: { rotulo: "Financeiro (Igor)", agente: "igor", categorias: ["cobranca"] },
  anuncios: { rotulo: "Anúncios (Vitória)", agente: "vitoria", categorias: ["anuncio", "documentos"] },
};

export const ORDEM_FILAS: Fila[] = ["antifraude", "manutencao_caucao", "financeiro", "anuncios", "suporte"];

export function filaDaCategoria(categoria: string | null | undefined): Fila {
  const c = categoria ?? "";
  return (ORDEM_FILAS.find((f) => FILAS[f].categorias.includes(c)) ?? "suporte") as Fila;
}

export function ehFila(v: unknown): v is Fila {
  return typeof v === "string" && v in FILAS;
}

const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");

const GOLPE = /\b(golpe|golpista|fraude|estelionat\w*|link falso|link suspeito|site falso)\b|\b(pix|transferencia|deposito|pagar|pagamento)\b.{0,40}\b(direto|por fora|pra ele|para ele|pra ela|para ela|fora da plataforma)\b|\b(direto|por fora)\b.{0,30}\b(pix|pagamento|caucao|aluguel)\b/;
const CAUCAO = /\bcaucao\b|\bdeposito de garantia\b|\bdevolu\w* (da|do) (caucao|deposito)\b/;
const IMOVEL = /\b(vazament\w*|vazando|goteira|infiltra\w*|quebr\w*|estragad\w*|consert\w*|manutencao|chuveiro|torneira|descarga|geladeira|fogao|ar.condicionado|internet caiu|sem agua|sem luz)\b/;
const COBRANCA = /\b(cobranca|cobrad[oa]|boleto|fatura|assinatura|plano|mensalidade|estorno|reembolso|cartao)\b/;
const ANUNCIO = /\b(anuncio|anunciar|publicar|publicacao|fotos?|matricula|iptu|documento|documentacao|escritura)\b/;

/**
 * Categoria FINAL a partir da escolhida e do texto:
 *  • golpe ou pagamento por fora → "seguranca" (P1, Antifraude), sempre;
 *  • Caução no texto → "caucao", quando a escolha foi genérica (Dúvida/Contrato);
 *  • na "Dúvida": defeito no imóvel → "imovel"; cobrança/plano → "cobranca";
 *    anúncio/documentos → "anuncio" (ou "documentos").
 * Categorias específicas (manutenção, conta, conflito…) ficam como a pessoa escolheu.
 */
export function triagem(escolhida: string, texto: string): string {
  const t = norm(texto);
  if (GOLPE.test(t)) return "seguranca";
  if ((escolhida === "duvida" || escolhida === "contrato") && CAUCAO.test(t)) return "caucao";
  if (escolhida !== "duvida") return escolhida;
  if (IMOVEL.test(t)) return "imovel";
  if (COBRANCA.test(t)) return "cobranca";
  if (ANUNCIO.test(t)) return /\b(documento|documentacao|matricula|iptu|escritura)\b/.test(t) ? "documentos" : "anuncio";
  return escolhida;
}

/** Atalho usado nos testes e no chat: fila + se vira P1 pelo texto. */
export function triar(escolhida: string, texto: string): { categoria: string; fila: Fila; p1: boolean } {
  const categoria = triagem(escolhida, texto);
  return { categoria, fila: filaDaCategoria(categoria), p1: detectarRiscoP1(texto) };
}
