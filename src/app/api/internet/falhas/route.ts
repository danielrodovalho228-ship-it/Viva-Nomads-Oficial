import { NextResponse } from "next/server";

/**
 * E414: por que a medição de internet falhou no navegador de alguém. A prova ao vivo reprovou três vezes sem que ninguém
 * soubesse a causa; este registro (linha no log do servidor) dá a evidência da próxima. Só o próprio site (Origin igual),
 * só valores de uma lista fechada e números; nenhum dado pessoal (sem IP, sem sessão, sem posição, sem texto livre).
 */
const MOTIVOS = ["demorou", "incompleto", "cancelado", "rede", "travou", "limite", "servidor", "conexao"];
const FASES = ["latencia", "download", "envio", "geral", "desconhecida"];
const SEM_CACHE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ ok: false }, { status: 403 });
  const c = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const motivo = typeof c?.motivo === "string" && MOTIVOS.includes(c.motivo) ? c.motivo : null;
  const fase = typeof c?.fase === "string" && FASES.includes(c.fase) ? c.fase : null;
  if (!motivo || !fase) return NextResponse.json({ ok: false }, { status: 400, headers: SEM_CACHE });
  const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v) : null);
  console.warn("[internet-falha]", JSON.stringify({ motivo, fase, ms: num(c?.ms, 600_000), status: num(c?.status, 599), rodada: num(c?.rodada, 5) }));
  return NextResponse.json({ ok: true }, { headers: SEM_CACHE });
}
