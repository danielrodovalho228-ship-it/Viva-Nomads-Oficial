"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { notify } from "@/lib/notifications";
import { textoEmail } from "@/lib/notifications/texto-seguro";
import { logModeracao } from "@/lib/data/moderacao-log";

type ActionResult = { ok: boolean; demo?: boolean; error?: string };

/**
 * Painel de admin com DADOS REAIS. Antes os números ("Usuários: 28", "Imóveis
 * ativos: 3") e a fila de checklists (3 nomes de exemplo) estavam escritos no
 * código, e Aprovar/Recusar mostravam "Aprovado" sem gravar nada.
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
  checklistsPendentes: number;
  documentosPendentes: number;
  pedidosAtivos: number;
}

export interface ChecklistPendente {
  id: string;
  ownerId: string;
  ownerNome: string;
  imovel: string | null;
  nota: number | null;
  elegivel: boolean | null;
  documento: string; // document_status: none | pending | approved | rejected
  criadoEm: string | null;
  proprio: boolean; // checklist do próprio admin (não pode revisar)
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
    checklistsPendentes,
    documentosPendentes,
    pedidosAtivos,
  ] = await Promise.all([
    contar(total("profiles").is("anonymized_at", null)),
    contar(total("profiles").is("anonymized_at", null).eq("role", "owner")),
    contar(total("profiles").is("anonymized_at", null).eq("role", "tenant")),
    contar(total("properties").eq("status", "active")),
    contar(total("properties").eq("status", "draft")),
    contar(total("qualification_checklists").eq("status", "pending")),
    contar(total("qualification_checklists").eq("document_status", "pending")),
    contar(total("pedidos_moradia").eq("status", "ativo")),
  ]);

  return {
    usuarios,
    proprietarios,
    inquilinos,
    imoveisAtivos,
    imoveisRascunho,
    checklistsPendentes,
    documentosPendentes,
    pedidosAtivos,
  };
}

/** Checklists de qualificação aguardando a equipe (status 'pending'). */
export async function listChecklistsPendentes(): Promise<ChecklistPendente[]> {
  const adminId = await adminLogado();
  const admin = createAdminClient();
  if (!adminId || !admin) return [];

  const { data } = await admin
    .from("qualification_checklists")
    .select("id, owner_id, property_id, ready_to_live_score, eligible, document_status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);
  const linhas = data ?? [];
  if (linhas.length === 0) return [];

  const ownerIds = [...new Set(linhas.map((r) => r.owner_id as string))];
  const propIds = linhas.map((r) => r.property_id as string | null).filter((x): x is string => !!x);

  const [{ data: perfis }, { data: props }, { data: ultimos }] = await Promise.all([
    admin.from("profiles").select("id, full_name").in("id", ownerIds),
    propIds.length
      ? admin.from("properties").select("id, title").in("id", propIds)
      : Promise.resolve({ data: [] as { id: string; title: string | null }[] }),
    // Checklist sem imóvel ligado: mostra o anúncio mais recente do dono.
    admin
      .from("properties")
      .select("owner_id, title, created_at")
      .in("owner_id", ownerIds)
      .order("created_at", { ascending: false }),
  ]);

  const nomePor = new Map((perfis ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));
  const tituloPor = new Map((props ?? []).map((p) => [p.id as string, (p.title as string) || ""]));
  const ultimoPor = new Map<string, string>();
  for (const p of ultimos ?? []) {
    const o = p.owner_id as string;
    if (!ultimoPor.has(o) && p.title) ultimoPor.set(o, p.title as string);
  }

  return linhas.map((r) => {
    const ownerId = r.owner_id as string;
    const propId = r.property_id as string | null;
    return {
      id: r.id as string,
      ownerId,
      ownerNome: nomePor.get(ownerId) || "Proprietário sem nome",
      imovel: (propId && tituloPor.get(propId)) || ultimoPor.get(ownerId) || null,
      nota: (r.ready_to_live_score as number | null) ?? null,
      elegivel: (r.eligible as boolean | null) ?? null,
      documento: (r.document_status as string) || "none",
      criadoEm: (r.created_at as string) ?? null,
      proprio: ownerId === adminId,
    };
  });
}

/**
 * Admin APROVA ou RECUSA o checklist de qualificação. Grava pelo cliente da
 * SESSÃO (a RLS de admin da 0042 e o trigger da 0056 conferem de novo no
 * banco), só o que está na fila, nunca o próprio. A tela só mostra o desfecho
 * quando o banco confirma a linha alterada. Recusa exige motivo, enviado ao
 * proprietário por e-mail.
 */
export async function revisarChecklist(
  id: string,
  aprovado: boolean,
  motivo?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  if (!(await ehAdmin(supabase, user.id))) return { ok: false, error: "Sem permissão." };

  const motivoLimpo = (motivo ?? "").trim().slice(0, 500);
  if (!aprovado && !motivoLimpo) return { ok: false, error: "Informe o motivo da recusa." };

  const { data: linha, error } = await supabase
    .from("qualification_checklists")
    .update({ status: aprovado ? "approved" : "not_eligible" })
    .eq("id", id)
    .eq("status", "pending") // só revisa o que está na fila
    .neq("owner_id", user.id) // ninguém revisa o próprio
    .select("owner_id")
    .maybeSingle();
  if (error) return { ok: false, error: "Não foi possível gravar: " + error.message };
  if (!linha) return { ok: false, error: "Checklist não está mais na fila (ou é seu)." };
  await logModeracao(
    supabase,
    user.id,
    aprovado ? "aprovar_checklist" : "recusar_checklist",
    "qualificacao",
    id,
    aprovado ? null : motivoLimpo
  );

  try {
    const admin = createAdminClient() ?? supabase;
    const { data: prof } = await admin
      .from("profiles")
      .select("full_name, email, notif_email")
      .eq("id", linha.owner_id as string)
      .maybeSingle();
    if (prof?.email && prof.notif_email !== false) {
      await notify({
        event: aprovado ? "checklist_aprovado" : "checklist_recusado",
        email: prof.email as string,
        name: (prof.full_name as string) ?? undefined,
        userId: linha.owner_id as string,
        pushUrl: "/dashboard/imoveis",
        detailsHtml: aprovado
          ? undefined
          : `<p style="margin:12px 0 0;color:#334155;">Motivo: ${textoEmail(motivoLimpo, 500)}</p>`,
        detailsText: aprovado ? undefined : `Motivo: ${motivoLimpo}`,
      });
    }
  } catch {
    /* e-mail é best-effort: a revisão já foi gravada */
  }
  return { ok: true };
}
