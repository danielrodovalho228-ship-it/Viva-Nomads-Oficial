/*
  Quem pode agir como DONO de um chamado (PURO, testável com node --test).

  A Central de Ajuda é a tela do cliente: ver, responder, "falar com uma pessoa"
  e "resolveu". Só a conta que abriu o chamado faz isso. Admin NÃO conta como
  dono — a regra de leitura do banco deixa o admin ver qualquer chamado, e foi
  assim que uma resposta de admin entrou como se fosse da cliente (VN-000100).
  Admin responde só pelo Admin → Atendimento.
*/

export interface ChamadoDono {
  usuario_id: string | null;
}

/** true só quando a conta logada é a dona do chamado (visitante não tem dono logado). */
export function ehDonoDoChamado(c: ChamadoDono | null | undefined, userId: string | null | undefined): boolean {
  return !!c && !!userId && !!c.usuario_id && c.usuario_id === userId;
}

/** O mínimo do cliente Supabase que a busca usa (o real, ou um falso nos testes). */
interface ConsultaChamado {
  eq(coluna: string, valor: string): ConsultaChamado;
  maybeSingle(): PromiseLike<{ data: unknown }>;
}
export interface ClienteChamados {
  from(tabela: "chamados"): { select(colunas: string): ConsultaChamado };
}

/**
 * O chamado, SÓ se a conta logada for a dona. Não confia na regra de leitura do
 * banco (ela deixa o admin ver tudo): filtra por usuario_id e confere de novo.
 * Usada por TODA ação da Central de Ajuda (ver, responder, falar com uma
 * pessoa, resolveu). Admin age só pelo Admin → Atendimento, nunca como "usuario".
 */
export async function chamadoDoDono<T extends ChamadoDono>(
  cliente: ClienteChamados,
  userId: string,
  filtro: { id: string } | { numero: string },
  colunas: string
): Promise<T | null> {
  let q = cliente.from("chamados").select(`usuario_id, ${colunas}`).eq("usuario_id", userId);
  q = "id" in filtro ? q.eq("id", filtro.id) : q.eq("numero_publico", filtro.numero);
  const { data } = await q.maybeSingle();
  const c = data as T | null;
  return ehDonoDoChamado(c, userId) ? c : null;
}

/** Janela do aviso "nova mensagem" para a equipe: no máximo 1 por chamado. */
export const JANELA_AVISO_EQUIPE_S = 15 * 60;

/** A equipe deve ser avisada da mensagem da pessoa? (com a Viva no chamado, quem responde é ela.) */
export function equipeAvisadaDaMensagem(c: { responsavel_tipo: string; status: string }): boolean {
  return c.responsavel_tipo === "humano" && c.status !== "encerrado";
}

/** Texto curto do Admin para o status "aguardando aprovação". */
export const EXPLICA_AGUARDANDO_APROVACAO =
  "Aprovação interna da equipe (decisão do Daniel), não do cliente. O cliente vê \"Em análise pela equipe\".";
