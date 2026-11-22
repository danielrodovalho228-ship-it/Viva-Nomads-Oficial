import { NextResponse } from "next/server";
import { respostaNaoAdmin } from "@/lib/admin/api-nao-admin";
import { depsReais } from "@/lib/agentes/servidor";
import { responderReuniao } from "@/lib/agentes/motor";

/** Central de Agentes — "Sala de reunião". Só admin (404 para os demais); conta no limite diário. */
export const maxDuration = 90;

export async function POST(request: Request) {
  const deps = await depsReais();
  if (!deps) return respostaNaoAdmin();
  const body = await request.json().catch(() => null);
  const r = await responderReuniao(deps, body);
  return NextResponse.json(r.body, { status: r.status });
}
