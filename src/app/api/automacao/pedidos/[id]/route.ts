import { NextResponse } from "next/server";
import { confirmarPedidoAutomatico, trocarParceiro } from "@/lib/automacao/acoes";

/**
 * POST /api/automacao/pedidos/<id>  { acao: "confirmar" | "trocar" } — o 1 toque do dono no cartão "Depois da saída"
 * (Prompt 38). Rota em vez de ação do servidor: o laboratório mostrou o toque preso em "Confirmando…" quando a ação ia
 * pela fila do roteador da página. As mesmas funções conferem a sessão e a parte. Só o próprio site (Origin igual).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 403 });
  const { id } = await params;
  const corpo = (await request.json().catch(() => null)) as { acao?: unknown } | null;
  const r =
    corpo?.acao === "confirmar" ? await confirmarPedidoAutomatico(id) : corpo?.acao === "trocar" ? await trocarParceiro(id) : { ok: false as const, erro: "Ação inválida." };
  return NextResponse.json(r, { status: r.ok ? 200 : 400, headers: { "Cache-Control": "no-store" } });
}
