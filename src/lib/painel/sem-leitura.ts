/*
  Achado nº 24 (erros/estados vazios) — o Início do painel lê propostas, estadias, candidaturas, conversas e buscas
  salvas em paralelo. A falha de uma leitura virava lista vazia: "Hoje você tem 0 decisões" e contadores em 0, sem
  aviso. Aqui (PURO): o aviso do topo com o que não foi lido, e o número do contador ("—" quando não leu).
  Roda: node --test src/lib/painel/sem-leitura.test.ts
*/

export type FonteDoInicio = "propostas" | "estadias" | "candidaturas" | "conversas" | "buscas";

const ROTULO: Record<FonteDoInicio, string> = {
  propostas: "propostas",
  estadias: "estadias",
  candidaturas: "candidaturas",
  conversas: "mensagens",
  buscas: "buscas salvas",
};

/** "Não foi possível ler agora: propostas e estadias. As decisões e os números abaixo podem estar incompletos." */
export function avisoInicioSemLeitura(fontes: readonly FonteDoInicio[]): string | null {
  const nomes = [...new Set(fontes)].map((f) => ROTULO[f]);
  if (!nomes.length) return null;
  const lista = nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
  return `Não foi possível ler agora: ${lista}. As decisões e os números abaixo podem estar incompletos — recarregue a página em instantes.`;
}

/** O valor do contador: sem leitura (null), "—"; nunca "0" no lugar de "não sei". */
export function valorContador(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? String(n) : "—";
}
