import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { idsContasTeste } from "@/lib/data/admin-indicadores";
import { motivoDaReprovacao, type LaudoParaMotivo } from "@/config/verificacao-motivos";
import {
  buscaPedido,
  contaIntencao,
  ordenarPorQueda,
  rascunhoPublicado,
  semanas,
  solicitacaoAprovacao,
  verificacaoPorDegrau,
  visitaConta,
  type Anuncio,
  type Conta,
  type DegrauVerificacao,
  type Etapa,
  type Morador,
  type Periodo,
  type Solicitacao,
  type Verificacao,
  type Visita,
} from "@/lib/funil/regras";

/*
  Prompt 50 — o FUNIL do admin, lido do que já existe (sem tabela nova): sessões da tabela eventos, profiles
  (conta e intenção), leads + pedidos_moradia (1º pedido), properties (rascunho → publicado), parceiro_solicitacoes
  (resposta da Viva) e tenant_verifications + verificacao_revisoes (degraus da verificação). Contas de teste fora.
  As duas semanas (esta e a anterior) vêm da mesma leitura; o topo é a maior queda.
*/

export interface Funil {
  etapas: (Etapa & { queda: number | null; anterior: number | null })[];
  degrausVerificacao: DegrauVerificacao[];
  periodo: Periodo;
}

export async function funilDaSemana(agora = new Date()): Promise<Funil | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { atual, anterior } = semanas(agora);
  const desde = anterior.de;
  const teste = await idsContasTeste(admin);
  const ehTeste = (id: string | null | undefined) => !!id && teste.has(id);

  const [ev, perfis, leads, pedidos, imoveis, sols, verifs, revisoes] = await Promise.all([
    admin.from("eventos").select("sessao, usuario_id, criado_em, tipo").gte("criado_em", desde).not("sessao", "is", null).limit(50000),
    admin.from("profiles").select("id, created_at, intencao").gte("created_at", desde).limit(20000),
    admin.from("leads").select("tenant_id, created_at").gte("created_at", desde).limit(20000),
    admin.from("pedidos_moradia").select("inquilino_id, criado_em").gte("criado_em", desde).limit(20000),
    admin.from("properties").select("id, owner_id, created_at, status").gte("created_at", desde).limit(20000),
    admin.from("parceiro_solicitacoes").select("id, user_id, criado_em, decidido_em").gte("criado_em", new Date(Date.parse(desde) - 30 * 86_400_000).toISOString()).limit(5000),
    admin.from("tenant_verifications").select("tenant_id, caf_result, created_at").gte("created_at", desde).order("created_at", { ascending: true }).limit(20000),
    admin.from("verificacao_revisoes").select("user_id").gte("criado_em", desde).limit(5000),
  ]);

  const eventos = (ev.data ?? []) as { sessao: string; usuario_id: string | null; criado_em: string; tipo: string }[];
  const visitas: Visita[] = eventos.map((e) => ({ sessao: e.sessao, em: e.criado_em, teste: ehTeste(e.usuario_id) }));
  const contas: Conta[] = ((perfis.data ?? []) as { id: string; created_at: string; intencao: string[] | null }[]).map((p) => ({
    id: p.id,
    criadaEm: p.created_at,
    respondeuIntencao: p.intencao !== null,
    teste: ehTeste(p.id),
  }));

  // Morador: 1ª busca (eventos) e 1º pedido (candidatura ou pedido de moradia) no período.
  const primeiraBusca = new Map<string, string>();
  for (const e of eventos) if (e.tipo === "busca" && e.usuario_id && (!primeiraBusca.has(e.usuario_id) || e.criado_em < primeiraBusca.get(e.usuario_id)!)) primeiraBusca.set(e.usuario_id, e.criado_em);
  const primeiroPedido = new Map<string, string>();
  const pedidoEm = (u: string | null, em: string) => {
    if (u && (!primeiroPedido.has(u) || em < primeiroPedido.get(u)!)) primeiroPedido.set(u, em);
  };
  for (const l of (leads.data ?? []) as { tenant_id: string | null; created_at: string }[]) pedidoEm(l.tenant_id, l.created_at);
  for (const p of (pedidos.data ?? []) as { inquilino_id: string | null; criado_em: string }[]) pedidoEm(p.inquilino_id, p.criado_em);
  const moradores: Morador[] = [...primeiroPedido].map(([id, em]) => ({ id, primeiraBuscaEm: primeiraBusca.get(id) ?? null, primeiroPedidoEm: em, teste: ehTeste(id) }));

  const anuncios: Anuncio[] = ((imoveis.data ?? []) as { id: string; owner_id: string; created_at: string; status: string }[]).map((p) => ({
    id: p.id,
    iniciadoEm: p.created_at,
    publicadoEm: p.status !== "draft" ? p.created_at : null,
    teste: ehTeste(p.owner_id),
  }));
  const solicitacoes: Solicitacao[] = ((sols.data ?? []) as { id: string; user_id: string | null; criado_em: string; decidido_em: string | null }[]).map((s) => ({
    id: s.id,
    criadaEm: s.criado_em,
    decididaEm: s.decidido_em,
    teste: ehTeste(s.user_id),
  }));
  const fila = new Set(((revisoes.data ?? []) as { user_id: string }[]).map((r) => r.user_id));
  const porPessoa = new Map<string, { em: string; ok: boolean }[]>();
  for (const t of (verifs.data ?? []) as { tenant_id: string; caf_result: LaudoParaMotivo | null; created_at: string }[]) {
    porPessoa.set(t.tenant_id, [...(porPessoa.get(t.tenant_id) ?? []), { em: t.created_at, ok: motivoDaReprovacao(t.caf_result ?? {}) === null }]);
  }
  const verificacoes: Verificacao[] = [...porPessoa].map(([u, tentativas]) => ({ usuarioId: u, tentativas, filaHumana: fila.has(u), teste: ehTeste(u) }));

  const calcular = (p: Periodo) => {
    const v = verificacaoPorDegrau(verificacoes, p);
    return { etapas: [visitaConta(visitas, contas, p), contaIntencao(contas, p), buscaPedido(moradores, p), rascunhoPublicado(anuncios, p), solicitacaoAprovacao(solicitacoes, p), v.etapa], degraus: v.degraus };
  };
  const agoraCalc = calcular(atual);
  const antes = calcular(anterior);
  const valorAntes = new Map(antes.etapas.map((e) => [e.chave, e.valor]));
  return {
    etapas: ordenarPorQueda(agoraCalc.etapas, antes.etapas).map((e) => ({ ...e, anterior: valorAntes.get(e.chave) ?? null })),
    degrausVerificacao: agoraCalc.degraus,
    periodo: atual,
  };
}
