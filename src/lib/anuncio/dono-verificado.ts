import type { Property } from "../types.ts";
import { isExemplo } from "../demo-listing.ts";
import type { EstadoIdentidade } from "../identidade/estado.ts";

/*
  E1106 (ORDEM-DUET-478): o antigo selo "Dono verificado" lia profiles.is_verified directamente; agora a conferência
  manual da equipa é o estado `conferida_equipe` da fonte única da identidade (estadoIdentidade), e o selo do dono sai
  só da fonte. O registo is_verified continua a existir — é insumo da fonte, nunca lido por uma tela.
*/
/**
 * E1106 (ORDEM-DUET-478): o texto do selo de identidade do dono — o da PRÓPRIA fonte (estadoIdentidade, E748), nos
 * estados que dizem uma identidade conferida: `confirmada` (laudo válido) e `conferida_equipe` (a conferência manual da
 * equipa, que a fonte lê do registo). `em_breve` (o estado por omissão da conta real sem laudo), `vencida`,
 * `simulavel` e `indisponivel` não dão selo.
 */
export function textoDoSeloDeIdentidade(e: EstadoIdentidade | null | undefined): string | null {
  return e?.estado === "confirmada" || e?.estado === "conferida_equipe" ? e.texto : null;
}

export type SeloDoDono = { tipo: "identidade"; texto: string } | null;

/**
 * E1106 (ORDEM-DUET-478): UM selo só no bloco do dono da página do imóvel, de UMA fonte só — o que a fonte da identidade
 * diz. A precedência interina do E1105 (o "Dono verificado" lido de is_verified) sai: a conferência da equipa chega
 * pela fonte, com o texto dela. Exemplo: nunca.
 */
export function seloDoDono(property: Pick<Property, "id"> | null | undefined, textoDaFonte: string | null | undefined): SeloDoDono {
  if (!property || isExemplo(property)) return null;
  return textoDaFonte ? { tipo: "identidade", texto: textoDaFonte } : null;
}
