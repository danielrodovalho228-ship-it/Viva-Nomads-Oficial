import { assetlinks } from "../../../../config/rotas-app.ts";

/**
 * /.well-known/assetlinks.json (rewrite em next.config.ts). App Links do Android.
 * APP_ANDROID_SHA256 = impressões SHA-256 do certificado (vírgula para várias:
 * a chave de assinatura do Play e, se quiser testar builds locais, a de upload).
 * APP_ANDROID_PACKAGE (padrão br.com.vivanomads.app). Sem impressão, 404.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const impressoes = (process.env.APP_ANDROID_SHA256 ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s));
  if (impressoes.length === 0) return new Response("Not found", { status: 404 });
  const pacote = process.env.APP_ANDROID_PACKAGE?.trim() || "br.com.vivanomads.app";
  return Response.json(assetlinks(pacote, impressoes), { headers: { "Cache-Control": "public, max-age=3600" } });
}
