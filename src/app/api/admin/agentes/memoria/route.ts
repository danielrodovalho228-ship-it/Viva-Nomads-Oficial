import { NextResponse } from "next/server";
import { depsMemoria } from "@/lib/agentes/servidor";
import { apagarMemoria, listarMemorias } from "@/lib/agentes/motor";

/** Central de Agentes — "O que <nome> sabe sobre você". Só admin (403). */
export async function GET(request: Request) {
  const deps = await depsMemoria();
  if (!deps) return NextResponse.json({ erro: "Só admin." }, { status: 403 });
  const r = await listarMemorias(deps, new URL(request.url).searchParams.get("slug"));
  return NextResponse.json(r.body, { status: r.status });
}

export async function DELETE(request: Request) {
  const deps = await depsMemoria();
  if (!deps) return NextResponse.json({ erro: "Só admin." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const r = await apagarMemoria(deps, body);
  return NextResponse.json(r.body, { status: r.status });
}
