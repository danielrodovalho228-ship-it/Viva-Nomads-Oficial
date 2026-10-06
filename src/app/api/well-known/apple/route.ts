import { aasa } from "../../../../config/rotas-app.ts";

/**
 * /.well-known/apple-app-site-association (rewrite em next.config.ts).
 * Universal Links do iPhone. APP_IOS_IDS = "TEAMID.bundle.id" (vírgula para vários).
 * Sem a variável, 404 — a Apple não guarda um arquivo vazio.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const ids = (process.env.APP_IOS_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[A-Z0-9]{10}\.[\w.-]+$/.test(s));
  if (ids.length === 0) return new Response("Not found", { status: 404 });
  return Response.json(aasa(ids), { headers: { "Cache-Control": "public, max-age=3600" } });
}
