/**
 * Ficha do pet vista pelo DONO, só no contexto da candidatura (complemento do #876, reteste do Muse). Puro:
 * quando o dono pode ver, o resumo do cartão e a conferência com as regras do anúncio. O acesso aos dados
 * (fotos e carteira em links assinados de 10 minutos) fica na função de servidor fichaPetsDaCandidatura.
 */
import { compatibilidadePets, ROTULO_ESPECIE, type EspeciePet, type PortePet, type RegrasPets } from "./pets-regras.ts";

/** Links assinados das fotos e da carteira: 10 minutos. */
export const PRAZO_LINK_FICHA_PET_S = 600;

/** Corte das observações no cartão do inquilino ("ver mais" mostra o resto). */
export const CORTE_OBSERVACOES_PET = 120;

/** Porte em uma palavra, para o resumo e a conferência ("porte médio"). */
export const PORTE_CURTO: Record<PortePet, string> = { P: "pequeno", M: "médio", G: "grande" };

/** Com 3 de 3 fotos, no lugar do botão de envio. */
export const TEXTO_MAX_FOTOS_PET = "Máximo de 3 fotos. Remova uma para trocar.";

export interface PetResumo {
  nome: string;
  especie: EspeciePet;
  porte: PortePet;
}

/**
 * O dono vê a ficha enquanto a candidatura está viva: pendente ("new"), aceita ("accepted") ou com contrato em
 * andamento. Recusada, cancelada ou com o contrato encerrado/cancelado: não vê mais.
 */
export function donoVeFichaPet(c: { leadStatus: string | null | undefined; contratoStatus?: string | null }): boolean {
  if (c.leadStatus !== "new" && c.leadStatus !== "accepted") return false;
  if (c.contratoStatus != null && c.contratoStatus !== "ativo") return false;
  return true;
}

const umPet = (p: PetResumo) => `${p.nome} (${ROTULO_ESPECIE[p.especie]}, porte ${PORTE_CURTO[p.porte]})`;

/** "Com 1 pet · Totó (cão, porte médio)"; vários: "Com 2 pets · Totó (cão, porte médio), Mia (gato, porte pequeno)". */
export function resumoPetsCandidatura(pets: PetResumo[]): string | null {
  if (pets.length === 0) return null;
  return `${pets.length === 1 ? "Com 1 pet" : `Com ${pets.length} pets`} · ${pets.map(umPet).join(", ")}`;
}

/**
 * Conferência de UM pet com as regras do anúncio, na frase que o dono lê:
 * "Dentro das regras: aceita cão de porte médio" ou "Fora das regras: o anúncio aceita até porte pequeno".
 * A regra é a mesma de compatibilidadePets (pets-regras.ts); a quantidade é conferida em conferenciaQuantidade.
 */
export function conferenciaPetComRegras(petsAllowed: boolean | null | undefined, regras: RegrasPets | null, pet: PetResumo): { ok: boolean; texto: string } {
  const especie = ROTULO_ESPECIE[pet.especie];
  if (petsAllowed === false) return { ok: false, texto: "Fora das regras: o anúncio não aceita animais" };
  if (!regras) return { ok: true, texto: "Dentro das regras: o anúncio aceita pets" };
  const r = compatibilidadePets(true, { ...regras, qtdMax: 3 }, [pet]);
  if (r.ok) return { ok: true, texto: `Dentro das regras: aceita ${especie} de porte ${PORTE_CURTO[pet.porte]}` };
  if (!regras.especies.includes(pet.especie)) return { ok: false, texto: `Fora das regras: o anúncio não aceita ${especie}` };
  return { ok: false, texto: `Fora das regras: o anúncio aceita até porte ${PORTE_CURTO[regras.porteMax]}` };
}

/** Mais pets do que o anúncio aceita: "Fora das regras: o anúncio aceita até 1 animal". Dentro: null. */
export function conferenciaQuantidade(petsAllowed: boolean | null | undefined, regras: RegrasPets | null, qtd: number): string | null {
  if (petsAllowed === false || !regras || qtd <= regras.qtdMax) return null;
  return `Fora das regras: o anúncio aceita até ${regras.qtdMax} ${regras.qtdMax === 1 ? "animal" : "animais"}`;
}

/** Observações no cartão: até ~120 caracteres, cortando na última palavra inteira. */
export function cortarObservacoes(texto: string, limite = CORTE_OBSERVACOES_PET): { curto: string; cortado: boolean } {
  const t = texto.trim();
  if (t.length <= limite) return { curto: t, cortado: false };
  const corte = t.slice(0, limite);
  const espaco = corte.lastIndexOf(" ");
  return { curto: `${(espaco > limite * 0.6 ? corte.slice(0, espaco) : corte).trimEnd()}…`, cortado: true };
}
