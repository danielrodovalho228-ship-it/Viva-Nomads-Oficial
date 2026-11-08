/*
  E679 — PR 3: "Responder à avaliação" (mockups avaliacoes-responder-desktop/-mobile). Textos e datas, puros. A regra de
  verdade (uma resposta por avaliação, sem edição, 500 caracteres) é do banco e de lib/avaliacoes-resposta.ts.
*/
import { dataLonga } from "./conta/painel-avaliacoes.ts";

export const hrefResponder = (avaliacaoId: string) => `/dashboard/avaliacoes/responder/${avaliacaoId}`;

export const TEXTO_UMA_RESPOSTA = "Você tem direito a UMA resposta pública. Depois de publicar, não dá para editar nem apagar — revise antes de enviar.";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "novembro de 2026" (fuso de Brasília). */
export function mesEAno(iso: string | null | undefined): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "";
  const d = new Date(t - 3 * 3_600_000);
  return `${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** "Avaliação da sua estadia em Santa Mônica, publicada em 12 de novembro" — só o que existe. */
export function linhaContextoResposta(a: { imovelTitulo: string | null; cidade: string | null; publicadaEm: string | null }): string {
  const onde = a.imovelTitulo ? ` em ${a.imovelTitulo}` : "";
  const quando = dataLonga(a.publicadaEm);
  return `Avaliação da sua estadia${onde}${quando ? `, publicada em ${quando}` : ""}`;
}
