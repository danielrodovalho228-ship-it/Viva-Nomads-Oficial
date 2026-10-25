/** Regra da varredura de acessibilidade do laboratório (ordem 21708cca, parte D): zero violações sérias ou críticas. */

export type ViolacaoAxe = {
  id: string;
  impact?: "minor" | "moderate" | "serious" | "critical" | null;
  help: string;
  nodes: { target: unknown[] }[];
};

export const ROTAS_AXE_PUBLICAS = [
  "/",
  "/buscar",
  "/cidades/uberlandia",
  "/como-funciona",
  "/precos",
  "/para-proprietarios",
  "/empresas",
  "/parceiros",
  "/ajuda",
  "/seguranca",
  "/auth",
];

export function bloqueantes<T extends Pick<ViolacaoAxe, "impact">>(violacoes: T[]): T[] {
  return violacoes.filter((v) => v.impact === "critical" || v.impact === "serious");
}

/** Texto curto para a mensagem do teste: regra, impacto e seletores (nunca o HTML da página). */
export function descreverViolacoes(violacoes: ViolacaoAxe[]): string {
  return bloqueantes(violacoes)
    .map((v) => {
      const alvos = v.nodes.slice(0, 3).map((n) => n.target.map(String).join(" ")).join(" | ");
      return `${v.id} (${v.impact}) em ${v.nodes.length} lugar(es): ${v.help} — ${alvos}`;
    })
    .join("\n");
}
