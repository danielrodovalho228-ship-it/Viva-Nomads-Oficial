/*
  Fechamento da conferência de entrada/saída (Prompt 56, D5) — PURO, node --test.
  O hash de fechamento cobre itens, fotos (o hash de cada arquivo), respostas e laudo. Ele é gravado uma vez, quando
  as duas partes respondem, quando a janela da entrada (48 h do 35B) encerra ou quando a equipe conclui o
  encerramento (saída). Depois dele nada muda; a correção vira versão nova (CND … v2) com motivo.
*/

export type MotivoFechamento = "duas_respostas" | "janela_encerrada" | "encerramento_concluido";
export type ParteFechamento = "proprietario" | "inquilino";

export interface EstadoParaFechar {
  conferenciaId: string;
  contrato: string;
  tipo: "entrada" | "saida";
  itens: { parte: ParteFechamento; comodo: string; descricao: string; fotoPath: string | null; criadoEm: string }[];
  respostas: { parte: ParteFechamento; decisao: string; motivo: string | null; decididoEm: string }[];
  laudo: { path: string; parte: ParteFechamento; criadoEm: string } | null;
  /** Hash (sha256) de cada arquivo: fotos e laudo, pelo caminho. */
  hashes: Record<string, string>;
}

export const ROTULO_FECHAMENTO: Record<MotivoFechamento, string> = {
  duas_respostas: "as duas partes responderam",
  janela_encerrada: "o prazo da conferência de entrada encerrou",
  encerramento_concluido: "a equipe concluiu o encerramento",
};

/** Quem não respondeu (fica registrado no fechamento). */
export function semResposta(e: Pick<EstadoParaFechar, "respostas">): ParteFechamento[] {
  const responderam = new Set(e.respostas.map((r) => r.parte));
  return (["proprietario", "inquilino"] as const).filter((p) => !responderam.has(p));
}

/** As duas partes responderam: é hora de fechar. */
export function prontaParaFechar(respostas: { parte: ParteFechamento }[]): boolean {
  return new Set(respostas.map((r) => r.parte)).size >= 2;
}

/**
 * O conteúdo canônico do fechamento (o hash sai dele): ordem estável, cada foto e o laudo pelo hash do ARQUIVO.
 * Mudar qualquer item, foto, resposta ou laudo muda o hash.
 */
export function conteudoFechamento(e: EstadoParaFechar, motivo: MotivoFechamento): string {
  const itens = [...e.itens].sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : a.criadoEm > b.criadoEm ? 1 : a.comodo.localeCompare(b.comodo)));
  const respostas = [...e.respostas].sort((a, b) => a.parte.localeCompare(b.parte));
  return [
    `Conferência de ${e.tipo} · contrato ${e.contrato} · ${e.conferenciaId}`,
    `Fechada porque ${ROTULO_FECHAMENTO[motivo]}.`,
    ...itens.map((i) => `Item (${i.parte}) ${i.comodo}: ${i.descricao}${i.fotoPath ? ` · foto sha256 ${e.hashes[i.fotoPath] ?? "indisponível"}` : ""}`),
    ...respostas.map((r) => `Resposta (${r.parte}) ${r.decisao} em ${r.decididoEm}${r.motivo ? ` · motivo: ${r.motivo}` : ""}`),
    ...semResposta(e).map((p) => `Sem resposta: ${p}`),
    e.laudo ? `Laudo (${e.laudo.parte}) sha256 ${e.hashes[e.laudo.path] ?? "indisponível"}` : "Sem laudo",
  ].join("\n");
}

/** Conteúdo de uma correção (CND … vN): o hash do fechamento original, o motivo e o texto. */
export function conteudoCorrecao(p: { fechamentoHash: string; versao: number; motivo: string; texto: string }): string {
  return [`Correção v${p.versao} da conferência fechada (sha256 ${p.fechamentoHash})`, `Motivo: ${p.motivo.trim()}`, p.texto.trim()].join("\n");
}

/** A marca "precisa de reparo" (Prompt 38) só pode ser feita antes do fechamento. */
export function podeMarcarReparo(c: { fechadaEm: string | null }): boolean {
  return !c.fechadaEm;
}
