/*
  E176 (D1) — "Ganhos" do dono (subaba de Contratos). PURO: a partir das linhas da carteira, só os contratos em vigência
  (ocupado) e a começar (reservado), com a soma de cada grupo. Vago não entra. Roda: node --test src/lib/ganhos-dono.test.ts
*/
import { diasEntre, situacaoDoContrato, type ContratoCarteiraEntrada, type ItemCarteira } from "./carteira-dono.ts";
import { periodoDosBlocos } from "./contrato-blocos.ts";

export interface Ganhos {
  vigencia: number;
  aComecar: number;
  linhas: ItemCarteira[];
}

export function ganhosDoDono(itens: readonly ItemCarteira[]): Ganhos {
  const linhas = itens
    .filter((i) => (i.situacao === "ocupado" || i.situacao === "reservado") && i.valorMensal > 0)
    .sort((a, b) => (a.situacao === b.situacao ? (a.inicio ?? "").localeCompare(b.inicio ?? "") : a.situacao === "ocupado" ? -1 : 1));
  const soma = (s: ItemCarteira["situacao"]) => linhas.filter((l) => l.situacao === s).reduce((t, l) => t + l.valorMensal, 0);
  return { vigencia: soma("ocupado"), aComecar: soma("reservado"), linhas };
}

/**
 * E545 — as linhas de Ganhos saem dos CONTRATOS (um por linha), não da carteira de anúncios. A carteira mede a ocupação
 * dos anúncios ATIVOS e mostra um contrato por imóvel; o dinheiro contratado não depende de o anúncio estar publicado:
 * o dono costuma pausar o anúncio depois de alugar, e um imóvel em vigência pode ter o próximo morador já contratado.
 * Antes, esses contratos ficavam de fora e "Contratado a começar" dava R$ 0 com vários "Aguardando 1º pagamento".
 */
export function itensDeGanhos(
  imoveis: readonly { id: string; titulo: string; bairro: string }[],
  contratos: readonly ContratoCarteiraEntrada[],
  hojeISO: string,
): ItemCarteira[] {
  const porId = new Map(imoveis.map((i) => [i.id, i]));
  return contratos
    .map((c) => ({ c, s: situacaoDoContrato(c) }))
    .filter((x) => x.s !== "vago")
    .map(({ c, s }) => {
      const im = porId.get(c.propertyId);
      const { inicio, fim } = periodoDosBlocos(c.blocos);
      return {
        propertyId: c.propertyId,
        titulo: im?.titulo ?? "Imóvel",
        bairro: im?.bairro ?? "",
        situacao: s,
        valorMensal: c.valorMensal,
        inicio,
        fim,
        diasAteFim: fim ? diasEntre(hojeISO, fim) : null,
        morador: c.morador,
        contratoId: c.id,
        contratoNumero: c.id.slice(0, 8),
        selo: c.selo ?? null,
        proximos: [],
      };
    });
}
