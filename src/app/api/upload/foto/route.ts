import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumirLimite, DIA } from "@/lib/limites";
import { PHOTO_MAX_BYTES, tipoRealFotoPorMagicBytes } from "@/lib/upload-limits";

const BUCKET = "property-photos";
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

/**
 * Upload da FOTO do anúncio com validação NO SERVIDOR (QA teste 4, F46–F48):
 * exige dono logado, confere o tipo REAL por magic bytes (só JPEG/PNG/WebP —
 * nunca SVG, executável ou texto renomeado) e grava na pasta do próprio dono
 * com o Content-Type real e extensão derivada dele (a do arquivo é ignorada).
 * Sobe como o próprio usuário, então a RLS do bucket (insert só na pasta do
 * uid) continua valendo. Devolve só path e URL pública.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  // Demo/preview (sem Supabase): não há backend — o cliente nem chama a rota.
  if (!supabase) return NextResponse.json({ error: "Envio indisponível no modo demonstração." }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para enviar fotos." }, { status: 401 });

  if (!(await consumirLimite(`foto-upload:${user.id}`, 300, DIA))) {
    return NextResponse.json({ error: "Muitos envios de foto hoje. Tente novamente amanhã." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
  if (file.size > PHOTO_MAX_BYTES) {
    return NextResponse.json(
      { error: `Cada foto deve ter no máximo ${Math.round(PHOTO_MAX_BYTES / 1024 / 1024)} MB.` },
      { status: 400 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const tipo = tipoRealFotoPorMagicBytes(bytes);
  if (!tipo) {
    return NextResponse.json({ error: "Arquivo recusado: envie uma foto JPG, PNG ou WebP de verdade." }, { status: 415 });
  }

  const path = `${user.id}/${crypto.randomUUID()}.${EXT[tipo]}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: tipo, upsert: false });
  if (error) return NextResponse.json({ error: "Não foi possível salvar a foto. Tente de novo." }, { status: 500 });

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ path, url: data.publicUrl });
}
