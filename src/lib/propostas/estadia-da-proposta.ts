/*
  E600: a estadia de uma proposta como a tela mostra — em DIAS (o desenho do E562), com a data de saída. Uma só conta
  para a página da proposta: dias pelos termos (diasDosTermos), saída = entrada + dias (a mesma do formulário e da
  candidatura: diasDaSelecao = saída − entrada), e o rótulo "43 dias (1 mês + 13 dias)".
  Roda: node --test src/lib/propostas/e600-proposta-recebida.test.ts
*/
import { diasDosTermos, type TermosProposta } from "./regras.ts";
import { periodoPorExtenso } from "../precos.ts";

export interface EstadiaDaProposta {
  dias: number;
  /** "43 dias (1 mês + 13 dias)" */
  rotulo: string;
  /** AAAA-MM-DD — o dia da saída (entrada + dias); vazio sem data de entrada válida. */
  saida: string;
}

export function estadiaDaProposta(t: Pick<TermosProposta, "dataEntrada" | "meses" | "dias">): EstadiaDaProposta {
  const dias = diasDosTermos(t);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(t.dataEntrada ?? ""));
  const saida = m && dias > 0 ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + dias)).toISOString().slice(0, 10) : "";
  return { dias, rotulo: `${dias} ${dias === 1 ? "dia" : "dias"} (${periodoPorExtenso(dias)})`, saida };
}
