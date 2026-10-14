"use server";

import { createClient } from "@/lib/supabase/server";
import { podeAdicionarPet, validarFichaPet, type FichaPet } from "@/lib/anuncio/ficha-pet";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PetSalvo extends FichaPet {
  id: string;
}

type Linha = {
  id: string;
  nome: string;
  especie: FichaPet["especie"];
  porte: FichaPet["porte"];
  idade_anos: number;
  raca: string;
  castrado: boolean;
  vacinas_em_dia: boolean;
  observacoes: string;
};

const COLUNAS = "id, nome, especie, porte, idade_anos, raca, castrado, vacinas_em_dia, observacoes";

function paraPet(l: Linha): PetSalvo {
  return {
    id: l.id,
    nome: l.nome,
    especie: l.especie,
    porte: l.porte,
    idadeAnos: l.idade_anos,
    raca: l.raca,
    castrado: l.castrado,
    vacinasEmDia: l.vacinas_em_dia,
    observacoes: l.observacoes,
  };
}

/** Pets da própria pessoa (RLS: só as linhas dela). null = sem sessão ou sem banco. */
export async function meusPets(): Promise<PetSalvo[] | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("pets_inquilino").select(COLUNAS).eq("user_id", user.id).order("criado_em");
  return ((data ?? []) as Linha[]).map(paraPet);
}

export async function salvarPet(raw: unknown): Promise<{ ok: true; pets: PetSalvo[] } | { ok: false; error: string }> {
  const v = validarFichaPet(raw);
  if (!v.ok) return v;
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Sem conexão com o banco." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre na sua conta para cadastrar o pet." };
  const atuais = (await meusPets()) ?? [];
  if (!podeAdicionarPet(atuais.length)) return { ok: false, error: "Você já tem 3 pets cadastrados. Remova um para incluir outro." };
  const f = v.ficha;
  const { error } = await supabase.from("pets_inquilino").insert({
    user_id: user.id,
    nome: f.nome,
    especie: f.especie,
    porte: f.porte,
    idade_anos: f.idadeAnos,
    raca: f.raca,
    castrado: f.castrado,
    vacinas_em_dia: f.vacinasEmDia,
    observacoes: f.observacoes,
  });
  if (error) return { ok: false, error: "Não foi possível salvar o pet. Tente de novo." };
  return { ok: true, pets: (await meusPets()) ?? [] };
}

export async function removerPet(id: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof id !== "string" || !UUID_RE.test(id)) return { ok: false, error: "Pet inválido." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Sem conexão com o banco." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre na sua conta." };
  const { error } = await supabase.from("pets_inquilino").delete().eq("id", id).eq("user_id", user.id);
  return error ? { ok: false, error: "Não foi possível remover." } : { ok: true };
}
