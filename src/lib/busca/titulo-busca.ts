/**
 * Título (h1) da /buscar no padrão Furnished Finder (ordem 6a98c68e): reflete a
 * busca — local digitado + quantos imóveis sobram com os filtros — e muda em
 * tempo real. Sem local, um título genérico com a contagem.
 */
export type TituloBuscaEntrada = {
  /** Quantos imóveis passam na busca agora. */
  n: number;
  /** Cidade/bairro/endereço digitado ("" = sem local). */
  local?: string;
  /** Filtros que mudam o "tipo" do que se mostra. */
  pronto?: boolean;
  pet?: boolean;
};

export function tituloDaBusca({ n, local, pronto, pet }: TituloBuscaEntrada): string {
  const um = n === 1;
  const qtd = n === 0 ? "Nenhum" : String(n);
  const nome = pronto
    ? `${um || n === 0 ? "imóvel" : "imóveis"} Pronto para Morar`
    : `${um || n === 0 ? "imóvel mobiliado" : "imóveis mobiliados"}`;
  const lugar = local?.trim().replace(/\s+/g, " ").slice(0, 80);
  const onde = lugar ? ` em ${lugar}` : " para locação mensal";
  const extra = pet ? (um ? " que aceita pets" : " que aceitam pets") : "";
  return `${qtd} ${nome}${onde}${extra}`;
}
