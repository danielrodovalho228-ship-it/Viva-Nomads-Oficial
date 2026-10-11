/**
 * Textos e cores da barra de modo (Proprietário ⇄ Inquilino). Puro: usado na
 * casca do painel e nos testes. Proprietário = verde; inquilino = azul.
 */
export type ModoBarra = "owner" | "tenant";

const ROTULO: Record<ModoBarra, string> = { owner: "Proprietário", tenant: "Inquilino" };

export const outroModo = (m: ModoBarra): ModoBarra => (m === "owner" ? "tenant" : "owner");

/** Texto fixo da barra. */
export const textoDaBarra = (m: ModoBarra): string => `Você está como ${ROTULO[m]}`;

/** Feedback depois de trocar (leitor de tela e aviso visual). */
export const avisoDeTroca = (m: ModoBarra): string => `Agora você está como ${ROTULO[m]}`;

/** Rótulo do botão: para qual lado ele leva. */
export const rotuloDoBotaoTrocar = (m: ModoBarra): string => `Trocar para ${ROTULO[outroModo(m)]}`;

/** Classes de cor da barra (fundo + texto) por modo. */
export const CORES_BARRA: Record<ModoBarra, string> = {
  owner: "bg-emerald-50 text-emerald-900 border-emerald-200",
  tenant: "bg-blue-50 text-blue-900 border-blue-200",
};
