/**
 * Colunas da grade de cartões do /admin/financeiro por QUANTIDADE de cartões: a última linha nunca fica com buraco
 * (passada 40: 9 e 6 cartões em 4 colunas a 1280px deixavam 1 e 2 sozinhos). Múltiplo de 3 → 3 colunas; de 4 → 4 no xl.
 */
export function classeDaGrade(n: number): string {
  if (n % 3 === 0) return "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";
  if (n % 4 === 0) return "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4";
  return "grid grid-cols-1 gap-3 sm:grid-cols-2";
}
