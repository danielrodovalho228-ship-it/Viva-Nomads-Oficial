import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { centralDePendencias } from "@/lib/data/central-pendencias";
import { estadoBackup } from "@/lib/backup/cartao";
import { lerExecucoesBackup } from "@/components/admin/cartao-backup";
import { listarFalhasDocumentos } from "@/lib/data/documentos-falhas-actions";
import {
  candidaturasSemResposta48h,
  filaDocumentos,
  idsContasTeste,
  pedidosExpirandoSemResposta,
  taxasVencidas,
  urgentesSemResposta4h,
} from "@/lib/data/admin-indicadores";
import { textoFilaDocumentos } from "@/lib/admin/indicadores";
import { chamadoForaDaPromessa, parceiroSemResposta } from "@/lib/lembretes/regras";
import { haQuantoTempo, montarDecisoesAdmin, type ChaveDecisaoAdmin, type ContagemDecisao, type DecisoesAdmin } from "@/lib/admin/decisoes-admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

const horasDesde = (iso: string | null | undefined) => (iso ? (Date.now() - new Date(iso).getTime()) / 3_600_000 : null);
const maisAntigo = (iso: string | null | undefined) => {
  const t = haQuantoTempo(horasDesde(iso));
  return t ? `mais antigo ${t}` : null;
};

/** Chamados abertos de uma prioridade: a mesma regra da fila do Atendimento (filaAtendimento sem filtro de status). */
async function chamadosAbertos(admin: Admin, prioridade: "p1" | "p2"): Promise<ContagemDecisao> {
  const { data, error } = await admin
    .from("chamados")
    .select("criado_em")
    .eq("simulacao", false)
    .eq("prioridade", prioridade)
    .not("status", "in", "(resolvido,encerrado)")
    .order("criado_em", { ascending: true })
    .limit(200);
  if (error) return { n: null };
  const linhas = (data ?? []) as { criado_em: string | null }[];
  return { n: linhas.length, detalhe: maisAntigo(linhas[0]?.criado_em) };
}

/** Prompt 50: chamados sem a 1ª resposta de uma pessoa além da promessa pública (24 h), sem simulação. */
async function chamadosForaDaPromessa(admin: Admin, agora: Date): Promise<ContagemDecisao> {
  const { data, error } = await admin
    .from("chamados")
    .select("criado_em, primeira_resposta_em, status")
    .eq("simulacao", false)
    .is("primeira_resposta_em", null)
    .not("status", "in", "(resolvido,encerrado)")
    .order("criado_em", { ascending: true })
    .limit(500);
  if (error) return { n: null };
  const linhas = ((data ?? []) as { criado_em: string; primeira_resposta_em: string | null }[]).filter((c) =>
    chamadoForaDaPromessa({ criadoEm: c.criado_em, primeiraRespostaEm: c.primeira_resposta_em, resolvido: false }, agora),
  );
  return { n: linhas.length, detalhe: maisAntigo(linhas[0]?.criado_em) };
}

/** Prompt 50: parcerias pendentes há mais de 1 dia útil (seg a sex, Brasília). */
async function parceriasSemResposta1Dia(admin: Admin, agora: Date): Promise<ContagemDecisao> {
  const { data, error } = await admin.from("parceiro_solicitacoes").select("criado_em, decidido_em").eq("status", "pendente").not("categorias", "cs", "{vistoria}").order("criado_em", { ascending: true }).limit(500);
  if (error) return { n: null };
  const linhas = ((data ?? []) as { criado_em: string; decidido_em: string | null }[]).filter((s) => parceiroSemResposta(s.criado_em, s.decidido_em, agora));
  return { n: linhas.length, detalhe: maisAntigo(linhas[0]?.criado_em) };
}

/** Prompt 50: verificações na análise humana (2ª reprovação automática), a mesma fila de /admin/documentos. */
async function verificacoesParaAnalisar(admin: Admin): Promise<ContagemDecisao> {
  const { data, error } = await admin.from("verificacao_revisoes").select("criado_em").is("decidido_em", null).order("criado_em", { ascending: true }).limit(500);
  if (error) return { n: null };
  const linhas = (data ?? []) as { criado_em: string }[];
  return { n: linhas.length, detalhe: maisAntigo(linhas[0]?.criado_em) };
}

/** Encerramentos abertos ou em condução: os mesmos que /admin/contratos/encerramentos mostra para conduzir. */
async function encerramentosAbertos(admin: Admin): Promise<ContagemDecisao> {
  const { data, error } = await admin
    .from("contrato_encerramento_pedidos")
    .select("criado_em")
    .neq("status", "concluido")
    .order("criado_em", { ascending: true })
    .limit(500);
  if (error) return { n: null };
  const linhas = (data ?? []) as { criado_em: string }[];
  return { n: linhas.length, detalhe: maisAntigo(linhas[0]?.criado_em) };
}

/** Pedidos de parceria na aba "Pendentes" de /admin/parceiros (pendente ou aguardando o e-mail da pessoa). */
async function parceriasPendentes(admin: Admin): Promise<ContagemDecisao> {
  const { data, error } = await admin
    .from("parceiro_solicitacoes")
    .select("criado_em")
    .in("status", ["pendente", "aguardando_email"])
    .not("categorias", "cs", "{vistoria}")
    .order("criado_em", { ascending: true })
    .limit(500);
  if (error) return { n: null };
  const linhas = (data ?? []) as { criado_em: string }[];
  return { n: linhas.length, detalhe: maisAntigo(linhas[0]?.criado_em) };
}

/** Pedidos a parceiros ainda "solicitado" (sem orçamento), contas de teste fora — o filtro ?filtro=solicitado da lista. */
export async function pedidosParceiroSemOrcamento(admin: Admin): Promise<{ id: string; criado_em: string }[] | null> {
  const [{ data, error }, teste, { data: parcs }] = await Promise.all([
    admin.from("parceiro_pedidos").select("id, cliente_id, parceiro_id, criado_em").eq("status", "solicitado").order("criado_em", { ascending: true }).limit(1000),
    idsContasTeste(admin),
    admin.from("parceiros").select("id, user_id").limit(5000),
  ]);
  if (error) return null;
  const dono = new Map(((parcs ?? []) as { id: string; user_id: string }[]).map((p) => [p.id, p.user_id]));
  return ((data ?? []) as { id: string; cliente_id: string; parceiro_id: string; criado_em: string }[]).filter(
    (p) => !teste.has(p.cliente_id) && !teste.has(dono.get(p.parceiro_id) ?? ""),
  );
}

/**
 * As decisões do início do /admin (Prompt 46). Cada contagem vem da MESMA função da lista que a linha abre; o que não
 * puder ser lido fica de fora da soma e a tela avisa (nunca vira zero). O layout de /admin já exige admin.
 */
export async function decisoesDoAdmin(agora = new Date()): Promise<DecisoesAdmin | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const ler = <T,>(p: Promise<T>) => p.catch(() => null);
  const [p1, p2, backup, falhas, docs, encerr, parcerias, pedidosParc, urgentes, cand48, vencidas, expirando, central, foraPromessa, parc1Dia, verificacoes] = await Promise.all([
    ler(chamadosAbertos(admin, "p1")),
    ler(chamadosAbertos(admin, "p2")),
    ler(lerExecucoesBackup()),
    ler(listarFalhasDocumentos()),
    ler(filaDocumentos(admin)),
    ler(encerramentosAbertos(admin)),
    ler(parceriasPendentes(admin)),
    ler(pedidosParceiroSemOrcamento(admin)),
    ler(urgentesSemResposta4h(admin)),
    ler(candidaturasSemResposta48h(admin)),
    ler(taxasVencidas(admin, "real")),
    ler(pedidosExpirandoSemResposta(admin)),
    ler(centralDePendencias(admin, agora)),
    ler(chamadosForaDaPromessa(admin, agora)),
    ler(parceriasSemResposta1Dia(admin, agora)),
    ler(verificacoesParaAnalisar(admin)),
  ]);

  const contagens: Partial<Record<ChaveDecisaoAdmin, ContagemDecisao | null>> = {
    chamados_p1: p1,
    chamados_p2: p2,
    encerramentos: encerr,
    parceiros_para_aprovar: parcerias,
    chamados_fora_promessa: foraPromessa,
    parceiros_sem_resposta_1_dia: parc1Dia,
    verificacao_analise_humana: verificacoes,
  };
  if (backup && backup !== "sem_tabela") {
    const e = estadoBackup(backup, agora);
    contagens.backup = { n: (e.copia.vermelho ? 1 : 0) + (e.drill.vermelho ? 1 : 0), detalhe: [e.copia.porque, e.drill.porque].filter(Boolean).join(" ") || null };
  }
  if (falhas) contagens.falhas_documento = { n: falhas.falhas.length + falhas.pendentes };
  if (docs) contagens.documentos_pendentes = { n: docs.total, detalhe: [textoFilaDocumentos(docs), maisAntigo(docs.maisAntigoEm)].filter(Boolean).join(" · ") };
  if (pedidosParc) contagens.pedidos_parceiro_sem_resposta = { n: pedidosParc.length, detalhe: maisAntigo(pedidosParc[0]?.criado_em) };
  if (urgentes) contagens.chamados_urgentes_sem_resposta = { n: urgentes.length, detalhe: maisAntigo(urgentes[0]?.opened_at) };
  if (cand48) contagens.candidaturas_sem_resposta_48h = { n: cand48.length, detalhe: maisAntigo(cand48[0]?.criadoEm) };
  if (vencidas) contagens.comissoes_vencidas = { n: vencidas.length };
  // Adendo 59.1: uma fonte de números — as filas do 59-A e as fotos de nível contam pelas linhas da Central.
  if (central) {
    const maisVelha = (f: "manutencao_fora_prazo" | "conforto_contestacoes" | "fotos_nivel") =>
      maisAntigo(central.linhas.filter((l) => l.filtro === f).map((l) => l.desde).sort()[0]);
    contagens.manutencao_fora_prazo = { n: central.contagens.manutencao_fora_prazo, detalhe: maisVelha("manutencao_fora_prazo") };
    contagens.conforto_contestacoes = { n: central.contagens.conforto_contestacoes, detalhe: maisVelha("conforto_contestacoes") };
    contagens.fotos_nivel = { n: central.contagens.fotos_nivel, detalhe: maisVelha("fotos_nivel") };
  }
  if (expirando) contagens.pedidos_sem_resposta_expirando = { n: expirando.length, detalhe: "vencem em até 3 dias" };
  return montarDecisoesAdmin(contagens);
}
