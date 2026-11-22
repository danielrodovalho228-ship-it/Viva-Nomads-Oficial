import { NextResponse } from "next/server";
import { respostaNaoAdmin } from "@/lib/admin/api-nao-admin";
import { depsMemoria } from "@/lib/agentes/servidor";
import { apagarMemoria, listarMemorias } from "@/lib/agentes/motor";

/** Central de Agentes — "O que <nome> sabe sobre você". Só admin (404 para os demais). */
export async function GET(request: Request) {
  const deps = await depsMemoria();
  if (!deps) return respostaNaoAdmin();
  const r = await listarMemorias(deps, new URL(request.url).searchParams.get("slug"));
  return NextResponse.json(r.body, { status: r.status });
}

export async function DELETE(request: Request) {
  const deps = await depsMemoria();
  if (!deps) return respostaNaoAdmin();
  const body = await request.json().catch(() => null);
  const r = await apagarMemoria(deps, body);
  return NextResponse.json(r.body, { status: r.status });
}
