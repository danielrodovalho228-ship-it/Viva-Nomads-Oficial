/*
  E899 (Daniel, 13/11): o cartão de imóvel enxuto. O PropertyCard desenha SÓ a partir deste modelo. A composição do valor
  (a do mês e a da estadia) saiu do cartão e mora na página do imóvel. Lei E777: os números do cartão vêm da mesma fonte
  única da página. O "/mês" é calcularTudoIncluido(p).total; o total da estadia é estadiaDoImovel(p, N).total (via
  estadiaNoCartao). A apresentação muda; a fonte não. PURO (node --test).
*/
import type { Property } from "./types.ts";
import { avisoDoCartao, calcularTudoIncluido } from "./precos.ts";
import { resumoEmMeses, rotuloPreco } from "./cartao-preco.ts";
import { estadiaNoCartao } from "./cartao-estadia.ts";
import { itensSintese, type ChaveSintese } from "./cartao-sintese.ts";

export interface ModeloDoCartao {
  /** "R$ 3.960" — o total do mês, em destaque, seguido de "/mês". */
  precoMes: string;
  /** "R$ 4.660 em 1 mês": o total da estadia de N meses, pela regra única (com as limpezas de preparação e de saída). */
  totalEstadia: { texto: string; total: number; meses: number };
  /** "tudo incluído" (contas fixas) ou "água, luz e gás à parte" (contas medidas): nunca os dois, nunca nenhum. */
  aviso: string;
  /** quartos · banheiros · m² · mobiliado (· mínimo, quando maior que o da promessa). O nível é selo da foto (E416). */
  sintese: { chave: ChaveSintese; texto: string }[];
  /** "Disponível a partir de dd/mm/aaaa", "Disponível agora" ou null. */
  disponivel: string | null;
}

type CamposDoCartao = Parameters<typeof estadiaNoCartao>[0] &
  Pick<Property, "utilitiesMode"> &
  Partial<Pick<Property, "availableFrom" | "bedrooms" | "bathrooms" | "areaM2" | "furnished" | "nivel" | "nivelVistoriado" | "minPeriodDays">>;

/** O cartão de um anúncio com N meses (N = a duração da busca ou a estadia mínima: mesesDoCartao). */
export function modeloDoCartao(p: CamposDoCartao, meses: number, hoje?: Date): ModeloDoCartao {
  const n = Math.max(1, Math.floor(meses));
  const preco = rotuloPreco({ mensal: calcularTudoIncluido(p).total, meses: n, disponivelEm: p.availableFrom ?? null, hoje });
  const estadia = estadiaNoCartao(p, n);
  return {
    precoMes: preco.valor,
    // Sem total possível (anúncio sem valor), o resumo do mês × N, como antes (E356: toda grade tem a linha).
    totalEstadia: estadia ? { texto: estadia.texto, total: estadia.total, meses: estadia.meses } : { texto: resumoEmMeses(preco.total, preco.meses), total: preco.total, meses: preco.meses },
    aviso: avisoDoCartao(p),
    sintese: itensSintese(p).filter((i) => i.chave !== "nivel"),
    disponivel: preco.disponivel,
  };
}
