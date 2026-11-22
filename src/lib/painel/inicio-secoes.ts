/*
  E797 (opção b): o topo do Início. PURO. Roda: node --test src/lib/painel/e797-inicio-secoes.test.ts
*/

/** "Olá, Bruno!" — sem nome, "Olá!" (nunca o e-mail cru). */
export function textoDoTopo(primeiroNome: string | null | undefined): string {
  const n = (primeiroNome ?? "").trim();
  return n ? `Olá, ${n}!` : "Olá!";
}
