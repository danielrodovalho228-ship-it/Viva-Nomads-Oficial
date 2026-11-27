/*
  Achado nº 24 (erros/estados vazios) — o Início do painel lê propostas, estadias, candidaturas, conversas e buscas
  salvas em paralelo. A falha de uma leitura virava lista vazia: "Hoje você tem 0 decisões" e contadores em 0, sem
  aviso. Aqui (PURO): o aviso do topo com o que não foi lido, e o número do contador ("—" quando não leu).
  Roda: node --test src/lib/painel/sem-leitura.test.ts
*/

export type FonteDoInicio = "propostas" | "estadias" | "candidaturas" | "conversas" | "buscas" | "conta" | "imoveis" | "interessados" | "decisoes";

const ROTULO: Record<FonteDoInicio, string> = {
  propostas: "propostas",
  estadias: "estadias",
  candidaturas: "candidaturas",
  conversas: "mensagens",
  buscas: "buscas salvas",
  // Achado 132: a conta pausada não lida nunca vira "conta ativa" sem aviso.
  conta: "o estado da sua conta (pausada ou ativa)",
  imoveis: "seus anúncios",
  interessados: "os interessados",
  decisoes: "contratos, visitas, solicitações e pendências",
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

/*
  E1093 — o Início relê-se sozinho UMA vez quando alguma leitura falhou. Na montagem da página, todas as leituras de uma
  carga partilham a mesma confirmação de sessão: se ela falha, falham todas, e só uma carga nova confirma de novo. Em vez
  de deixar a pessoa a olhar para o aviso até recarregar, a página pede a si mesma uma carga nova, uma vez, e não outra
  nos 10 s seguintes (se a falha continuar, fica o aviso; nunca um laço de recargas).
*/
export const ESPERA_RELEITURA_INICIO_MS = 1_500;
export const INTERVALO_RELEITURA_INICIO_MS = 10_000;
export const CHAVE_RELEITURA_INICIO = "vn-inicio-releitura";

/** Pode pedir a releitura agora? `ultima` = quando esta aba a pediu pela última vez (ms), ou null. */
export function deveRelerOInicio(ultima: number | null, agora: number): boolean {
  if (ultima === null || !Number.isFinite(ultima)) return true;
  // Relógio para trás (valor guardado no futuro): não confia nele.
  if (ultima > agora) return true;
  return agora - ultima >= INTERVALO_RELEITURA_INICIO_MS;
}
