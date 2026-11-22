import { NextResponse } from "next/server";
import { respostaNaoAdmin } from "@/lib/admin/api-nao-admin";
import { depsReais } from "@/lib/agentes/servidor";
import { responderChat } from "@/lib/agentes/motor";

/** Central de Agentes — "Perguntar". Só admin (404 para os demais); 60 perguntas/dia. */
export const maxDuration = 90;

export async function POST(request: Request) {
  const deps = await depsReais();
  if (!deps) return respostaNaoAdmin();
  const body = await request.json().catch(() => null);
  const r = await responderChat(deps, body);
  return NextResponse.json(r.body, { status: r.status });
}
