import { NextResponse } from "next/server";
import { marcarAvisoLido, meusAvisos, resumoDoSino } from "@/lib/data/avisos-actions";
import { criticosPendentes, ordenarParaOSino } from "@/lib/notifications/sino";

export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "no-store" };
const VAZIO = { naoLidas: 0, maiorPrioridade: null, recentes: [], criticos: [] };

/**
 * E444 itens 3 e 4 — o sino e a faixa de crítico leem daqui (UM GET, como os contadores do menu). Tudo com o cliente da
 * pessoa: a RLS (0286, Pista B) só deixa ler e marcar os próprios avisos. Sem sessão ou sem banco (demonstração): vazio.
 * Falha de leitura: 503 (a tela não mostra "0 avisos" quando não conseguiu ler).
 */
export async function GET() {
  try {
    // O resumo conta todas as não lidas (não só as 60 mais recentes da lista).
    const [avisos, resumo] = await Promise.all([meusAvisos(60), resumoDoSino()]);
    if (!avisos || !resumo) return NextResponse.json(VAZIO, { headers: SEM_CACHE });
    const { naoLidas, maiorPrioridade } = resumo;
    return NextResponse.json(
      { naoLidas, maiorPrioridade, recentes: ordenarParaOSino(avisos), criticos: criticosPendentes(avisos).slice(0, 5) },
      { headers: SEM_CACHE }
    );
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar os avisos agora." }, { status: 503, headers: SEM_CACHE });
  }
}

/** Clique no aviso: marca como lido (só a coluna lido_em, só os próprios — RLS). */
export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof corpo?.id === "string" ? corpo.id : "";
  const r = await marcarAvisoLido(id).catch(() => ({ ok: false }));
  return NextResponse.json(r, { status: r.ok ? 200 : 400, headers: SEM_CACHE });
}
