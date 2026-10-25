"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { erroBancoPT } from "@/lib/erros-banco";
import { categoriasDesligadasValidas, type CategoriaComInterruptor } from "@/config/matriz-notificacoes";

/*
  Prompt 44 (item 4): as categorias que a pessoa desligou em /dashboard/notificacoes (profiles.notif_categorias_desligadas,
  0227). Mensagens, lembretes e outros avisos têm interruptor; decisões e segurança, não (sempre chegam). Grava pelo
  servidor, só na própria conta e só categorias com interruptor (o banco recusa o resto).
*/

/** As categorias desligadas da própria conta ([] = tudo ligado, o padrão). */
export async function getCategoriasDesligadas(): Promise<CategoriaComInterruptor[]> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await admin.from("profiles").select("notif_categorias_desligadas").eq("id", user.id).maybeSingle();
  return categoriasDesligadasValidas((data as { notif_categorias_desligadas?: unknown } | null)?.notif_categorias_desligadas);
}

export async function setCategoriasDesligadas(categorias: string[]): Promise<{ ok: boolean; demo?: boolean; error?: string }> {
  if (!Array.isArray(categorias)) return { ok: false, error: "Valor inválido." };
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para alterar preferências." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Não foi possível salvar agora. Tente de novo." };
  const { error } = await admin
    .from("profiles")
    .update({ notif_categorias_desligadas: categoriasDesligadasValidas(categorias) })
    .eq("id", user.id);
  if (error) return { ok: false, error: erroBancoPT(error) };
  return { ok: true };
}
