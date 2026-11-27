"use server";
/*
  E1229 — a anulação de um registro de pagamento (aluguel ou caução), pelo desenho do coordenador (ORDENS-DUET 1143,
  1160 e 1162).
   - O DONO anula sozinho só ANTES da confirmação do morador. Depois dela, um pagamento confirmado é um facto
     reconhecido pelos dois: a ação do dono é recusada e vira PEDIDO à Central — um chamado que nasce do registro (o
     número REC/CAU, o valor e o motivo), na fila de quem trata desse dinheiro (aluguel → "cobranca", caução → "caucao").
     Uma nota do SISTEMA no chamado guarda qual registro é (a pessoa não a escreve).
   - A CENTRAL decide: só a equipe, com a mesma anulação; recusa o que já está anulado (dois cliques, uma anulação).
   - O motivo é obrigatório (5 letras ou mais, a checagem da 0182) e vai para o morador.
   - O documento ligado (REC/CAU) é anulado junto; o PDF guardado nunca é apagado.
   - Quem anulou fica na trilha do contrato: contrato_eventos "pagamento_anulado" (0368), caminho "dono" ou "central".
  O que sobra no bloco recalcula pelo que continua ativo; o número de uma parte anulada não volta (contratos-actions).
*/
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { recusaObservador } from "@/lib/qa/observador";
import { abrirChamado, responderComoAdmin } from "@/lib/data/atendimento-actions";
import { notify } from "@/lib/notifications";
import { ASSUNTOS } from "@/lib/notifications/assuntos";
import { formatBRLExato } from "@/lib/precos";
import { componentesDoPagamento } from "@/lib/pagamento-componentes";
import { numeroPublicoContrato } from "@/lib/contrato-ref";

export type ResultadoAnulacao = { ok: true; pedido?: string; mensagem?: string } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A nota do sistema que liga o chamado ao registro (o pedido de anulação). */
const NOTA_DO_PEDIDO = /^\[anulacao\] pagamento=([0-9a-f-]{36})$/i;

/** PROPOSTA DE TEXTO */
const MSG_MOTIVO = "Escreva o motivo da anulação (pelo menos 5 letras): ele aparece para o morador.";
/** PROPOSTA DE TEXTO */
const MSG_JA_ANULADO = "Este registro já foi anulado.";
/** PROPOSTA DE TEXTO */
const MSG_SO_O_DONO = "Só o proprietário do imóvel anula este registro.";
/** PROPOSTA DE TEXTO */
const MSG_SEM_LEITURA = "Não foi possível ler o registro. Tente de novo em instantes.";
/** PROPOSTA DE TEXTO */
const msgPedido = (numero: string) => `O morador já confirmou este registro, por isso a anulação é pedida à Central: chamado ${numero}. Você recebe a resposta por lá.`;

type Pagamento = {
  id: string;
  contrato_id: string;
  tipo: string;
  valor: number | string;
  /** E1241: os encargos do registro (contas e limpeza) — sem eles não há total. */
  encargos?: unknown;
  confirmado_pelo_inquilino: boolean | null;
  anulado_em: string | null;
  contratos: { id: string; tenant_id: string; properties: { owner_id: string | null; title?: string | null } | null } | null;
};
type Cliente = NonNullable<Awaited<ReturnType<typeof createClient>>>;
type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

const motivoValido = (m: string) => {
  const t = String(m ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
  return t.length >= 5 ? t : null;
};

async function lerPagamento(db: Cliente | Admin, id: string): Promise<Pagamento | null> {
  const { data, error } = await db
    .from("pagamentos_bloco")
    .select("id, contrato_id, tipo, valor, encargos, confirmado_pelo_inquilino, anulado_em, contratos(id, tenant_id, properties(owner_id, title))")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as Pagamento;
}

/**
 * E1241 (MAPA-E1241): o TOTAL do registro (valor + encargos), pela fonte única componentesDoPagamento — num registro
 * complementar a coluna valor é zero e o dinheiro está nos encargos. Na caução os encargos não contam (a mesma guarda
 * dos outros leitores).
 */
const totalDoRegistro = (pg: Pick<Pagamento, "tipo" | "valor" | "encargos">) =>
  componentesDoPagamento({ valor: Number(pg.valor) || 0, encargos: pg.tipo === "caucao" ? [] : pg.encargos }).total;

async function documentoDe(admin: Admin, pagamentoId: string): Promise<{ id: string; numero: string } | null> {
  const { data } = await admin.from("documentos_fiscais").select("id, numero").eq("pagamento_id", pagamentoId).is("anulado_em", null).maybeSingle();
  return (data as { id: string; numero: string } | null) ?? null;
}

/**
 * A anulação no banco, a mesma nos dois caminhos — UMA operação (ORDEM-DUET-1169): a função anular_pagamento (0368)
 * faz numa transação só o registro (com as guardas: só o que não está anulado e, pelo dono, só o não confirmado), o
 * documento ligado e o evento de quem anulou; ou tudo, ou nada. O aviso ao morador só vem depois de ela dar certo.
 */
async function anularNoBanco(
  admin: Admin,
  pg: Pagamento,
  motivo: string,
  quem: { autorId: string; caminho: "dono" | "central"; chamado?: string },
): Promise<{ ok: true; documento: string | null } | { ok: false; error: string }> {
  const { data, error } = await admin.rpc("anular_pagamento", { p_pagamento: pg.id, p_motivo: motivo, p_autor: quem.autorId, p_caminho: quem.caminho, p_chamado: quem.chamado ?? null });
  if (error) return { ok: false, error: MSG_SEM_LEITURA };
  const r = (data ?? {}) as { ok?: boolean; documento?: string | null };
  if (!r.ok) return { ok: false, error: MSG_JA_ANULADO };
  const documento = r.documento ?? null;
  const morador = pg.contratos?.tenant_id;
  if (morador) {
    const { data: u } = await admin.auth.admin.getUserById(morador);
    const registro = documento ?? (pg.tipo === "caucao" ? "da caução" : "do pagamento");
    const valor = formatBRLExato(Number(pg.valor) || 0);
    // ORDEM-DUET-1169: no caminho da Central, quem anulou foi a equipe, a pedido do proprietário.
    const titulo =
      quem.caminho === "central"
        ? `A equipe da Viva anulou, a pedido do proprietário, o registro ${registro} de ${valor}: ${motivo}.`
        : `O proprietário anulou o registro ${registro} de ${valor}: ${motivo}`;
    await notify({
      event: "contract_status",
      email: u?.user?.email ?? undefined,
      userId: morador,
      pushUrl: `/dashboard/estadia/${pg.contrato_id}`,
      // Sem ref_id: o aviso da anulação nunca renova (nem é renovado por) outro aviso do contrato, como o de assinatura.
      prioridadeAviso: "normal",
      tituloAviso: titulo,
      subject: ASSUNTOS.registroAnulado,
      body: (n?: string) => `Olá${n ? " " + n : ""}, ${titulo.charAt(0).toLowerCase()}${titulo.slice(1).replace(/\.$/, "")} (contrato ${numeroPublicoContrato(pg.contrato_id)}).`,
      ctaLabel: "Ver a estadia",
    });
  }
  return { ok: true, documento };
}

/** O dono anula um registro dele. Antes da confirmação, anula; depois, abre o pedido à Central. */
export async function anularRegistro(input: { pagamentoId: string; motivo: string }): Promise<ResultadoAnulacao> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, error: MSG_SEM_LEITURA };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para anular o registro." };
  const motivo = motivoValido(input.motivo);
  if (!motivo) return { ok: false, error: MSG_MOTIVO };
  if (!UUID_RE.test(input.pagamentoId)) return { ok: false, error: MSG_SEM_LEITURA };
  // A sessão prova que a pessoa é parte do contrato (RLS); o dono é o do imóvel.
  const pg = await lerPagamento(supabase, input.pagamentoId);
  if (!pg) return { ok: false, error: MSG_SEM_LEITURA };
  if (pg.contratos?.properties?.owner_id !== user.id) return { ok: false, error: MSG_SO_O_DONO };
  if (pg.anulado_em) return { ok: false, error: MSG_JA_ANULADO };
  if (pg.confirmado_pelo_inquilino) {
    const doc = await documentoDe(admin, pg.id);
    const registro = doc?.numero ?? (pg.tipo === "caucao" ? "da caução" : "do aluguel");
    const r = await abrirChamado({
      categoria: pg.tipo === "caucao" ? "caucao" : "cobranca",
      assunto: `Pedido de anulação do registro ${registro}`,
      mensagem: `Pedido de anulação do registro ${registro} de ${formatBRLExato(totalDoRegistro(pg))} (contrato ${numeroPublicoContrato(pg.contrato_id)}), já confirmado pelo morador. Motivo: ${motivo}`,
      contextoTipo: "contrato",
      contextoId: pg.contrato_id,
      pedePessoa: true,
    });
    if (!r.ok) return { ok: false, error: r.error };
    const { data: ch } = await admin.from("chamados").select("id").eq("numero_publico", r.numero).maybeSingle();
    if (ch?.id) await admin.from("chamado_mensagens").insert({ chamado_id: ch.id, autor: "sistema", interno: true, corpo: `[anulacao] pagamento=${pg.id}` });
    return { ok: true, pedido: r.numero, mensagem: msgPedido(r.numero) };
  }
  const r = await anularNoBanco(admin, pg, motivo, { autorId: user.id, caminho: "dono" });
  return r.ok ? { ok: true } : r;
}

/** A Central decide o pedido: só a equipe, com a mesma anulação; o registro é o que o chamado guarda. */
export async function anularRegistroPelaCentral(input: { chamadoId: string; motivo: string }): Promise<ResultadoAnulacao> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, error: MSG_SEM_LEITURA };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return { ok: false, error: "Sem permissão." };
  const motivo = motivoValido(input.motivo);
  if (!motivo) return { ok: false, error: MSG_MOTIVO };
  if (!UUID_RE.test(input.chamadoId)) return { ok: false, error: "Chamado não encontrado." };
  const { data: ch } = await admin.from("chamados").select("id, numero_publico, contexto_tipo, contexto_id").eq("id", input.chamadoId).maybeSingle();
  if (!ch) return { ok: false, error: "Chamado não encontrado." };
  const { data: notas } = await admin.from("chamado_mensagens").select("corpo, autor, interno").eq("chamado_id", ch.id).eq("autor", "sistema").eq("interno", true).order("criado_em", { ascending: true });
  // ORDEM-DUET-1177: todos os registros das notas do sistema; mais de um, recusa — um pedido por registro.
  const ids = new Set(((notas ?? []) as { corpo: string }[]).map((n) => NOTA_DO_PEDIDO.exec(String(n.corpo ?? "").trim())?.[1]?.toLowerCase()).filter((x): x is string => !!x));
  if (ids.size > 1) return { ok: false, error: "Este chamado tem mais de um registro; abra um pedido por registro." };
  const [pagamentoId] = [...ids];
  if (!pagamentoId) return { ok: false, error: "Este chamado não é um pedido de anulação de registro." };
  const pg = await lerPagamento(admin, pagamentoId);
  // ORDEM-DUET-1170 (N7): o pedido nasce sempre com o contrato do registro no contexto; o chamado tem de ser desse
  // contrato — um chamado sem contrato, ou de outro, não anula registro nenhum.
  if (!pg || ch.contexto_tipo !== "contrato" || ch.contexto_id !== pg.contrato_id) return { ok: false, error: MSG_SEM_LEITURA };
  if (pg.anulado_em) return { ok: false, error: MSG_JA_ANULADO };
  // E1246 (ORDEM-DUET-1220; dúvida 2 do MAPA-E1244): a conta observadora da QA só decide quando TUDO o que a anulação
  // toca é de teste — as duas partes do contrato (o pagamento, o documento e o aviso ao morador são de verdade).
  // Com uma parte real, ou sem saber quem é, recusa. Quem não é a observadora decide como antes.
  const morador = pg.contratos?.tenant_id ?? null;
  const dono = pg.contratos?.properties?.owner_id ?? null;
  const recusaQa = await recusaObservador(user.id, { perfis: [morador, dono], semPerfil: morador && dono ? 0 : 1 });
  if (recusaQa) return { ok: false, error: recusaQa };
  const r = await anularNoBanco(admin, pg, motivo, { autorId: user.id, caminho: "central", chamado: String(ch.numero_publico) });
  if (!r.ok) return r;
  const registro = r.documento ?? (pg.tipo === "caucao" ? "da caução" : "do pagamento");
  // ORDEM-DUET-1169: a decisão chega ao dono numa resposta VISÍVEL no chamado dele (a notificação normal do atendimento).
  await responderComoAdmin(ch.id, `A equipe anulou o registro ${registro}. Motivo: ${motivo}.`, false);
  // A nota interna (quem decidiu e quando) fica para a equipe.
  await admin.from("chamado_mensagens").insert({
    chamado_id: ch.id,
    autor: "admin",
    autor_id: user.id,
    interno: true,
    corpo: `Registro ${registro} de ${formatBRLExato(totalDoRegistro(pg))} anulado pela Central em ${new Date().toISOString().slice(0, 10)}. Motivo: ${motivo}`,
  });
  return { ok: true };
}
