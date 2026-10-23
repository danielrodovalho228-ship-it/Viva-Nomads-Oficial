import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, DIA } from "@/lib/limites";
import { DOC_MAX_BYTES, DOC_MIN_BYTES, DOC_MIME, tipoRealPorMagicBytes } from "@/lib/upload-limits";
import { BUCKET_TRIAGEM, caminhoVinculo, ehTipoVinculo, estadoVinculo, podeEnviar, type LinhaVinculo } from "@/lib/triagem/vinculo";
import { triagemVinculoAtiva } from "@/lib/triagem/chave";

/**
 * Prompt 52 — o comprovante de VÍNCULO do morador (carta da residência/programa, carta do empregador ou contracheque).
 * Só com a chave TRIAGEM_VINCULO_ATIVA; só no degrau da transação (candidatura aceita, antes do contrato). Tipo real por
 * magic bytes, tamanho mín/máx, hash. Grava pelo SERVIDOR no bucket privado triagem-vinculos; um pendente por pessoa (o
 * novo substitui o pendente). Recusado: nova tentativa na hora. Nada do documento vai para log.
 */
export async function POST(request: Request) {
  if (!(await triagemVinculoAtiva())) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return NextResponse.json({ error: "Indisponível no momento." }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const tipo = form?.get("tipo");
  const file = form?.get("file");
  if (!ehTipoVinculo(tipo)) return NextResponse.json({ error: "Escolha o tipo do comprovante." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });

  // Degrau da transação: pelo menos uma candidatura ACEITA deste morador.
  const { data: aceitas } = await admin.from("leads").select("id").eq("tenant_id", user.id).eq("status", "accepted").limit(1);
  if (!aceitas?.length) return NextResponse.json({ error: "O comprovante é pedido depois que um proprietário aceita a sua candidatura." }, { status: 409 });

  const { data: ultima } = await admin.from("triagem_vinculos").select("id, tipo, status, motivo, decidido_em, valido_ate, enviado_em, path").eq("user_id", user.id).order("enviado_em", { ascending: false }).limit(1).maybeSingle();
  if (!podeEnviar(estadoVinculo((ultima as LinhaVinculo | null) ?? null, new Date()))) {
    return NextResponse.json({ error: "Seu vínculo já está confirmado." }, { status: 409 });
  }
  if (!(await consumirLimite(`triagem-vinculo:${user.id}`, 10, DIA))) {
    return NextResponse.json({ error: "Muitos envios hoje. Tente novamente amanhã." }, { status: 429 });
  }
  if (file.size < DOC_MIN_BYTES) {
    return NextResponse.json({ error: `Arquivo pequeno demais (mín. ${Math.round(DOC_MIN_BYTES / 1024)} KB) — parece não ser um documento válido.` }, { status: 400 });
  }
  if (file.size > DOC_MAX_BYTES) return NextResponse.json({ error: `Arquivo grande demais (máx. ${Math.round(DOC_MAX_BYTES / 1024 / 1024)} MB).` }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const tipoReal = tipoRealPorMagicBytes(bytes);
  if (!tipoReal || !DOC_MIME.includes(tipoReal as (typeof DOC_MIME)[number])) {
    return NextResponse.json({ error: "Tipo de arquivo inválido. Envie um PDF, JPG ou PNG de verdade." }, { status: 415 });
  }
  const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const ext = tipoReal === "application/pdf" ? "pdf" : tipoReal === "image/png" ? "png" : "jpg";
  const caminho = caminhoVinculo(user.id, crypto.randomUUID(), ext);
  const { error: eUp } = await admin.storage.from(BUCKET_TRIAGEM).upload(caminho, bytes, { contentType: tipoReal, upsert: false });
  if (eUp) return NextResponse.json({ error: "Não foi possível salvar o documento." }, { status: 500 });

  // Um pendente por pessoa: o novo substitui o pendente (linha e arquivo).
  const anterior = ultima?.status === "pendente" ? (ultima as { id: string; path: string }) : null;
  if (anterior) await admin.from("triagem_vinculos").delete().eq("id", anterior.id).eq("status", "pendente");
  const { error: eReg } = await admin.from("triagem_vinculos").insert({ user_id: user.id, tipo, path: caminho, hash_sha256: hash });
  if (eReg) {
    await admin.storage.from(BUCKET_TRIAGEM).remove([caminho]);
    return NextResponse.json({ error: "Não foi possível registrar o documento agora." }, { status: 500 });
  }
  if (anterior?.path) await admin.storage.from(BUCKET_TRIAGEM).remove([anterior.path]);
  return NextResponse.json({ ok: true });
}
