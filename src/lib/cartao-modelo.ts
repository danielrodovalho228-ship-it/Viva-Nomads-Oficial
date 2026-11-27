/*
  E899 (Daniel, 13/11, uso real): o cartão de imóvel mostra só o essencial; o detalhe fica na página. PURO.
  modeloDoCartao é a ÚNICA origem do que o PropertyCard escreve de preço, total, aviso, especificações e disponibilidade:
    • precoMes     — "R$ X": o total do mês de hoje (calcularTudoIncluido(p).total), o mesmo da página e do pino do mapa;
    • totalEstadia — "R$ Y em N meses": a regra única do E756/E777 (estadiaNoCartao → estadiaDoImovel), também com 1 mês;
    • aviso        — um texto por situação das contas (E923, situacaoDasContas): AVISO_TUDO_INCLUIDO só com as contas no total,
                     AVISO_CONTAS_A_PARTE com o consumo medido, AVISO_CONTAS_NAO_INFORMADAS com contas fixas sem estimativa;
    • sintese      — quartos · banheiros · m² · mobiliado (itensSintese; o nível é selo da foto desde o E416);
    • disponivel   — "Disponível a partir de …" ou "Disponível agora" (rotuloPreco).
  A apresentação mudou; a fonte não (lei do E777). A composição do mês e a conta da estadia ficam na página do imóvel.
*/
import { avisoCurtoDoTotal, calcularTudoIncluido } from "./precos.ts";
import { mesesDoCartao, resumoEmMeses, rotuloPreco } from "./cartao-preco.ts";
import { estadiaNoCartao } from "./cartao-estadia.ts";
import { itensSintese } from "./cartao-sintese.ts";

type CamposDoCartao = Parameters<typeof estadiaNoCartao>[0] &
  Parameters<typeof itensSintese>[0] & { availableFrom?: string | null; minPeriodDays?: number | null };

export interface ModeloDoCartao {
  /** "R$ 3.960" — o cartão escreve "/mês" ao lado. */
  precoMes: string;
  /** O total da estadia: o valor (reais), os meses (N) e o texto "R$ 4.660 em 1 mês". */
  totalEstadia: { valor: number; meses: number; texto: string };
  /** O aviso curto que fecha a linha do total (precos.ts). */
  aviso: string;
  sintese: ReturnType<typeof itensSintese>;
  disponivel: string | null;
}

/** `meses`: a duração da busca; sem ela, a estadia mínima do anúncio (mesesDoCartao). */
export function modeloDoCartao(p: CamposDoCartao, meses?: number, hoje?: Date): ModeloDoCartao {
  const preco = rotuloPreco({ mensal: calcularTudoIncluido(p).total, meses: mesesDoCartao(meses, p.minPeriodDays ?? undefined), disponivelEm: p.availableFrom, hoje });
  const estadia = estadiaNoCartao(p, preco.meses);
  return {
    precoMes: preco.valor,
    totalEstadia: estadia
      ? { valor: estadia.total, meses: estadia.meses, texto: estadia.texto }
      : { valor: preco.total, meses: preco.meses, texto: resumoEmMeses(preco.total, preco.meses) },
    aviso: avisoCurtoDoTotal(p),
    sintese: itensSintese(p).filter((i) => i.chave !== "nivel"),
    disponivel: preco.disponivel,
  };
}
