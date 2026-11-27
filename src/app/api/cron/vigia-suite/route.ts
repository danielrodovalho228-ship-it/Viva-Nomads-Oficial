import { NextResponse } from "next/server";
import { rodarVigia } from "@/lib/laboratorio/vigia-suite";

/**
 * ORDEM-DUET-273 — a vigia da suíte do laboratório. Exige `Authorization: Bearer <CRON_SECRET>`.
 * Corre 15 min depois de cada slot do laboratorio.yml (vercel.json: "32 7,15,23 * * *"). Se a corrida do slot não
 * arrancou na main, despacha o workflow com o token GITHUB_WATCHDOG_TOKEN (fine-grained, só este repo, Actions
 * leitura+escrita). `?verificar=1` só lê as corridas (a prova da leitura autenticada), sem despachar.
 * O token nunca vai para a resposta nem para o log.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const chave = process.env.GITHUB_WATCHDOG_TOKEN?.trim();
  if (!chave) {
    console.error("vigia-suite: GITHUB_WATCHDOG_TOKEN não configurado");
    return NextResponse.json({ error: "GITHUB_WATCHDOG_TOKEN não configurado." }, { status: 503 });
  }
  const verificar = new URL(request.url).searchParams.get("verificar") === "1";
  try {
    const resultado = await rodarVigia({ token: chave, agora: new Date(), verificar });
    console.log(`vigia-suite: ${JSON.stringify({ verificar, ...resultado })}`);
    return NextResponse.json({ ok: true, verificar, ...resultado });
  } catch (e) {
    const motivo = e instanceof Error ? e.message : "erro";
    console.error(`vigia-suite: ${motivo}`);
    return NextResponse.json({ error: motivo }, { status: 502 });
  }
}
