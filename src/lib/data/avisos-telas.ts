/*
  E1242 reaberto (ORDEM-DUET 1247; a lei do E777) — a UMA leitura dos avisos para TODAS as telas: o painel do sino e a
  faixa crítica (rota /api/painel/avisos) e a página completa (/dashboard/notificacoes#avisos, com os filtros e o
  "Não lido"). Lê os avisos e o resumo com o cliente da pessoa (RLS), confere a situação real (E676/E1060/E1128), grava
  o que a conferência resolveu (E1128/E1242, só com referência — ORDEM-1224) e aplica a regra única superficieDosAvisos.
  Sem sessão: null. Falha de leitura dos avisos: LANÇA (a tela nunca mostra "0 avisos" quando não conseguiu ler).
*/
import { meusAvisos, resumoDoSino } from "@/lib/data/avisos-actions";
import { contratoDoAviso, ehAvisoDeVisitaDeAvaliacao, resolucoesConferidasAGravar, resolvidosNaPratica, superficieDosAvisos, type AvisoTela } from "@/lib/notifications/sino";
import { gravarResolucaoConferida } from "@/lib/notifications/avisos-servidor";
import { situacaoDosContratos } from "@/lib/notifications/situacao-contratos";
import { createClient } from "@/lib/supabase/server";
import type { PrioridadeAviso } from "@/lib/notifications/avisos";

export interface AvisosDasTelas {
  /** Os avisos que ainda valem (sem os resolvidos), do mais recente ao mais antigo. */
  avisos: AvisoTela[];
  /** Os críticos que ainda valem (a faixa), no máximo 5. */
  criticos: AvisoTela[];
  /** Não lidas que ainda valem (o número do sino). */
  naoLidas: number;
  maiorPrioridade: PrioridadeAviso | null;
}

export async function avisosParaAsTelas(limite: number): Promise<AvisosDasTelas | null> {
  // O resumo conta todas as não lidas e não resolvidas (não só as da lista).
  const [avisos, resumo] = await Promise.all([meusAvisos(limite), resumoDoSino()]);
  if (!avisos || !resumo) return null;
  // E676: o crítico de contrato/aditivo só vale enquanto o problema existe — confere a situação real no banco.
  // E1060: o "Pedido de visita" só vale enquanto a visita espera a resposta do dono.
  // E1128: o aviso da visita de avaliação só vale enquanto o pedido tem visita por acontecer (qualquer prioridade).
  const deAvaliacao = avisos.some((a) => !a.resolvido_em && ehAvisoDeVisitaDeAvaliacao(a.evento));
  const candidatos = avisos.filter(
    (a) => !a.resolvido_em && (ehAvisoDeVisitaDeAvaliacao(a.evento) || (a.prioridade === "critico" && (a.evento === "contract_status" || a.evento === "estadia_aditivo_proposto" || a.evento === "visita_pedida"))),
  );
  let conferidos: AvisoTela[] = avisos;
  if (candidatos.length) {
    const supabase = await createClient();
    const uid = supabase ? (await supabase.auth.getUser()).data.user?.id : null;
    const ids = candidatos.filter((a) => a.evento === "contract_status" || a.evento === "estadia_aditivo_proposto").map((a) => contratoDoAviso(a)).filter((x): x is string => !!x);
    const visitas = candidatos.some((a) => a.evento === "visita_pedida");
    const situacao = uid ? await situacaoDosContratos(uid, ids, { visitas, avaliacao: deAvaliacao }).catch(() => null) : null;
    conferidos = resolvidosNaPratica(avisos, situacao, new Date().toISOString());
    // E1128 + E1242: o que a conferência deu por resolvido fica gravado — todas as telas concordam.
    const recemVencidos = resolucoesConferidasAGravar(avisos, conferidos);
    if (uid && recemVencidos.length) await gravarResolucaoConferida({ usuarioId: uid, ids: recemVencidos });
  }
  const s = superficieDosAvisos(resumo, avisos, conferidos);
  return { avisos: s.visiveis, criticos: s.criticos, naoLidas: s.naoLidas, maiorPrioridade: s.maiorPrioridade };
}
