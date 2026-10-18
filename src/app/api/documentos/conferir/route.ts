import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, DIA } from "@/lib/limites";
import { notify } from "@/lib/notifications";
import { adminsPorAviso } from "@/lib/notifications/push-admins";
import { tipoRealPorMagicBytes, DOC_MIME } from "@/lib/upload-limits";
import { lerDocumento } from "@/lib/documento/conferidor";
import {
  decidirConferencia,
  rotuloEstado,
  statusDoEstado,
  REVISAO_PRAZO_HORAS,
  type CadastroComparado,
} from "@/lib/documento/conferencia";
import { hojeBR } from "@/lib/utils";

const BUCKET = "property-docs";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * CONFERÊNCIA AUTOMÁTICA do documento do imóvel (prompt 11), chamada pela etapa 1 do cadastro logo depois do
 * envio (/api/upload/documento). O servidor baixa o arquivo do bucket PRIVADO, a IA só LÊ e o código decide
 * (src/lib/documento/conferencia.ts) com o checklist do admin:
 *   aprovado → document_status 'approved' (conferido_por automático) · corrija → 'rejected' com o motivo ·
 *   revisão → 'pending', prazo de 48 h, aviso aos admins.
 * Grava uma NOVA linha de qualificação com o cliente de serviço (o dono não grava status — 0060/0072/0152),
 * herdando as respostas da qualificação anterior do mesmo imóvel. A resposta nunca traz o que a IA leu (CPF,
 * nome, endereço): só o estado, os motivos e o checklist.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ estado: "aprovado", rotulo: rotuloEstado("aprovado"), motivos: [], demo: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const path = typeof corpo?.path === "string" ? corpo.path : "";
  const imovelId = typeof corpo?.imovelId === "string" && UUID_RE.test(corpo.imovelId) ? corpo.imovelId : null;
  const end = (corpo?.endereco && typeof corpo.endereco === "object" ? corpo.endereco : {}) as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[<>]/g, "").trim().slice(0, max) : "");
  const operacao = s(corpo?.operacao, 20) || "own";

  // Só o arquivo do PRÓPRIO dono (o upload grava em <user.id>/<uuid>.<ext>).
  if (!new RegExp(`^${user.id}/[0-9a-f-]{36}\\.(pdf|png|jpg)$`).test(path)) {
    return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  }
  if (!(await consumirLimite(`doc-conferir:${user.id}`, 20, DIA))) {
    return NextResponse.json({ error: "Muitas conferências hoje. Tente novamente amanhã." }, { status: 429 });
  }
  if (imovelId) {
    const { data: prop } = await supabase.from("properties").select("id").eq("id", imovelId).eq("owner_id", user.id).maybeSingle();
    if (!prop) return NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });

  const { data: blob, error: erroDl } = await admin.storage.from(BUCKET).download(path);
  if (erroDl || !blob) return NextResponse.json({ error: "Não encontramos o documento enviado." }, { status: 404 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mime = tipoRealPorMagicBytes(bytes);
  if (!mime || !DOC_MIME.includes(mime as (typeof DOC_MIME)[number])) {
    return NextResponse.json({ error: "Tipo de arquivo inválido." }, { status: 415 });
  }
  // Impressão digital calculada AQUI (não confia na do cliente): reuso por outra conta = duplicado.
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const { count: duplicado } = await admin
    .from("qualification_checklists")
    .select("id", { count: "exact", head: true })
    .eq("document_hash_sha256", hash)
    .neq("owner_id", user.id);

  const { data: perfil } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const cadastro: CadastroComparado = {
    nomeConta: (perfil?.full_name as string | null) ?? null,
    endereco: { cep: s(end.cep, 9), rua: s(end.rua, 150), numero: s(end.numero, 20), bairro: s(end.bairro, 100), cidade: s(end.cidade, 100) },
    operacao,
    duplicado: duplicado ?? 0,
    hoje: hojeBR(),
  };

  const { leitura, conferidor, modelo } = await lerDocumento({ bytes, mime }, cadastro);
  const r = decidirConferencia(leitura, cadastro);
  const agora = new Date();

  // Respostas da qualificação anterior do mesmo imóvel (ou da que está à espera): a linha nova só troca o documento.
  const ultima = async (doImovel: string | null) => {
    let q = admin.from("qualification_checklists").select("*").eq("owner_id", user.id);
    q = doImovel ? q.eq("property_id", doImovel) : q.is("property_id", null);
    return (await q.order("created_at", { ascending: false }).limit(1).maybeSingle()).data;
  };
  // Imóvel já com rascunho: a dele; sem nenhuma ainda, a que estava à espera (respondida antes do rascunho existir).
  const anterior = (imovelId ? await ultima(imovelId) : null) ?? (await ultima(null));
  const herdado: Record<string, unknown> = { ...(anterior ?? {}) };
  for (const k of [
    "id", "created_at", "document_path", "document_hash_sha256", "document_uploaded_at", "document_status",
    "document_review_reason", "document_reviewed_at", "document_reviewed_by", "conferencia", "conferido_por", "revisao_ate",
  ]) delete herdado[k];

  const motivosTexto = r.motivos.map((m) => m.texto).join(" · ").slice(0, 500) || null;
  const { error: erroIns } = await admin.from("qualification_checklists").insert({
    ...herdado,
    owner_id: user.id,
    property_id: imovelId,
    document_path: path,
    document_hash_sha256: hash,
    document_uploaded_at: agora.toISOString(),
    document_status: statusDoEstado(r.estado),
    document_review_reason: r.estado === "aprovado" ? null : motivosTexto,
    document_reviewed_at: r.estado === "revisao" ? null : agora.toISOString(),
    conferido_por: r.estado === "revisao" ? null : "automatico",
    revisao_ate: r.estado === "revisao" ? new Date(agora.getTime() + REVISAO_PRAZO_HORAS * 3_600_000).toISOString() : null,
    // Trilha de auditoria: o que foi lido, por quem, e o checklist marcado. CPF só o trecho do meio.
    conferencia: {
      versao: 1,
      estado: r.estado,
      checklist: r.checklist,
      motivos: r.motivos,
      leitura,
      conferidor,
      modelo,
      em: agora.toISOString(),
    },
  });
  if (erroIns) {
    console.error("[conferir-documento] falha ao gravar:", erroIns.message);
    return NextResponse.json({ error: "Não foi possível salvar a conferência agora. Tente de novo." }, { status: 500 });
  }

  // Só os casos em revisão entram na fila: avisa os admins (sem dados do documento).
  if (r.estado === "revisao") {
    try {
      const admins = await adminsPorAviso<{ email: string | null; full_name: string | null; notif_email: boolean | null }>(
        "operacional",
        "email, full_name, notif_email",
      );
      for (const a of admins) {
        if (a.email && a.notif_email !== false) {
          await notify({ event: "documento_recebido", email: a.email, name: a.full_name ?? undefined, pushUrl: "/admin/documentos" });
        }
      }
    } catch {
      /* best-effort */
    }
  }

  return NextResponse.json({
    estado: r.estado,
    rotulo: rotuloEstado(r.estado),
    motivos: r.motivos.map((m) => m.texto),
  });
}
