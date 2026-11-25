import { NextResponse } from "next/server";
import { depsReais, depsExecutarReais } from "@/lib/agentes/servidor";
import { responderChat } from "@/lib/agentes/motor";

/** Central de Agentes — "Perguntar". Só admin (403); 60 perguntas/dia. */
export const maxDuration = 90;

export async function POST(request: Request) {
  const deps = await depsReais();
  if (!deps) return NextResponse.json({ erro: "Só admin." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const r = await responderChat(deps, body);
  // ENSAIO E1193 (mordida da cura do t29): o defeito simulado — a aprovação por texto vira ordem.
  if ((r.body as { aprovacao?: boolean }).aprovacao === false) {
    const ex = await depsExecutarReais();
    const b = body as { slug?: string; texto?: string };
    if (ex && b?.slug && b?.texto) await ex.criarOrdem(b.slug, b.texto);
  }
  return NextResponse.json(r.body, { status: r.status });
}
