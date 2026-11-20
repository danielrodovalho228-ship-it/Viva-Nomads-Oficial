/*
  E695 — a mensagem da busca sem resultado. Módulo puro (node --test).
  "A Viva ainda não chegou em X" é afirmação sobre o LUGAR e só vale quando o lugar tem ZERO imóveis. Se há imóveis que a
  data ou os filtros excluíram, a mensagem fala de data/filtro e, quando conhecida, da próxima disponibilidade.
*/
export type ImovelDoLocal = { availableFrom?: string | null };

export type SituacaoBuscaVazia =
  | { tipo: "cidade_sem_imoveis" }
  | { tipo: "sem_disponibilidade"; quantos: number; proxima: string | null; titulo: string; detalhe: string };

const dia = (iso: string) => /^(\d{4}-\d{2}-\d{2})/.exec(iso)?.[1] ?? null;
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/** A menor data de disponibilidade que ainda não passou (hoje conta); null se nenhuma é conhecida. */
export function proximaDisponibilidade(imoveis: readonly ImovelDoLocal[], hoje: string): string | null {
  let melhor: string | null = null;
  for (const im of imoveis) {
    const d = im.availableFrom ? dia(im.availableFrom) : null;
    if (!d || d < hoje) continue;
    if (!melhor || d < melhor) melhor = d;
  }
  return melhor;
}

/** `imoveisNoLocal`: o que a lista mostraria SEM a data e os filtros da folha (só o lugar digitado). */
export function situacaoBuscaVazia(e: { local: string; imoveisNoLocal: readonly ImovelDoLocal[]; hoje: string }): SituacaoBuscaVazia {
  const n = e.imoveisNoLocal.length;
  if (n === 0) return { tipo: "cidade_sem_imoveis" };
  const local = e.local.trim();
  const proxima = proximaDisponibilidade(e.imoveisNoLocal, e.hoje);
  const quantos = `${n} ${n === 1 ? "imóvel" : "imóveis"}`;
  return {
    tipo: "sem_disponibilidade",
    quantos: n,
    proxima,
    titulo: `Há ${quantos}${local ? ` em ${local}` : ""}, mas nenhum para essa data e esses filtros.`,
    detalhe: proxima
      ? `O mais próximo fica disponível a partir de ${dataBr(proxima)}. Mude a data de entrada ou tire algum filtro para ver.`
      : "Mude a data de entrada ou tire algum filtro para ver.",
  };
}
