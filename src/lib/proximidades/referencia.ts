/*
  E952 — "O que tem por perto" nunca mostra lugares de outro endereço. PURO (sem rede, sem banco).
  • referenciaDaBusca: o ponto de onde se medem os lugares e as âncoras. O ponto público do anúncio salvo (lat/lng, o
    mesmo da página — E259) só vale quando o endereço pedido é o MESMO para o qual ele foi calculado (CEP e, quando
    enviada, a rua). Endereço diferente → o ponto do endereço NOVO, inclusive para as âncoras. Sem ponto do endereço
    novo, null (nunca o ponto velho).
  • O "endereço salvo" é o que foi gravado JUNTO com o ponto (cep_proximidades + a rua do exact_address, na mesma
    gravação do lat/lng). O CEP do rascunho (draft_data) não serve: o autosave o grava antes de o ponto mudar.
*/
export interface PontoRef {
  lat: number;
  lng: number;
}
export interface EnderecoBusca {
  cep: string | null | undefined;
  rua?: string | null;
}

const digitos = (c: string | null | undefined) => (c ?? "").replace(/\D/g, "");

/** Rua comparável: sem acento, minúscula, só letras/dígitos separados por um espaço. */
export function normalizarRua(r: string | null | undefined): string {
  return (r ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Mesmo endereço para a busca: CEP igual (8 dígitos) e, quando o pedido traz a rua, a rua igual. Pedido com rua e
 * endereço salvo sem rua não se confirma (fica "diferente": vale o ponto do endereço novo).
 */
export function mesmoEnderecoDaBusca(salvo: EnderecoBusca, pedido: EnderecoBusca): boolean {
  const a = digitos(salvo.cep);
  if (a.length !== 8 || a !== digitos(pedido.cep)) return false;
  const ruaPedida = normalizarRua(pedido.rua);
  if (!ruaPedida) return true;
  return normalizarRua(salvo.rua) === ruaPedida;
}

/** A regra única do ponto de referência da busca (servidor). */
export function referenciaDaBusca(e: { salvo: EnderecoBusca | null; pedido: EnderecoBusca; pontoPublico: PontoRef | null; pontoEndereco: PontoRef | null }): PontoRef | null {
  if (e.salvo && e.pontoPublico && mesmoEnderecoDaBusca(e.salvo, e.pedido)) return e.pontoPublico;
  return e.pontoEndereco;
}
