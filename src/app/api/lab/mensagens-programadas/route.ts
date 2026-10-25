import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { integracoesSimuladas } from "@/lib/integracoes";
import { enviarProgramadas } from "@/lib/respostas/servidor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * SÓ LABORATÓRIO (Prompt 55-E2): roda o passo do cron das mensagens programadas para UMA estadia, com a data simulada
 * (`?contrato=<id>&agora=<ISO>`). Fora do laboratório, 404 sempre (a produção usa /api/cron/mensagens-programadas).
 */
export async function GET(request: Request) {
  if (!integracoesSimuladas() || !process.env.LAB_OUTBOX) return new Response("Não encontrado.", { status: 404 });
  const url = new URL(request.url);
  const contrato = url.searchParams.get("contrato") ?? "";
  const agora = new Date(url.searchParams.get("agora") ?? "");
  if (!UUID.test(contrato) || !Number.isFinite(agora.getTime())) return NextResponse.json({ error: "contrato e agora obrigatórios." }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  return NextResponse.json({ ok: true, agora: agora.toISOString(), ...(await enviarProgramadas(admin, agora, contrato)) });
}
