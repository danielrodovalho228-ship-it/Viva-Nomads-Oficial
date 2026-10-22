import { NextResponse } from "next/server";
import {
  aceitarOrcamento,
  avaliarPedido,
  cancelarPedido,
  concluirPedido,
  confirmarHorario,
  enviarOrcamento,
  iniciarExecucao,
  marcarEntregue,
  proporOutroHorario,
  recusarOrcamento,
  recusarPedido,
  simularPagamento,
  usarFotosNoAnuncio,
} from "@/lib/parceiros/pedido-actions";
import { confirmarPedidoAutomatico, trocarParceiro } from "@/lib/automacao/acoes";

type Res = { ok: true } | { ok: false; erro: string };
const texto = (x: unknown) => (typeof x === "string" ? x : "");

/** Os botões da tela do pedido (31b/38). Cada função confere a sessão, a parte e o estado do pedido. */
const ACOES: Record<string, (id: string, a: Record<string, unknown>) => Promise<Res | { ok: true; valor: unknown }>> = {
  "enviar-orcamento": (id, a) => enviarOrcamento(id, a.valor),
  "recusar-pedido": (id, a) => recusarPedido(id, texto(a.motivo)),
  "aceitar-orcamento": (id) => aceitarOrcamento(id),
  "recusar-orcamento": (id) => recusarOrcamento(id),
  cancelar: (id) => cancelarPedido(id),
  "confirmar-horario": (id, a) => confirmarHorario(id, texto(a.horario)),
  "propor-horario": (id, a) => proporOutroHorario(id, texto(a.horario)),
  "simular-pagamento": (id) => simularPagamento(id),
  iniciar: (id) => iniciarExecucao(id),
  "marcar-entregue": (id) => marcarEntregue(id),
  concluir: (id) => concluirPedido(id),
  "usar-fotos": (id) => usarFotosNoAnuncio(id),
  avaliar: (id, a) => avaliarPedido(id, Number(a.nota), texto(a.texto)),
  "confirmar-automatico": (id) => confirmarPedidoAutomatico(id),
  "trocar-parceiro": (id) => trocarParceiro(id),
};

/**
 * POST /api/parceiros/pedidos/<id>  { acao, ...campos } — os botões da tela do pedido. Rota em vez de ação do servidor:
 * o laboratório mostrou "Enviar orçamento" sem nenhum POST quando a fila do roteador da página ficava presa (t250, 22/10).
 * Só o próprio site (Origin igual).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 403 });
  const { id } = await params;
  const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const f = corpo && typeof corpo.acao === "string" && Object.hasOwn(ACOES, corpo.acao) ? ACOES[corpo.acao] : null;
  const r = f ? await f(id, corpo!) : { ok: false as const, erro: "Ação inválida." };
  return NextResponse.json(r, { status: r.ok ? 200 : 400, headers: { "Cache-Control": "no-store" } });
}
