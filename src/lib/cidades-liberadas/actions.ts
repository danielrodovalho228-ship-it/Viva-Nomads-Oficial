"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sessaoAal2 } from "@/lib/data/admin-guard";
import { consumirLimite } from "@/lib/limites";
import { chaveCidade } from "@/lib/cidades";
import { cidadeLiberada, validarInteresse } from "./regras";
import { listarCidades } from "./servidor";

export type ResultadoCidade = { ok: boolean; erro?: string; mensagem?: string };

/** A cidade (e UF, se houver) está liberada? Leitura pública. Sem a tabela, não esconde nada: devolve liberada. */
export async function statusCidade(cidade: string, uf?: string): Promise<{ liberada: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { liberada: true };
  const lista = await listarCidades(supabase);
  if (!lista) return { liberada: true };
  return { liberada: cidadeLiberada(lista, String(cidade ?? "").slice(0, 80), String(uf ?? "").slice(0, 2)) };
}

/** Interesse numa cidade ainda não liberada. Quem pede vem da SESSÃO; o contato é o do perfil (nada vai no formulário). */
export async function registrarInteresseCidade(entrada: { cidade: string; uf: string; papel: string }): Promise<ResultadoCidade> {
  const v = validarInteresse(entrada);
  if (!v.ok) return { ok: false, erro: v.erro };
  const supabase = await createClient();
  if (!supabase) return { ok: false, erro: "Indisponível no modo demonstração." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Entre na sua conta para deixar seu interesse." };
  if (!(await consumirLimite(`interesse-cidade:${user.id}`, 20, 3600))) return { ok: false, erro: "Muitas tentativas. Tente de novo mais tarde." };
  const { error } = await supabase
    .from("interesse_cidade")
    .upsert({ user_id: user.id, uf: v.uf, chave: v.chave, cidade: v.cidade, papel: v.papel }, { onConflict: "user_id,uf,chave,papel", ignoreDuplicates: true });
  if (error) return { ok: false, erro: "Não foi possível registrar agora. Tente novamente." };
  return { ok: true, mensagem: `Anotado! Avisamos você quando a Viva chegar em ${v.cidade}.` };
}

async function exigirAdmin() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return perfil?.role === "admin" && (await sessaoAal2(supabase)) ? { supabase } : null;
}

const aposMudar = () => {
  revalidatePath("/admin/cidades");
  revalidatePath("/buscar");
  revalidatePath("/pedidos/novo");
};

/** Admin: libera ou pausa uma cidade que já está na tabela. */
export async function alternarCidade(uf: string, chave: string, liberar: boolean): Promise<ResultadoCidade> {
  const adm = await exigirAdmin();
  if (!adm) return { ok: false, erro: "Sem permissão." };
  const ufN = String(uf ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(ufN) || !chave || chave.length > 80) return { ok: false, erro: "Cidade inválida." };
  const { error } = await adm.supabase
    .from("cidades_liberadas")
    .update({ liberada: Boolean(liberar), liberada_em: liberar ? new Date().toISOString() : null })
    .eq("uf", ufN)
    .eq("chave", chave);
  if (error) return { ok: false, erro: "Não foi possível atualizar." };
  aposMudar();
  return { ok: true };
}

/** Admin: cadastra uma cidade (já liberada ou pausada). */
export async function cadastrarCidade(_: ResultadoCidade | null, form: FormData): Promise<ResultadoCidade> {
  const adm = await exigirAdmin();
  if (!adm) return { ok: false, erro: "Sem permissão." };
  const v = validarInteresse({ cidade: form.get("cidade"), uf: form.get("uf"), papel: "inquilino" });
  if (!v.ok) return { ok: false, erro: v.erro };
  const liberar = form.get("liberada") === "on";
  const observacao = String(form.get("observacao") ?? "").trim().slice(0, 300) || null;
  const { error } = await adm.supabase.from("cidades_liberadas").upsert(
    { uf: v.uf, chave: chaveCidade(v.cidade), cidade: v.cidade, liberada: liberar, liberada_em: liberar ? new Date().toISOString() : null, observacao },
    { onConflict: "uf,chave" },
  );
  if (error) return { ok: false, erro: "Não foi possível salvar." };
  aposMudar();
  return { ok: true, mensagem: liberar ? `${v.cidade} liberada.` : `${v.cidade} cadastrada (pausada).` };
}
