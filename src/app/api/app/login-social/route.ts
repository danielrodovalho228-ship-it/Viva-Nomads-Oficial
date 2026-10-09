import { NextResponse } from "next/server";
import { consumirLimite, ipHash } from "@/lib/limites";
import { emitirStateLogin, provedorValido, segredoLoginApp } from "@/lib/app/login-social";

/**
 * Emite o `state` do login social no app (ordem 1f65c73d). Rota pública que só devolve um texto
 * assinado (5 min, uso único); limite por IP para não ser usada em volume.
 */
export async function POST(request: Request) {
  let corpo: unknown = null;
  try {
    corpo = await request.json();
  } catch {
    /* corpo inválido cai no 400 abaixo */
  }
  const provedor = provedorValido((corpo as { provedor?: unknown } | null)?.provedor);
  if (!provedor) return NextResponse.json({ erro: "Provedor inválido." }, { status: 400 });

  if (!(await consumirLimite(`login-social-state:${ipHash(request)}`, 20, 600))) {
    return NextResponse.json({ erro: "Muitas tentativas. Tente de novo em instantes." }, { status: 429 });
  }
  const emitido = emitirStateLogin(provedor, new Date(), segredoLoginApp());
  if (!emitido) return NextResponse.json({ erro: "Indisponível no momento." }, { status: 503 });
  return NextResponse.json({ state: emitido.state }, { headers: { "Cache-Control": "no-store" } });
}
