import { NextResponse } from "next/server";
import { depsDecidirReais } from "@/lib/agentes/aprovacoes-servidor";
import { decidirAprovacao } from "@/lib/agentes/decidir-aprovacao";
import { consumirLimite, HORA } from "@/lib/limites";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Aprovar/recusar um pedido da Central (cartão do chat). Só admin; quem decide é o servidor, nunca o texto do chat. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 });
  const deps = await depsDecidirReais();
  if (!deps.admin) return NextResponse.json({ ok: false, erro: "Só admin." }, { status: 403 });
  if (!(await consumirLimite(`aprovacao:${deps.admin.id}`, 60, HORA))) return NextResponse.json({ ok: false, erro: "Muitas tentativas. Tente mais tarde." }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { acao?: unknown; confirmar?: unknown } | null;
  const r = await decidirAprovacao(deps, id, { acao: body?.acao, confirmar: body?.confirmar });
  return NextResponse.json(r.corpo, { status: r.http });
}
