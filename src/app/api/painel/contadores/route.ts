import { NextResponse } from "next/server";
import { contadoresDoPainel } from "@/lib/painel/contadores-servidor";

export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "no-store" };

/**
 * Números do menu do painel (Prompt 42, item 5): UM GET no lugar das ~8 server actions que a casca chamava a cada troca
 * de rota. As contagens moram em contadoresDoPainel (a mesma função dá o valor inicial no layout — PROP-0). Sem sessão:
 * 401. Nunca em cache.
 */
export async function GET() {
  const c = await contadoresDoPainel();
  if (c === "sem-sessao") return NextResponse.json({ error: "Não autenticado." }, { status: 401, headers: SEM_CACHE });
  return NextResponse.json(c, { headers: SEM_CACHE });
}
