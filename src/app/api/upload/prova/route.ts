import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, DIA } from "@/lib/limites";
import { PHOTO_MAX_BYTES, tipoRealFotoPorMagicBytes } from "@/lib/upload-limits";
import { hashPerceptual, reconverterFotoParaWebp } from "@/lib/foto-reconversao";
import { ERRO_FOTO_REPETIDA, ERRO_SEM_TOKEN, conferirCaptura } from "@/lib/niveis/prova-camera";
import { capturaPeloToken, fotoJaUsada } from "@/lib/niveis/prova-servidor";

const BUCKET = "property-photos";

/**
 * FOTO-NA-HORA-B — a foto da PROVA de um item de nível, tirada na hora pela câmera (CameraProva). Só entra com o token
 * de captura que o servidor emitiu ao abrir a câmera: do mesmo dono, dentro dos 10 minutos, ainda sem foto. Mesma
 * validação da foto do anúncio (magic bytes, re-codificada em WebP sem EXIF, pasta do dono); o hash perceptual é
 * comparado com a galeria deste anúncio (e do dono) e com toda outra prova: repetida é recusada. A foto fica presa ao
 * token (caminho, hash, hora); o item só conta quando salvarItemNivel consome o token.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return NextResponse.json({ error: "Envio indisponível no modo demonstração." }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para enviar fotos." }, { status: 401 });

  if (!(await consumirLimite(`prova-upload:${user.id}`, 120, DIA))) {
    return NextResponse.json({ error: "Muitos envios de foto hoje. Tente novamente amanhã." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const captura = await capturaPeloToken(admin, form?.get("token"));
  const ok = captura && conferirCaptura(captura, { ownerId: user.id, propertyId: captura.property_id, chave: captura.chave }, new Date());
  if (!captura || !ok || !ok.ok) return NextResponse.json({ error: ERRO_SEM_TOKEN, motivo: ok && !ok.ok ? ok.motivo : "sem_token" }, { status: 403 });

  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Foto ausente." }, { status: 400 });
  if (file.size > PHOTO_MAX_BYTES) {
    return NextResponse.json({ error: `Cada foto deve ter no máximo ${Math.round(PHOTO_MAX_BYTES / 1024 / 1024)} MB.` }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const webp = tipoRealFotoPorMagicBytes(bytes) ? await reconverterFotoParaWebp(bytes) : null;
  if (!webp) return NextResponse.json({ error: "A foto não abriu. Fotografe de novo." }, { status: 415 });

  const hash = await hashPerceptual(webp);
  if (await fotoJaUsada(admin, hash, { propertyId: captura.property_id, ownerId: user.id, capturaId: captura.id })) {
    return NextResponse.json({ error: ERRO_FOTO_REPETIDA }, { status: 409 });
  }

  const path = `${user.id}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, webp, { contentType: "image/webp", upsert: false });
  if (error) return NextResponse.json({ error: "Não foi possível salvar a foto. Tente de novo." }, { status: 500 });

  // Uma foto por token: grava só se o token ainda não tem foto (dois envios ao mesmo tempo → o segundo é recusado).
  const { data: presa } = await admin
    .from("prova_capturas")
    .update({ foto_path: path, foto_hash: hash, capturada_em: new Date().toISOString() })
    .eq("id", captura.id)
    .is("foto_path", null)
    .is("usado_em", null)
    .select("id");
  if (!presa?.length) {
    await admin.storage.from(BUCKET).remove([path]).then(() => undefined, () => undefined);
    return NextResponse.json({ error: ERRO_SEM_TOKEN, motivo: "usado" }, { status: 403 });
  }
  // O hash segue a regra de fotos_anuncio_hash (antifraude; sobrevive à remoção do anúncio).
  if (hash) await admin.from("fotos_anuncio_hash").insert({ owner_id: user.id, property_id: captura.property_id, caminho: path, hash }).then(() => undefined, () => undefined);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ path, url: data.publicUrl });
}
