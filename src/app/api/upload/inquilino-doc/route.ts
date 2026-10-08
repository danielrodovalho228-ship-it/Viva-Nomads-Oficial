import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, DIA } from "@/lib/limites";
import { DOC_MAX_BYTES, DOC_MIN_BYTES, DOC_MIME, tipoRealPorMagicBytes } from "@/lib/upload-limits";
import { caminhoDocInquilino, tipoDocValido } from "@/lib/documentos-inquilino";
import { BUCKET_DOCS_INQUILINO } from "@/lib/data/documentos-inquilino-servidor";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Documento do INQUILINO depois do aceite (identidade, renda ou vínculo).
 * Só o inquilino da candidatura ACEITA envia. Tipo real por magic bytes,
 * tamanho mín/máx, hash. Grava pelo SERVIDOR no bucket privado inquilino-docs
 * (sem política para o navegador) e substitui o anterior do mesmo tipo.
 * Nada do documento vai para log.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return NextResponse.json({ error: "Indisponível no momento." }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const leadId = String(form?.get("leadId") ?? "");
  const tipo = form?.get("tipo");
  const file = form?.get("file");
  if (!UUID_RE.test(leadId) || !tipoDocValido(tipo)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });

  // A candidatura é DESTE inquilino e já foi ACEITA (antes do aceite, nenhum documento).
  const { data: lead } = await admin.from("leads").select("id, tenant_id, status").eq("id", leadId).maybeSingle();
  if (!lead || lead.tenant_id !== user.id) return NextResponse.json({ error: "Candidatura não encontrada." }, { status: 404 });
  if (lead.status !== "accepted") {
    return NextResponse.json({ error: "Os documentos são pedidos só depois que o proprietário aceita a candidatura." }, { status: 409 });
  }

  if (!(await consumirLimite(`inq-doc:${user.id}`, 20, DIA))) {
    return NextResponse.json({ error: "Muitos envios de documento hoje. Tente novamente amanhã." }, { status: 429 });
  }
  if (file.size < DOC_MIN_BYTES) {
    return NextResponse.json({ error: `Arquivo pequeno demais (mín. ${Math.round(DOC_MIN_BYTES / 1024)} KB) — parece não ser um documento válido.` }, { status: 400 });
  }
  if (file.size > DOC_MAX_BYTES) {
    return NextResponse.json({ error: `Arquivo grande demais (máx. ${Math.round(DOC_MAX_BYTES / 1024 / 1024)} MB).` }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const tipoReal = tipoRealPorMagicBytes(bytes);
  if (!tipoReal || !DOC_MIME.includes(tipoReal as (typeof DOC_MIME)[number])) {
    return NextResponse.json({ error: "Tipo de arquivo inválido. Envie um PDF, JPG ou PNG de verdade." }, { status: 415 });
  }
  const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const ext = tipoReal === "application/pdf" ? "pdf" : tipoReal === "image/png" ? "png" : "jpg";
  const caminho = caminhoDocInquilino(user.id, leadId, crypto.randomUUID(), ext);
  const { error: eUp } = await admin.storage.from(BUCKET_DOCS_INQUILINO).upload(caminho, bytes, { contentType: tipoReal, upsert: false });
  if (eUp) return NextResponse.json({ error: "Não foi possível salvar o documento." }, { status: 500 });

  // Um por tipo: guarda o novo e apaga o arquivo anterior do mesmo tipo.
  const { data: anterior } = await admin.from("documentos_inquilino").select("caminho").eq("lead_id", leadId).eq("tipo", tipo).maybeSingle();
  const { error: eReg } = await admin
    .from("documentos_inquilino")
    .upsert({ lead_id: leadId, tenant_id: user.id, tipo, caminho, hash_sha256: hash, enviado_em: new Date().toISOString() }, { onConflict: "lead_id,tipo" });
  if (eReg) {
    await admin.storage.from(BUCKET_DOCS_INQUILINO).remove([caminho]);
    return NextResponse.json({ error: "Não foi possível registrar o documento agora." }, { status: 500 });
  }
  if (anterior?.caminho && anterior.caminho !== caminho) await admin.storage.from(BUCKET_DOCS_INQUILINO).remove([anterior.caminho as string]);

  return NextResponse.json({ ok: true, tipo });
}
