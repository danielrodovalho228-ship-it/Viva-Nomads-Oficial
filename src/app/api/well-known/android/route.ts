import { assetlinks, impressoesAndroid } from "../../../../config/rotas-app.ts";

/**
 * /.well-known/assetlinks.json (rewrite em next.config.ts). App Links do Android.
 * Impressões SHA-256: as de APP_ANDROID_SHA256 (vírgula para várias; hoje a chave de upload do EAS) e, sempre,
 * a do Play App Signing (IMPRESSAO_PLAY_APP_SIGNING). APP_ANDROID_PACKAGE (padrão br.com.vivanomads.app).
 */
export const dynamic = "force-dynamic";

export function GET() {
  const pacote = process.env.APP_ANDROID_PACKAGE?.trim() || "br.com.vivanomads.app";
  return Response.json(assetlinks(pacote, impressoesAndroid(process.env.APP_ANDROID_SHA256)), { headers: { "Cache-Control": "public, max-age=3600" } });
}
