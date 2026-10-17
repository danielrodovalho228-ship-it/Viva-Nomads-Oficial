import type { Property } from "../types.ts";
import { isExemplo } from "../demo-listing.ts";

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
