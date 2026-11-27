import { NextResponse } from "next/server";
import { marcarAvisoLido, marcarTodosAvisosLidos, meusAvisos, resumoDoSino } from "@/lib/data/avisos-actions";
import { contratoDoAviso, criticosPendentes, ehAvisoDeVisitaDeAvaliacao, ordenarParaOSino, resolucoesConferidasAGravar, resolvidosNaPratica, resumoSemVisitaVencida } from "@/lib/notifications/sino";
import { gravarResolucaoConferida } from "@/lib/notifications/avisos-servidor";
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
    // E1060: o "Pedido de visita" só vale enquanto a visita espera a resposta do dono.
    // E1128: o aviso da visita de avaliação só vale enquanto o pedido tem visita por acontecer (qualquer prioridade).
    const deAvaliacao = avisos.some((a) => !a.resolvido_em && ehAvisoDeVisitaDeAvaliacao(a.evento));
    const candidatos = avisos.filter(
      (a) => !a.resolvido_em && (ehAvisoDeVisitaDeAvaliacao(a.evento) || (a.prioridade === "critico" && (a.evento === "contract_status" || a.evento === "estadia_aditivo_proposto" || a.evento === "visita_pedida"))),
    );
    let conferidos = avisos;
    let { maiorPrioridade } = resumo;
    if (candidatos.length) {
      const supabase = await createClient();
      const uid = supabase ? (await supabase.auth.getUser()).data.user?.id : null;
      const ids = candidatos.filter((a) => a.evento === "contract_status" || a.evento === "estadia_aditivo_proposto").map((a) => contratoDoAviso(a)).filter((x): x is string => !!x);
      const visitas = candidatos.some((a) => a.evento === "visita_pedida");
      const situacao = uid ? await situacaoDosContratos(uid, ids, { visitas, avaliacao: deAvaliacao }).catch(() => null) : null;
      conferidos = resolvidosNaPratica(avisos, situacao, new Date().toISOString());
      // E1128 + E1242: o que a conferência deu por resolvido fica gravado (todas as telas concordam) — a visita de
      // avaliação, e o aviso de assinar/do aditivo só com referência (ORDEM-1224).
      const recemVencidos = resolucoesConferidasAGravar(avisos, conferidos);
      if (uid && recemVencidos.length) await gravarResolucaoConferida({ usuarioId: uid, ids: recemVencidos });
      if (maiorPrioridade === "critico" && !criticosPendentes(conferidos).length) {
        maiorPrioridade = resumoDosAvisos(conferidos.filter((a) => !a.lido_em)).maiorPrioridade;
      }
    }
    // E1128: o aviso de visita de avaliação já resolvido sai do sino (não aparece, não conta como não lido e não deixa a cor).
    // E1242: o aviso de assinar/do aditivo já resolvido (pela assinatura, ou pela conferência com referência) também sai.
    const resolvidosNoBanco = new Set(avisos.filter((a) => a.resolvido_em).map((a) => a.id));
    const doSino = resumoSemVisitaVencida({ naoLidas: resumo.naoLidas, maiorPrioridade }, conferidos, resolvidosNoBanco);
    const { visiveis } = doSino;
    return NextResponse.json(
      { naoLidas: doSino.naoLidas, maiorPrioridade: doSino.maiorPrioridade, recentes: ordenarParaOSino(visiveis), criticos: criticosPendentes(visiveis).slice(0, 5) },
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
