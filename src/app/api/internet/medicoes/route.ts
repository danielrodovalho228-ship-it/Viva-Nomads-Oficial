import { NextResponse } from "next/server";
import { estadoParaMedir, registrarMedicao, type Origem } from "@/lib/internet-medida-servidor";

/**
 * Internet medida no imóvel (Prompt 57). Rota em vez de ação do servidor (a fila do roteador da página já travou
 * botões no lab, t250/t264). Só o próprio site (Origin igual no POST).
 *
 * GET  /api/internet/medicoes?imovel=<id>&origem=<cadastro|edicao|conferencia_entrada> — o que o botão precisa saber.
 * POST /api/internet/medicoes { imovel, origem, rodadas: [{downloadMbps, uploadMbps, latenciaMs}×2], local: {lat,lng}|null,
 *      confirmouWifi } — o servidor confere sessão, papel, limite e distância e grava (só a distância, nunca a posição).
 */
const ORIGENS = ["cadastro", "edicao", "conferencia_entrada"];
const SEM_CACHE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const u = new URL(request.url);
  const origem = u.searchParams.get("origem") ?? "";
  if (!ORIGENS.includes(origem)) return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400, headers: SEM_CACHE });
  const r = await estadoParaMedir(u.searchParams.get("imovel") ?? "", origem as Origem);
  return NextResponse.json(r, { status: r.ok ? 200 : 403, headers: SEM_CACHE });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 403 });
  const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corpo) return NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400, headers: SEM_CACHE });
  const r = await registrarMedicao({ imovelId: corpo.imovel, origem: corpo.origem, rodadas: corpo.rodadas, local: corpo.local, confirmouWifi: corpo.confirmouWifi, ponto: corpo.ponto });
  return NextResponse.json(r, { status: r.ok ? 200 : 400, headers: SEM_CACHE });
}
