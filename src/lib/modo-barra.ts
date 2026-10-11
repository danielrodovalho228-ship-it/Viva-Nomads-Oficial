/**
 * Textos e cores do chip de modo (Proprietário ⇄ Inquilino). Puro: usado nos
 * cabeçalhos do painel e nos testes. Proprietário = verde; inquilino = azul.
 */
export type ModoBarra = "owner" | "tenant";

const ROTULO: Record<ModoBarra, string> = { owner: "Proprietário", tenant: "Inquilino" };

export const outroModo = (m: ModoBarra): ModoBarra => (m === "owner" ? "tenant" : "owner");

/** Rótulo curto do chip do cabeçalho. */
export const rotuloDoChip = (m: ModoBarra): string => ROTULO[m];

/** Feedback depois de trocar (leitor de tela e aviso visual). */
export const avisoDeTroca = (m: ModoBarra): string => `Agora você está como ${ROTULO[m]}`;

/** Rótulo do botão: para qual lado ele leva. */
export const rotuloDoBotaoTrocar = (m: ModoBarra): string => `Trocar para ${ROTULO[outroModo(m)]}`;

/** Classes de cor do chip (fundo + texto) por modo. */
export const CORES_CHIP: Record<ModoBarra, string> = {
  owner: "bg-emerald-50 text-emerald-900 border-emerald-200",
  tenant: "bg-blue-50 text-blue-900 border-blue-200",
};
