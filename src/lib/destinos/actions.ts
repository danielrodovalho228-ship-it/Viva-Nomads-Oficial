"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sessaoAal2 } from "@/lib/data/admin-guard";
import { validarDestino } from "./regras";

export type ResultadoDestino = { ok: boolean; erro?: string; mensagem?: string };

async function exigirAdmin() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return perfil?.role === "admin" && (await sessaoAal2(supabase)) ? { supabase, userId: user.id } : null;
}

const aposMudar = (slug?: string) => {
  revalidatePath("/admin/destinos");
  revalidatePath("/buscar");
  if (slug) revalidatePath(`/imoveis-perto-de/${slug}`);
};

/** Admin: cadastra ou corrige um destino (pelo endereço da página). Sem ponto, fica inativo. */
export async function salvarDestino(_: ResultadoDestino | null, form: FormData): Promise<ResultadoDestino> {
  const adm = await exigirAdmin();
  if (!adm) return { ok: false, erro: "Sem permissão." };
  const v = validarDestino(Object.fromEntries(form.entries()));
  if (!v.ok) return { ok: false, erro: v.erro };
  const d = v.destino;
  const { data: existente } = await adm.supabase.from("destinos").select("id, ativo").eq("slug", d.slug).maybeSingle();
  const semPonto = d.lat == null || d.lng == null;
  const linha = { nome: d.nome, artigo: d.artigo, tipo: d.tipo, cidade: d.cidade, uf: d.uf, lat: d.lat, lng: d.lng };
  const { error } = existente
    ? await adm.supabase.from("destinos").update({ ...linha, ...(semPonto ? { ativo: false } : {}) }).eq("id", existente.id)
    : await adm.supabase.from("destinos").insert({ ...linha, slug: d.slug, ativo: false, criado_por: adm.userId });
  if (error) return { ok: false, erro: "Não foi possível salvar." };
  aposMudar(d.slug);
  return { ok: true, mensagem: semPonto ? `${d.nome} salvo sem ponto: confira no mapa para poder ativar.` : `${d.nome} salvo. Ative quando conferir o ponto no mapa.` };
}

/** Admin: ativa ou desativa (ativar exige ponto — o banco também recusa). */
export async function alternarDestino(id: string, ativar: boolean): Promise<ResultadoDestino> {
  const adm = await exigirAdmin();
  if (!adm) return { ok: false, erro: "Sem permissão." };
  if (!/^[0-9a-f-]{36}$/.test(id)) return { ok: false, erro: "Destino inválido." };
  const { data, error } = await adm.supabase.from("destinos").update({ ativo: Boolean(ativar) }).eq("id", id).select("slug");
  if (error) return { ok: false, erro: ativar ? "Confira o ponto no mapa antes de ativar." : "Não foi possível atualizar." };
  aposMudar((data?.[0] as { slug?: string } | undefined)?.slug);
  return { ok: true };
}
