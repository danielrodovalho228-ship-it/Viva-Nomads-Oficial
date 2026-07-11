"use server";

import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import { primeiroNome } from "@/lib/display-name";

type ActionResult = { ok: boolean; demo?: boolean; error?: string };

const DOCS_BUCKET = "property-docs";
const SIGNED_TTL = 60 * 10; // 10 min — janela curta para o admin abrir o documento

export interface DocumentoPendente {
  id: string; // id da qualificação
  ownerId: string;
  ownerNome: string; // primeiro nome (exibição) — NUNCA o e-mail
  criadoEm: string | null;
  docUrl: string | null; // URL assinada curta para o admin abrir (nunca pública)
}

/**
 * Fila de moderação (admin): documentos de imóvel aguardando verificação. A RLS
 * `is_admin()` (migration 0042) libera a leitura completa; para não-admin a
 * política devolve nada e a rota é gated pelo nav admin. Gera uma URL ASSINADA
 * curta por documento — o bucket é privado. O e-mail do dono NÃO é exposto ao
 * cliente (só o primeiro nome).
 */
export async function listDocumentosPendentes(): Promise<DocumentoPendente[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("qualification_checklists")
    .select("id, owner_id, document_path, created_at")
    .eq("document_status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);

  const out: DocumentoPendente[] = [];
  for (const r of data ?? []) {
    const ownerId = r.owner_id as string;
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", ownerId)
      .maybeSingle();
    let docUrl: string | null = null;
    if (r.document_path) {
      const { data: signed } = await supabase.storage
        .from(DOCS_BUCKET)
        .createSignedUrl(r.document_path as string, SIGNED_TTL);
      docUrl = signed?.signedUrl ?? null;
    }
    out.push({
      id: r.id as string,
      ownerId,
      ownerNome: primeiroNome(prof?.full_name as string | undefined) || "Proprietário",
      criadoEm: (r.created_at as string) ?? null,
      docUrl,
    });
  }
  return out;
}

/**
 * Admin APROVA ou RECUSA um documento (recusa exige motivo). Grava o desfecho +
 * quem/quando e NOTIFICA o proprietário por e-mail (layout-mãe) nos dois casos.
 * Só aprovado libera o botão Publicar do dono. A RLS `is_admin()` autoriza o
 * update; se um não-admin chamar, o update não casa nenhuma linha.
 */
export async function moderarDocumento(
  qualId: string,
  aprovado: boolean,
  motivo?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };

  const motivoLimpo = (motivo ?? "").trim();
  if (!aprovado && !motivoLimpo) return { ok: false, error: "Informe o motivo da recusa." };

  const { data: qual, error } = await supabase
    .from("qualification_checklists")
    .update({
      document_status: aprovado ? "approved" : "rejected",
      document_review_reason: aprovado ? null : motivoLimpo,
      document_reviewed_at: new Date().toISOString(),
      document_reviewed_by: user.id,
    })
    .eq("id", qualId)
    .eq("document_status", "pending") // só modera o que está na fila
    .select("owner_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!qual) return { ok: false, error: "Documento não encontrado na fila (ou sem permissão)." };

  // E-mail ao proprietário nos dois desfechos (best-effort — não trava a ação).
  try {
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, email, notif_email")
      .eq("id", qual.owner_id as string)
      .maybeSingle();
    if (prof?.email && prof.notif_email !== false) {
      await notify({
        event: aprovado ? "documento_aprovado" : "documento_recusado",
        email: prof.email as string,
        name: (prof.full_name as string) ?? undefined,
        detailsHtml: aprovado
          ? undefined
          : `<p style="margin:12px 0 0;color:#334155;">Motivo: ${motivoLimpo}</p>`,
        detailsText: aprovado ? undefined : `Motivo: ${motivoLimpo}`,
      });
    }
  } catch {
    /* best-effort */
  }
  return { ok: true };
}
