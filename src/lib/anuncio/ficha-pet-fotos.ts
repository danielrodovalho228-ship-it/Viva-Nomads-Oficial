/**
 * Fotos do pet e carteira de vacina (ordem a9c8aaff, parte 2 da 022afabb, item 1).
 * Puro: o servidor valida com estas funções; a tela só repete para avisar cedo.
 */
export const MAX_FOTOS_PET = 3;
export const MAX_CARTEIRA_PET = 1;
export const BUCKET_FOTOS_PET = "pets-fotos";

export type TipoFotoPet = "foto" | "carteira";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_RE = new RegExp(`^${UUID}$`, "i");

export function podeAdicionarFotoPet(tipo: TipoFotoPet, quantas: number): boolean {
  return quantas < (tipo === "foto" ? MAX_FOTOS_PET : MAX_CARTEIRA_PET);
}

export function validarEnvioFotoPet(raw: unknown): { ok: true; petId: string; tipo: TipoFotoPet } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (typeof r.petId !== "string" || !UUID_RE.test(r.petId)) return { ok: false, error: "Pet inválido." };
  if (r.tipo !== "foto" && r.tipo !== "carteira") return { ok: false, error: "Tipo de imagem inválido." };
  return { ok: true, petId: r.petId, tipo: r.tipo };
}

/** Sempre na pasta da própria pessoa (a política do bucket confere a mesma regra) e sempre WebP. */
export function novoCaminhoFotoPet(uid: string, arquivoId: string): string {
  return `${uid}/${arquivoId}.webp`;
}

export function caminhoFotoPetValido(caminho: unknown, uid: string): boolean {
  if (typeof caminho !== "string" || !UUID_RE.test(uid)) return false;
  return new RegExp(`^${uid.toLowerCase()}/${UUID}\\.webp$`, "i").test(caminho);
}
