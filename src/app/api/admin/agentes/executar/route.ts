import { NextResponse } from "next/server";
import { respostaNaoAdmin } from "@/lib/admin/api-nao-admin";
import { depsExecutarReais } from "@/lib/agentes/servidor";
import { executarAgora } from "@/lib/agentes/motor";

/** Central de Agentes — "Executar agora": grava a ordem e dispara a rotina real. Só admin; 20 por 24 h. */
export async function POST(request: Request) {
  const deps = await depsExecutarReais();
  if (!deps) return respostaNaoAdmin();
  const body = await request.json().catch(() => null);
  const r = await executarAgora(deps, body);
  return NextResponse.json(r.body, { status: r.status });
}
