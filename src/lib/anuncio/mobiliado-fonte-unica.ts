/*
  E603 — "Mobiliado" tem uma fonte só: o interruptor "Mobiliado e equipado" do Passo 6 (furnished). A comodidade "Mobiliado
  completo" do Passo 5 não é um segundo dado: espelha esse valor. Antes, a prévia e a listagem mostravam o chip "Mobiliado"
  (furnished, padrão ligado) enquanto o Passo 5 aparecia sem nenhuma comodidade marcada.
*/
export function comodidadesComMobiliado(chaves: Record<string, boolean>, furnished: boolean): Record<string, boolean> {
  return { ...chaves, mobiliado: furnished };
}
