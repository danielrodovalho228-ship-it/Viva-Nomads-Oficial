"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";

/**
 * Painel de admin com DADOS REAIS (antes os números estavam escritos no
 * código). A fila de "checklists pendentes" saiu: a qualificação nunca fica
 * 'pending' — o portão humano é o documento (/admin/documentos).
 *
 * Toda leitura confere ADMIN no servidor antes; as contagens usam o cliente de
 * serviço (a RLS de profiles só deixa ler o próprio perfil). Em modo
 * demonstração (sem Supabase) tudo volta vazio — nunca dado inventado.
 */

export interface ResumoAdmin {
  usuarios: number;
  proprietarios: number;
  inquilinos: number;
  imoveisAtivos: number;
  imoveisRascunho: number;
  documentosPendentes: number;
  pedidosAtivos: number;
}

/** Admin logado (id) ou null. */
async function adminLogado(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return (await ehAdmin(supabase, user.id)) ? user.id : null;
}

export async function getResumoAdmin(): Promise<ResumoAdmin | null> {
  const adminId = await adminLogado();
  const admin = createAdminClient();
  if (!adminId || !admin) return null;

  const contar = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);
  const total = (tabela: string) => admin.from(tabela).select("*", { count: "exact", head: true });

  const [
    usuarios,
    proprietarios,
    inquilinos,
    imoveisAtivos,
    imoveisRascunho,
    documentosPendentes,
    pedidosAtivos,
  ] = await Promise.all([
    contar(total("profiles").is("anonymized_at", null)),
    contar(total("profiles").is("anonymized_at", null).eq("role", "owner")),
    contar(total("profiles").is("anonymized_at", null).eq("role", "tenant")),
    contar(total("properties").eq("status", "active")),
    contar(total("properties").eq("status", "draft")),
    contar(total("qualification_checklists").eq("document_status", "pending")),
    contar(total("pedidos_moradia").eq("status", "ativo")),
  ]);

  return {
    usuarios,
    proprietarios,
    inquilinos,
    imoveisAtivos,
    imoveisRascunho,
    documentosPendentes,
    pedidosAtivos,
  };
}
