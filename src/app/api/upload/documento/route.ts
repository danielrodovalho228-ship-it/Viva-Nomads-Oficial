import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DOC_MAX_BYTES,
  DOC_MIN_BYTES,
  DOC_MIME,
  tipoRealPorMagicBytes,
} from "@/lib/upload-limits";

const BUCKET = "property-docs";

/**
 * Upload do DOCUMENTO do imóvel (matrícula / contrato de gestão) com validação
 * NO SERVIDOR (item 6 do QA do editor): tipo REAL por magic bytes (não a
 * extensão nem o Content-Type declarados), tamanho mín/máx. Fecha o furo do
 * "PDF de 2 KB aceito". Sobe ao bucket PRIVADO como o próprio usuário (RLS por
 * dono, migration 0032). Devolve só o `path`.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  // Demo/preview (sem Supabase): não há backend — devolve sem persistir.
  if (!supabase) return NextResponse.json({ path: null, demo: true });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
  }

  // Tamanho (mín/máx) no servidor.
  if (file.size < DOC_MIN_BYTES) {
    return NextResponse.json(
      { error: `Arquivo pequeno demais (mín. ${Math.round(DOC_MIN_BYTES / 1024)} KB) — parece não ser um documento válido.` },
      { status: 400 }
    );
  }
  if (file.size > DOC_MAX_BYTES) {
    return NextResponse.json(
      { error: `Arquivo grande demais (máx. ${Math.round(DOC_MAX_BYTES / 1024 / 1024)} MB).` },
      { status: 400 }
    );
  }

  // Tipo REAL por magic bytes — não confia na extensão/Content-Type.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const tipoReal = tipoRealPorMagicBytes(bytes);
  if (!tipoReal || !DOC_MIME.includes(tipoReal as (typeof DOC_MIME)[number])) {
    return NextResponse.json(
      { error: "Tipo de arquivo inválido. Envie um PDF, JPG ou PNG de verdade." },
      { status: 415 }
    );
  }

  // Impressão digital do arquivo (SHA-256) — detecta REUSO da mesma matrícula
  // entre contas na conferência (anti-fraude, 0044). Só o hash é persistido, não
  // o conteúdo. Nada do documento vai para log.
  const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const ext = tipoReal === "application/pdf" ? "pdf" : tipoReal === "image/png" ? "png" : "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: tipoReal, upsert: false });
  if (error) {
    return NextResponse.json({ error: "Não foi possível salvar o documento." }, { status: 500 });
  }

  return NextResponse.json({ path, hash });
}
