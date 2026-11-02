import sharp from "sharp";
import { createAdminClient, AVATARS_BUCKET } from "@/lib/supabase/admin";
import { getAvatarPath, relacaoAceitaEntreServidor } from "@/lib/data/avatar-url";
import { assinaturaAvatarValida } from "@/lib/notifications/morador-email-servidor";

/**
 * E441 — a foto do morador no e-mail ao dono, em JPEG (96 px), inline. O bucket de fotos é PRIVADO: esta rota só
 * entrega com a assinatura do par (dono, morador) E com a relação aceita entre eles conferida AGORA (a mesma regra do
 * calendário e de podeVerAvatar). Qualquer outra coisa: 404.
 */
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nada = () => new Response("Não encontrado.", { status: 404 });

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const d = q.get("d") ?? "";
  const m = q.get("m") ?? "";
  if (!UUID.test(d) || !UUID.test(m) || d === m || !assinaturaAvatarValida(d, m, q.get("s") ?? "")) return nada();
  if (!(await relacaoAceitaEntreServidor(d, m).catch(() => false))) return nada();
  const caminho = await getAvatarPath(m).catch(() => null);
  const admin = createAdminClient();
  if (!caminho || !admin) return nada();
  const { data: arquivo } = await admin.storage.from(AVATARS_BUCKET).download(caminho);
  if (!arquivo) return nada();
  const jpeg = await sharp(new Uint8Array(await arquivo.arrayBuffer()), { limitInputPixels: 50_000_000 })
    .rotate()
    .resize({ width: 96, height: 96, fit: "cover" })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer()
    .catch(() => null);
  if (!jpeg) return nada();
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "content-type": "image/jpeg",
      "content-disposition": "inline",
      // A relação pode mudar: cache curto e privado.
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
