import sharp from "sharp";
import { CAMINHO_FOTO_EMAIL_RE, FOTO_CARTAO } from "@/lib/notifications/cartoes-email";

/**
 * E264-B — a foto de capa do cartão do e-mail, SEMPRE em JPEG (640 px), inline e igual para todo cliente.
 * O otimizador do site (/_next/image) negocia o formato (`Vary: Accept`: AVIF/WebP), entrega como anexo e com CSP
 * `sandbox`; leitores de e-mail que não mostram AVIF/WebP ficavam sem a foto. Aqui: só capas do bucket público
 * property-photos (`<uuid>/<uuid>.<ext>`), nada de URL livre. A capa já é pública; a rota só muda o formato.
 */
export const runtime = "nodejs";

const MAX_BYTES = 8_000_000;

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams.get("p") ?? "";
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!CAMINHO_FOTO_EMAIL_RE.test(p) || !base) return new Response("Não encontrado.", { status: 404 });

  const origem = await fetch(`${base}/storage/v1/object/public/property-photos/${p}`, { cache: "no-store" }).catch(() => null);
  if (!origem?.ok) return new Response("Não encontrado.", { status: 404 });
  const bytes = new Uint8Array(await origem.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BYTES) return new Response("Não encontrado.", { status: 404 });

  const jpeg = await sharp(bytes, { limitInputPixels: 100_000_000 })
    .rotate()
    .resize({ width: FOTO_CARTAO.largura, withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: FOTO_CARTAO.qualidade, mozjpeg: true })
    .toBuffer()
    .catch(() => null);
  if (!jpeg) return new Response("Não encontrado.", { status: 404 });

  return new Response(new Uint8Array(jpeg), {
    headers: {
      "content-type": "image/jpeg",
      "content-disposition": "inline",
      // A capa de um caminho não muda (o nome é um uuid novo a cada envio): cache longo no navegador e na CDN.
      "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
