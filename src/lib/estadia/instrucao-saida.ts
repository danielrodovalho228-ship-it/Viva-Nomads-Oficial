/*
  E662 (parte Pista B) — a instrução ÚNICA de saída (check-out). PURO, node --test src/lib/estadia/instrucao-saida.test.ts
  O dono escreve uma vez (no imóvel, tabela privada de instruções); o contrato guarda a cópia da 1ª assinatura; o morador e o dono
  leem o MESMO texto: contrato primeiro, imóvel como reserva (contrato antigo, anterior à coluna, ou sem cópia).
*/
export const INSTRUCAO_SAIDA_MAX = 1500;

export function normalizarInstrucaoSaida(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, INSTRUCAO_SAIDA_MAX);
  return t || null;
}

export function instrucaoDeSaida(p: { doContrato: unknown; doImovel: unknown }): string | null {
  return normalizarInstrucaoSaida(p.doContrato) ?? normalizarInstrucaoSaida(p.doImovel);
}
