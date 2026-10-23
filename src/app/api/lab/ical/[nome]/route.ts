import path from "node:path";
import { readFile } from "node:fs/promises";
import { integracoesSimuladas } from "@/lib/integracoes";

/**
 * SÓ LABORATÓRIO (Prompt 53): o "Airbnb falso". Serve o .ics que o teste escreveu em <pasta do LAB_OUTBOX>/ical/<nome>.
 * Arquivo ausente → 404 (simula o link que deixou de responder). Fora do laboratório, 404 sempre.
 */
export async function GET(_: Request, { params }: { params: Promise<{ nome: string }> }) {
  const caixa = process.env.LAB_OUTBOX;
  if (!integracoesSimuladas() || !caixa) return new Response("Não encontrado.", { status: 404 });
  const { nome } = await params;
  if (!/^[\w.-]{1,80}\.ics$/.test(nome)) return new Response("Não encontrado.", { status: 404 });
  try {
    const texto = await readFile(path.join(path.dirname(caixa), "ical", nome), "utf8");
    return new Response(texto, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } });
  } catch {
    return new Response("Não encontrado.", { status: 404 });
  }
}
