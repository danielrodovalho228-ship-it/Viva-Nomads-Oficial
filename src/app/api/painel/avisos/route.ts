import { NextResponse } from "next/server";
import { marcarAvisoLido, marcarTodosAvisosLidos } from "@/lib/data/avisos-actions";
import { avisosParaAsTelas } from "@/lib/data/avisos-telas";
import { ordenarParaOSino } from "@/lib/notifications/sino";

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
    // E1242 reaberto (ORDEM-DUET 1247): a mesma leitura e a mesma regra da página completa (avisos-telas.ts).
    const t = await avisosParaAsTelas(60);
    if (!t) return NextResponse.json(VAZIO, { headers: SEM_CACHE });
    return NextResponse.json({ naoLidas: t.naoLidas, maiorPrioridade: t.maiorPrioridade, recentes: ordenarParaOSino(t.avisos), criticos: t.criticos }, { headers: SEM_CACHE });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar os avisos agora." }, { status: 503, headers: SEM_CACHE });
  }
}

/** Clique no aviso: marca como lido; E533: `{ todos: true }` marca todos (só a coluna lido_em, só os próprios — RLS). */
export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => null)) as { id?: unknown; todos?: unknown } | null;
  const id = typeof corpo?.id === "string" ? corpo.id : "";
  const r = corpo?.todos === true ? await marcarTodosAvisosLidos().catch(() => ({ ok: false })) : await marcarAvisoLido(id).catch(() => ({ ok: false }));
  return NextResponse.json(r, { status: r.ok ? 200 : 400, headers: SEM_CACHE });
}
