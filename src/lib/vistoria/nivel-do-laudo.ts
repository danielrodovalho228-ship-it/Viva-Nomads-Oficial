/*
  E1083, parte 2 (ORDEM-DUET-397/399): o NÍVEL do laudo é o que o AVALIADOR escolhe no laudo que assina (Essencial,
  Conforto ou Premium), pelos critérios públicos e com base nas fotos da visita. A plataforma NÃO calcula o nível do
  laudo: o valor gravado em vistoria_laudos.nivel_sustentado é o escolhido no formulário assinado e é o que o dono vê.
  PURO (node --test).
*/
import { NIVEIS, type Nivel } from "../../config/niveis.ts";

export const ROTULO_NIVEL_LAUDO: Record<Nivel, string> = { essencial: "Essencial", conforto: "Conforto", premium: "Premium" };
export const ROTULO_CAMPO_NIVEL = "Nível do imóvel";
export const MSG_ESCOLHA_O_NIVEL = "Escolha o nível do imóvel (Essencial, Conforto ou Premium).";

/** O nível vindo do formulário; qualquer outra coisa (vazio, "em_adequacao", lixo) é null. */
export function lerNivelDoLaudo(v: unknown): Nivel | null {
  const s = String(v ?? "").trim();
  return (NIVEIS as readonly string[]).includes(s) ? (s as Nivel) : null;
}

/**
 * E1092: a linha do nível como o PDF a escreve ("Nível sustentado: Conforto"), pelo valor GRAVADO no laudo. "em_adequacao"
 * (laudo sem nível sustentado) lê "em adequação", como na vista do dono. Sem valor gravado, null: a linha não aparece.
 */
export function linhaNivelSustentado(gravado: string | null | undefined): string | null {
  const s = String(gravado ?? "").trim();
  if (s === "em_adequacao") return "Nível sustentado: em adequação";
  const nivel = lerNivelDoLaudo(s);
  return nivel ? `Nível sustentado: ${ROTULO_NIVEL_LAUDO[nivel]}` : null;
}
