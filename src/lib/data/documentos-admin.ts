"use server";

import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notifications";
import { primeiroNome } from "@/lib/display-name";
import { tipoVisualizacaoDoc, type VisualizacaoDoc } from "@/lib/moderacao-doc";
import { ehAdmin } from "@/lib/data/admin-guard";
import { textoEmail } from "@/lib/notifications/texto-seguro";
import { logModeracao } from "@/lib/data/moderacao-log";
import { erroBancoPT } from "@/lib/erros-banco";

type ActionResult = { ok: boolean; demo?: boolean; error?: string };

const DOCS_BUCKET = "property-docs";
const SIGNED_TTL = 60 * 10; // 10 min — janela curta para o admin abrir o documento

export interface DocumentoPendente {
  id: string; // id da qualificação
  ownerId: string;
  ownerNome: string; // primeiro nome (exibição) — NUNCA o e-mail
  ownerNomeCompleto: string | null; // nome completo p/ conferir contra o documento
  refImovel: string | null; // endereço/imóvel do cadastro p/ comparação lado a lado
  tituloImovel: string | null; // título do anúncio, ao lado do nome do dono
  criadoEm: string | null;
  docUrl: string | null; // URL assinada curta para o admin abrir (nunca pública)
  docTipo: VisualizacaoDoc; // como exibir inline (imagem | pdf | outro)
  duplicado: number; // quantos OUTROS cadastros têm o MESMO arquivo (sinal de fraude)
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
    .select("id, owner_id, property_id, document_path, document_hash_sha256, created_at")
    .eq("document_status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);

  // Um item por documento: re-salvar a qualificação repete o documento em
  // outra linha (0072) — mostra só a mais recente de cada (dono, imóvel, arquivo).
  const unicos = new Map<string, NonNullable<typeof data>[number]>();
  for (const r of data ?? []) unicos.set(`${r.owner_id}|${r.property_id ?? ""}|${r.document_path}`, r);

  const out: DocumentoPendente[] = [];
  for (const r of unicos.values()) {
    const ownerId = r.owner_id as string;
    const nomeCompleto = (
      await supabase.from("profiles").select("full_name").eq("id", ownerId).maybeSingle()
    ).data?.full_name as string | undefined;

    // Referência do imóvel (bairro/cidade do cadastro mais recente do dono) para
    // a conferência lado a lado — o admin compara com o que consta no documento.
    // O imóvel LIGADO à qualificação, quando houver; senão o mais recente do dono.
    let refImovel: string | null = null;
    const propQuery = supabase.from("properties").select("title, address, city");
    const { data: prop } = r.property_id
      ? await propQuery.eq("id", r.property_id as string).maybeSingle()
      : await propQuery
          .eq("owner_id", ownerId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
    if (prop) {
      // `address` é a coluna do bairro (não há coluna "neighborhood" — antes vinha vazio).
      const local = [prop.address, prop.city].filter(Boolean).join(", ");
      refImovel = [prop.title, local].filter(Boolean).join(" — ") || null;
    }

    // Reuso do MESMO arquivo em outros cadastros (impressão digital, 0044).
    let duplicado = 0;
    if (r.document_hash_sha256) {
      const { count } = await supabase
        .from("qualification_checklists")
        .select("id", { count: "exact", head: true })
        .eq("document_hash_sha256", r.document_hash_sha256 as string)
        .neq("id", r.id as string);
      duplicado = count ?? 0;
    }

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
      ownerNome: primeiroNome(nomeCompleto) || "Proprietário",
      ownerNomeCompleto: nomeCompleto || null,
      refImovel,
      tituloImovel: (prop?.title as string | undefined) || null,
      criadoEm: (r.created_at as string) ?? null,
      docUrl,
      docTipo: tipoVisualizacaoDoc(r.document_path as string | null),
      duplicado,
    });
  }
  return out;
}

/** Quantidade de documentos aguardando conferência — para o badge do nav admin.
 * A RLS `is_admin()` libera; para não-admin devolve 0 (a política não casa). */
export async function countDocumentosPendentes(): Promise<number> {
  const supabase = await createClient();
  if (!supabase) return 0;
  const { data } = await supabase
    .from("qualification_checklists")
    .select("owner_id, property_id, document_path")
    .eq("document_status", "pending")
    .limit(500);
  // Conta documentos, não linhas (o mesmo documento pode se repetir — 0072).
  return new Set((data ?? []).map((r) => `${r.owner_id}|${r.property_id ?? ""}|${r.document_path}`)).size;
}

/**
 * Admin APROVA ou RECUSA um documento (recusa exige motivo). Grava o desfecho +
 * quem/quando e NOTIFICA o proprietário por e-mail (layout-mãe) nos dois casos.
 * Só aprovado libera o botão Publicar do dono. A3: exige ADMIN aqui (antes só
 * confiava na RLS — e a regra do dono deixava ele aprovar o próprio documento) e
 * ninguém modera o PRÓPRIO documento. O banco reforça (0056).
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
  if (!(await ehAdmin(supabase, user.id))) return { ok: false, error: "Sem permissão." };

  const motivoLimpo = (motivo ?? "").trim();
  if (!aprovado && !motivoLimpo) return { ok: false, error: "Informe o motivo da recusa." };

  // O mesmo documento pode estar em mais de uma linha "em análise": salvar a
  // qualificação de novo sem trocar o arquivo herda o documento (0072). A
  // decisão vale para TODAS essas linhas — senão a mais recente (a que o
  // editor lê) ficava pendente e o Publicar não liberava.
  const { data: alvo } = await supabase
    .from("qualification_checklists")
    .select("owner_id, property_id, document_path")
    .eq("id", qualId)
    .eq("document_status", "pending")
    .maybeSingle();
  if (!alvo?.document_path) return { ok: false, error: "Documento não encontrado na fila (ou sem permissão)." };
  let upd = supabase
    .from("qualification_checklists")
    .update({
      document_status: aprovado ? "approved" : "rejected",
      document_review_reason: aprovado ? null : motivoLimpo,
      document_reviewed_at: new Date().toISOString(),
      document_reviewed_by: user.id,
    })
    .eq("owner_id", alvo.owner_id as string)
    .eq("document_path", alvo.document_path as string)
    .eq("document_status", "pending") // só modera o que está na fila
    .neq("owner_id", user.id); // ninguém aprova o próprio documento
  upd = alvo.property_id ? upd.eq("property_id", alvo.property_id as string) : upd.is("property_id", null);
  const { data: linhas, error } = await upd.select("owner_id");
  if (error) return { ok: false, error: erroBancoPT(error) };
  const qual = linhas?.[0];
  if (!qual) return { ok: false, error: "Documento não encontrado na fila (ou sem permissão)." };
  await logModeracao(
    supabase,
    user.id,
    aprovado ? "aprovar_documento" : "recusar_documento",
    "qualificacao",
    qualId,
    aprovado ? null : motivoLimpo
  );

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
        userId: qual.owner_id as string,
        pushUrl: "/dashboard/imoveis",
        detailsHtml: aprovado
          ? undefined
          : `<p style="margin:12px 0 0;color:#334155;">Motivo: ${textoEmail(motivoLimpo, 500)}</p>`,
        detailsText: aprovado ? undefined : `Motivo: ${motivoLimpo}`,
      });
    }
  } catch {
    /* best-effort */
  }
  return { ok: true };
}
