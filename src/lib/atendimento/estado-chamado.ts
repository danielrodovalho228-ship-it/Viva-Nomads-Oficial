/* Prompt 50 — o estado do chamado que quem abriu vê (aberto · respondido · resolvido). PURO (vai para o cliente). */
/** Estado do chamado que QUEM ABRIU vê: aberto · respondido · resolvido. */
export type EstadoChamado = "aberto" | "respondido" | "resolvido";
export function estadoDoChamado(c: { status: string; primeiraRespostaEm: string | null }): EstadoChamado {
  if (c.status === "resolvido" || c.status === "encerrado") return "resolvido";
  return c.primeiraRespostaEm ? "respondido" : "aberto";
}
export const ROTULO_ESTADO_CHAMADO: Record<EstadoChamado, string> = { aberto: "Aberto", respondido: "Respondido", resolvido: "Resolvido" };
