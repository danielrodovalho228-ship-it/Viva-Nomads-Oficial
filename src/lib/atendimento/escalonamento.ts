import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { nivelEscalonamento, STATUS_COM_A_EQUIPE } from "@/lib/atendimento/acolhimento";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export interface ChamadoEsperando {
  id: string;
  numero_publico: string;
  assunto: string;
  prioridade: string;
  categoria: string;
  usuario_id: string | null;
  visitante_email: string | null;
  visitante_nome: string | null;
  criado_em: string;
  nivel: 2 | 6;
  horas: number;
}

/**
 * Chamados com a vez da EQUIPE (aberto / em andamento / aguardando aprovação),
 * sem nenhuma resposta de uma pessoa da equipe, há 2 h ou mais. A resposta
 * automática da Viva (acolhimento) não conta: o que se mede é a resposta humana.
 */
export async function chamadosEsperandoEquipe(admin: Admin, agora = new Date()): Promise<ChamadoEsperando[]> {
  const limite = new Date(agora.getTime() - 2 * 3_600_000).toISOString();
  const { data } = await admin
    .from("chamados")
    .select("id, numero_publico, assunto, prioridade, categoria, status, responsavel_tipo, usuario_id, visitante_email, visitante_nome, criado_em")
    .eq("simulacao", false)
    .eq("responsavel_tipo", "humano")
    .in("status", [...STATUS_COM_A_EQUIPE])
    .lt("criado_em", limite)
    .order("criado_em")
    .limit(100);
  const lista = data ?? [];
  if (!lista.length) return [];
  const { data: respostas } = await admin
    .from("chamado_mensagens")
    .select("chamado_id")
    .in("chamado_id", lista.map((c) => c.id as string))
    .eq("autor", "admin")
    .eq("interno", false);
  const respondidos = new Set((respostas ?? []).map((r) => r.chamado_id as string));
  const out: ChamadoEsperando[] = [];
  for (const c of lista) {
    const nivel = nivelEscalonamento(
      { status: c.status as string, responsavel_tipo: c.responsavel_tipo as string, criado_em: c.criado_em as string, respondidoPorPessoa: respondidos.has(c.id as string) },
      agora
    );
    if (nivel) out.push({ ...(c as unknown as ChamadoEsperando), nivel, horas: Math.floor((agora.getTime() - new Date(c.criado_em as string).getTime()) / 3_600_000) });
  }
  return out;
}
