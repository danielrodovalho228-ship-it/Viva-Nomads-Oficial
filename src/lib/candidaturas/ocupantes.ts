/*
  Quantas pessoas vão morar (prompt 8). PURO: a candidatura informa, o servidor confere com a capacidade do imóvel,
  o proprietário vê no cartão do candidato e o Fechamento abre com o número.
*/
export const OCUPANTES_MAX = 20;

export type ResultadoOcupantes = { ok: true; valor: number | null } | { ok: false; erro: string };

/** Vazio = não informado (ok, null). Fora de 1..20 ou acima da capacidade do imóvel = erro claro. */
export function validarOcupantes(v: unknown, capacidade: number | null | undefined): ResultadoOcupantes {
  if (v === undefined || v === null || v === "") return { ok: true, valor: null };
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > OCUPANTES_MAX) return { ok: false, erro: "Informe de 1 a 20 pessoas." };
  if (capacidade != null && capacidade > 0 && n > capacidade)
    return { ok: false, erro: `Este imóvel recebe até ${capacidade} ${capacidade === 1 ? "pessoa" : "pessoas"}.` };
  return { ok: true, valor: n };
}

/** "1 pessoa" / "3 pessoas" — o sinal no cartão do candidato. */
export function rotuloOcupantes(n: number): string {
  return n === 1 ? "1 pessoa" : `${n} pessoas`;
}

/** Ocupantes que o Fechamento abre preenchido: o da candidatura, preso à capacidade; sem ele, 1. */
export function ocupantesIniciais(daCandidatura: number | null | undefined, capacidade: number | null | undefined): number {
  const n = Number(daCandidatura);
  if (!Number.isInteger(n) || n < 1) return 1;
  return capacidade && capacidade > 0 ? Math.min(n, capacidade) : Math.min(n, OCUPANTES_MAX);
}
