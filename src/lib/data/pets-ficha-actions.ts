"use server";

import { createClient } from "@/lib/supabase/server";
import { podeAdicionarPet, validarFichaPet, type FichaPet } from "@/lib/anuncio/ficha-pet";
import {
  BUCKET_FOTOS_PET,
  caminhoFotoPetValido,
  novoCaminhoFotoPet,
  podeAdicionarFotoPet,
  validarEnvioFotoPet,
} from "@/lib/anuncio/ficha-pet-fotos";
import { PHOTO_MAX_BYTES, tipoRealFotoPorMagicBytes } from "@/lib/upload-limits";
import { reconverterFotoParaWebp } from "@/lib/foto-reconversao";
import { consumirLimite, DIA } from "@/lib/limites";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ImagemPet {
  caminho: string;
  /** Link assinado de 1 h (o bucket é privado). */
  url: string;
}

export interface PetSalvo extends FichaPet {
  id: string;
  fotos: ImagemPet[];
  carteira: ImagemPet | null;
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
  fotos: string[] | null;
  carteira_vacina: string | null;
};

const COLUNAS = "id, nome, especie, porte, idade_anos, raca, castrado, vacinas_em_dia, observacoes, fotos, carteira_vacina";

type Cliente = NonNullable<Awaited<ReturnType<typeof createClient>>>;

function paraPet(l: Linha, urls: Map<string, string>): PetSalvo {
  const imagem = (c: string): ImagemPet | null => (urls.has(c) ? { caminho: c, url: urls.get(c)! } : null);
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
    fotos: (l.fotos ?? []).map(imagem).filter((i): i is ImagemPet => !!i),
    carteira: l.carteira_vacina ? imagem(l.carteira_vacina) : null,
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
  const linhas = (data ?? []) as Linha[];
  const caminhos = linhas.flatMap((l) => [...(l.fotos ?? []), ...(l.carteira_vacina ? [l.carteira_vacina] : [])]).filter((c) => caminhoFotoPetValido(c, user.id));
  const urls = new Map<string, string>();
  if (caminhos.length > 0) {
    const { data: assinadas } = await supabase.storage.from(BUCKET_FOTOS_PET).createSignedUrls(caminhos, 3600);
    for (const a of assinadas ?? []) if (a.path && a.signedUrl) urls.set(a.path, a.signedUrl);
  }
  return linhas.map((l) => paraPet(l, urls));
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
  const { data: nova, error } = await supabase.from("pets_inquilino").insert({
    user_id: user.id,
    nome: f.nome,
    especie: f.especie,
    porte: f.porte,
    idade_anos: f.idadeAnos,
    raca: f.raca,
    castrado: f.castrado,
    vacinas_em_dia: f.vacinasEmDia,
    observacoes: f.observacoes,
  }).select(COLUNAS).single();
  if (error || !nova) return { ok: false, error: "Não foi possível salvar o pet. Tente de novo." };
  // O pet salvo entra na lista na hora (com as linhas de foto e carteira), sem depender de uma nova leitura.
  const salvo = paraPet(nova as Linha, new Map());
  return { ok: true, pets: [...atuais.filter((p) => p.id !== salvo.id), salvo] };
}

export async function removerPet(id: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof id !== "string" || !UUID_RE.test(id)) return { ok: false, error: "Pet inválido." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Sem conexão com o banco." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre na sua conta." };
  const dono = await donoDoPet(supabase, id);
  const { error } = await supabase.from("pets_inquilino").delete().eq("id", id).eq("user_id", user.id);
  if (!error && dono) {
    const arquivos = [...dono.fotos, ...(dono.carteira ? [dono.carteira] : [])].filter((c) => caminhoFotoPetValido(c, user.id));
    if (arquivos.length > 0) await supabase.storage.from(BUCKET_FOTOS_PET).remove(arquivos);
  }
  return error ? { ok: false, error: "Não foi possível remover." } : { ok: true };
}

async function donoDoPet(supabase: Cliente, petId: string): Promise<{ uid: string; fotos: string[]; carteira: string | null } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("pets_inquilino").select("fotos, carteira_vacina").eq("id", petId).eq("user_id", user.id).maybeSingle();
  if (!data) return null;
  return { uid: user.id, fotos: (data.fotos as string[] | null) ?? [], carteira: (data.carteira_vacina as string | null) ?? null };
}

/** Foto do pet (até 3) ou carteira de vacina (1): confere dono, tipo real e tamanho NO SERVIDOR e regrava como WebP sem EXIF. */
export async function enviarImagemPet(form: FormData): Promise<{ ok: true; pets: PetSalvo[] } | { ok: false; error: string }> {
  const v = validarEnvioFotoPet({ petId: form.get("petId"), tipo: form.get("tipo") });
  if (!v.ok) return v;
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Sem conexão com o banco." };
  const dono = await donoDoPet(supabase, v.petId);
  if (!dono) return { ok: false, error: "Pet não encontrado na sua conta." };
  if (!podeAdicionarFotoPet(v.tipo, v.tipo === "foto" ? dono.fotos.length : dono.carteira ? 1 : 0)) {
    return { ok: false, error: v.tipo === "foto" ? "Cada pet tem até 3 fotos. Remova uma para enviar outra." : "A carteira de vacina já foi enviada. Remova para trocar." };
  }
  if (!(await consumirLimite(`pet-foto:${dono.uid}`, 60, DIA))) return { ok: false, error: "Muitos envios hoje. Tente amanhã." };
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Escolha uma imagem." };
  if (file.size > PHOTO_MAX_BYTES) return { ok: false, error: "A imagem deve ter no máximo 8 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const recusa = { ok: false as const, error: "Envie uma foto JPG, PNG ou WebP de verdade." };
  if (!tipoRealFotoPorMagicBytes(bytes)) return recusa;
  const webp = await reconverterFotoParaWebp(bytes);
  if (!webp) return recusa;

  const caminho = novoCaminhoFotoPet(dono.uid, crypto.randomUUID());
  const { error: erroUp } = await supabase.storage.from(BUCKET_FOTOS_PET).upload(caminho, webp, { contentType: "image/webp", upsert: false });
  if (erroUp) return { ok: false, error: "Não foi possível salvar a imagem. Tente de novo." };
  const mudanca = v.tipo === "foto" ? { fotos: [...dono.fotos, caminho] } : { carteira_vacina: caminho };
  const { error } = await supabase.from("pets_inquilino").update(mudanca).eq("id", v.petId).eq("user_id", dono.uid);
  if (error) {
    await supabase.storage.from(BUCKET_FOTOS_PET).remove([caminho]);
    return { ok: false, error: "Não foi possível salvar a imagem. Tente de novo." };
  }
  return { ok: true, pets: (await meusPets()) ?? [] };
}

export async function removerImagemPet(petId: string, caminho: string): Promise<{ ok: true; pets: PetSalvo[] } | { ok: false; error: string }> {
  if (typeof petId !== "string" || !UUID_RE.test(petId)) return { ok: false, error: "Pet inválido." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Sem conexão com o banco." };
  const dono = await donoDoPet(supabase, petId);
  if (!dono || !caminhoFotoPetValido(caminho, dono.uid)) return { ok: false, error: "Imagem não encontrada." };
  const ehCarteira = dono.carteira === caminho;
  if (!ehCarteira && !dono.fotos.includes(caminho)) return { ok: false, error: "Imagem não encontrada." };
  const mudanca = ehCarteira ? { carteira_vacina: null } : { fotos: dono.fotos.filter((c) => c !== caminho) };
  const { error } = await supabase.from("pets_inquilino").update(mudanca).eq("id", petId).eq("user_id", dono.uid);
  if (error) return { ok: false, error: "Não foi possível remover." };
  await supabase.storage.from(BUCKET_FOTOS_PET).remove([caminho]);
  return { ok: true, pets: (await meusPets()) ?? [] };
}
