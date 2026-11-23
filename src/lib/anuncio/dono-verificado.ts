import type { Property } from "../types.ts";
import { isExemplo } from "../demo-listing.ts";
import type { EstadoIdentidade } from "../identidade/estado.ts";

/**
 * Selo "Dono verificado" (ordem 36703038). Critério ÚNICO e REAL: `profiles.is_verified`,
 * campo protegido (só o servidor/admin grava; o usuário não consegue se auto-verificar —
 * trigger profiles_bloqueia_confianca). Nada de selo por padrão: só `true` explícito.
 * Anúncio de exemplo nunca ostenta o selo. Não é o selo do imóvel ("Documentação conferida").
 */
export function donoVerificado(property: Pick<Property, "id" | "owner"> | null | undefined): boolean {
  if (!property || isExemplo(property)) return false;
  return property.owner?.verified === true;
}

/** Texto do "o que significa" (toque no selo). Não promete nada sobre o imóvel. */
export const EXPLICACAO_DONO_VERIFICADO =
  "A equipe do Viva Nomads conferiu a identidade deste proprietário. Isso não garante o imóvel: a documentação dele tem selo próprio.";

/**
 * E1105 (ORDEM-DUET-477): o texto do selo de identidade do dono — o da PRÓPRIA fonte (estadoIdentidade, E748), só no
 * estado `confirmada`. `em_breve` é o estado por omissão de toda a conta real sem laudo (nenhuma conferência feita),
 * `vencida` e `indisponivel` também não dão selo. Nenhum estado da fonte é redefinido aqui.
 */
export function identidadeConfirmadaDoDono(e: EstadoIdentidade | null | undefined): string | null {
  return e?.estado === "confirmada" ? e.texto : null;
}

export type SeloDoDono = { tipo: "identidade"; texto: string } | { tipo: "manual" } | null;

/**
 * E1105 (ORDEM-DUET-477): UM selo só no bloco do dono da página do imóvel, nunca os dois.
 * Identidade confirmada (fonte única) → o selo de identidade, e o "Dono verificado" não aparece; sem ela e com
 * `profiles.is_verified` → o "Dono verificado" exactamente como hoje; nenhum dos dois → nada. Exemplo: nunca.
 */
export function seloDoDono(property: Pick<Property, "id" | "owner"> | null | undefined, textoIdentidadeConfirmada: string | null | undefined): SeloDoDono {
  if (!property || isExemplo(property)) return null;
  if (textoIdentidadeConfirmada) return { tipo: "identidade", texto: textoIdentidadeConfirmada };
  return donoVerificado(property) ? { tipo: "manual" } : null;
}
