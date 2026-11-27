import { NextResponse } from "next/server";
import { getBlocks, linkExportacaoCalendario } from "@/lib/data/blocks-actions";
import { getEstadiasDoImovel } from "@/lib/data/estadias-calendario";

/**
 * E611: as LEITURAS do calendário do dono (bloqueios, estadias e o link de exportação .ics) por GET, fora da fila das
 * Server Actions. O Next despacha as Server Actions uma por vez por aba: no cadastro, o "Carregando o link…" e o
 * calendário em "Carregando" esperavam o autosave e as outras ações da tela terminarem. Quem autoriza é o mesmo de
 * antes — as funções abaixo leem com a sessão do dono (RLS) e conferem o dono do imóvel.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parte = new URL(req.url).searchParams.get("parte");
  const semCache = { headers: { "cache-control": "no-store" } };
  try {
    if (parte === "blocos") return NextResponse.json({ ok: true, valor: await getBlocks(id) }, semCache);
    if (parte === "estadias") return NextResponse.json({ ok: true, valor: await getEstadiasDoImovel(id, { exigir: true }) }, semCache);
    if (parte === "exportacao") return NextResponse.json({ ok: true, valor: await linkExportacaoCalendario(id) }, semCache);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Não foi possível ler o calendário." }, { status: 500, ...semCache });
  }
  return NextResponse.json({ ok: false, error: "Parte do calendário desconhecida." }, { status: 400, ...semCache });
}
