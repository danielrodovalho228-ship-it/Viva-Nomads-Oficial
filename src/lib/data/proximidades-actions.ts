"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";

/*
  PERTO-B — "Está errado" num lugar achado pelo OpenStreetMap: o dono manda um motivo curto e a equipe vê em
  /admin/proximidades. Grava pela SESSÃO (RLS da 0238: só o dono do anúncio cria; a página pública não lê).
*/
export async function reportarProximidade(propertyId: string, nome: string, tipo: string | null, motivo: string): Promise<{ ok: boolean; erro?: string }> {
  const m = String(motivo ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 200);
  const n = String(nome ?? "").replace(/[<>]/g, "").trim().slice(0, 120);
  if (!/^[0-9a-f-]{36}$/i.test(String(propertyId))) return { ok: false, erro: "Salve o anúncio antes de avisar." };
  if (!n) return { ok: false, erro: "Lugar inválido." };
  if (m.length < 3) return { ok: false, erro: "Escreva o que está errado." };
  const supabase = await createClient();
  if (!supabase) return { ok: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Entre para avisar." };
  const { error } = await supabase.from("proximidades_reportes").insert({ property_id: propertyId, nome: n, tipo: tipo ? String(tipo).slice(0, 30) : null, motivo: m });
  if (error) return { ok: false, erro: "Não foi possível enviar agora. Tente de novo." };
  return { ok: true };
}

/** Admin: "Resolvido" num aviso de lugar errado (some da lista). Só admin com a 2ª etapa (ehAdmin); grava pelo serviço. */
export async function resolverReporteProximidade(id: string): Promise<{ ok: boolean; erro?: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return { ok: false, erro: "Aviso inválido." };
  const supabase = await createClient();
  if (!supabase) return { ok: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return { ok: false, erro: "Só admin." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, erro: "Indisponível." };
  const { error } = await admin.from("proximidades_reportes").update({ resolvido_em: new Date().toISOString() }).eq("id", id).is("resolvido_em", null);
  return error ? { ok: false, erro: "Não foi possível marcar agora." } : { ok: true };
}
