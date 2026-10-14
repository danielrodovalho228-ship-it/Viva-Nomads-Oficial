/**
 * Ficha do pet do morador (ordem 022afabb, item 1, parte 1: sem fotos).
 * Puro: o servidor valida com esta função; a tela só repete para avisar cedo.
 */
import { ESPECIES_PET, MAX_PETS, PORTES_PET, type EspeciePet, type PortePet } from "./pets-regras.ts";

export const MAX_OBSERVACOES_PET = 200;
export const MAX_NOME_PET = 40;
export const MAX_RACA_PET = 40;
export const MAX_IDADE_PET = 40;

export interface FichaPet {
  nome: string;
  especie: EspeciePet;
  porte: PortePet;
  /** Idade em anos completos (0 = filhote com menos de 1 ano). */
  idadeAnos: number;
  raca: string;
  castrado: boolean;
  vacinasEmDia: boolean;
  observacoes: string;
}

function limpar(v: unknown, max: number): string | null {
  if (v == null || v === "") return "";
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? null : t;
}

/** Aceita só o formato esperado; devolve a ficha limpa ou o motivo da recusa. */
export function validarFichaPet(raw: unknown): { ok: true; ficha: FichaPet } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Ficha inválida." };
  const r = raw as Record<string, unknown>;
  const nome = limpar(r.nome, MAX_NOME_PET);
  if (!nome) return { ok: false, error: "Informe o nome do pet (até 40 letras)." };
  const especie = ESPECIES_PET.find((e) => e === r.especie);
  if (!especie) return { ok: false, error: "Escolha a espécie: cão, gato ou outro." };
  const porte = PORTES_PET.find((p) => p === r.porte);
  if (!porte) return { ok: false, error: "Escolha o porte: P, M ou G." };
  const idade = Number(r.idadeAnos);
  if (!Number.isInteger(idade) || idade < 0 || idade > MAX_IDADE_PET) return { ok: false, error: "Idade em anos, de 0 a 40." };
  const raca = limpar(r.raca, MAX_RACA_PET);
  if (raca === null) return { ok: false, error: "Raça: até 40 letras." };
  const observacoes = limpar(r.observacoes, MAX_OBSERVACOES_PET);
  if (observacoes === null) return { ok: false, error: "Observações: até 200 letras." };
  if (typeof r.castrado !== "boolean" || typeof r.vacinasEmDia !== "boolean")
    return { ok: false, error: "Diga se o pet é castrado e se as vacinas estão em dia." };
  return { ok: true, ficha: { nome, especie, porte, idadeAnos: idade, raca, castrado: r.castrado, vacinasEmDia: r.vacinasEmDia, observacoes } };
}

/** Cabe mais um pet na conta? (limite de 3, igual ao do anúncio). */
export function podeAdicionarPet(qtdAtual: number): boolean {
  return Number.isInteger(qtdAtual) && qtdAtual >= 0 && qtdAtual < MAX_PETS;
}
