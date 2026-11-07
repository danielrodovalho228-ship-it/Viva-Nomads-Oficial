import { NextResponse } from "next/server";
import { marcarAvisoLido, marcarTodosAvisosLidos, meusAvisos, resumoDoSino } from "@/lib/data/avisos-actions";
import { contratoDoAviso, criticosPendentes, ordenarParaOSino, resolvidosNaPratica } from "@/lib/notifications/sino";
import { resumoDosAvisos } from "@/lib/notifications/avisos";
import { situacaoDosContratos } from "@/lib/notifications/situacao-contratos";
import { createClient } from "@/lib/supabase/server";

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
    // E676: o crítico de contrato/aditivo só vale enquanto o problema existe — confere a situação real no banco.
    const candidatos = avisos.filter((a) => a.prioridade === "critico" && !a.resolvido_em && (a.evento === "contract_status" || a.evento === "estadia_aditivo_proposto"));
    let conferidos = avisos;
    let { maiorPrioridade } = resumo;
    if (candidatos.length) {
      const supabase = await createClient();
      const uid = supabase ? (await supabase.auth.getUser()).data.user?.id : null;
      const ids = candidatos.map((a) => contratoDoAviso(a)).filter((x): x is string => !!x);
      const situacao = uid ? await situacaoDosContratos(uid, ids).catch(() => null) : null;
      conferidos = resolvidosNaPratica(avisos, situacao, new Date().toISOString());
      if (maiorPrioridade === "critico" && !criticosPendentes(conferidos).length) {
        maiorPrioridade = resumoDosAvisos(conferidos.filter((a) => !a.lido_em)).maiorPrioridade;
      }
    }
    const { naoLidas } = resumo;
    return NextResponse.json(
      { naoLidas, maiorPrioridade, recentes: ordenarParaOSino(conferidos), criticos: criticosPendentes(conferidos).slice(0, 5) },
      { headers: SEM_CACHE }
    );
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
