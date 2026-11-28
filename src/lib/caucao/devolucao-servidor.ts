import "server-only";
/*
  E1248 PR 1 — a máquina da devolução da caução, no SERVIDOR (ESPEC-E1248 v11, secções 2.2, 2.3, 2.7 e 8.2; ORDEM-DUET
  1355). Lido pelas ações (documentos-actions.ts, devolucao-caucao-actions.ts) e pela rotina de hora a hora
  (/api/cron/devolucao-caucao):
   - a confirmação por falta de resposta, condicional como a do morador: ganha quem mudou a linha; a hora gravada é
     SEMPRE a do fim do prazo anunciado (ORDEM-1325), nunca a da passagem da rotina nem a da resposta tardia;
   - os dois lembretes das últimas 24 horas (o do morador e o do anexo), uma vez só cada um;
   - os envios dos sete eventos próprios, com o texto do coordenador no aviso e o contrato como referência.
  Um acerto sem a hora do aviso NUNCA confirma por falta de resposta (M4). A máquina corre sem chave (decisão 2); só a
  escrita nos prazos, no PR 2, fica atrás da chave.
*/
import { notify } from "@/lib/notifications";
import { resolverAvisosDaReferencia } from "@/lib/notifications/avisos-servidor";
import type { NotificationEvent } from "@/lib/notifications/eventos-email";
import type { PapelAviso } from "@/lib/notifications/avisos";
import { emitirTermoDevolucaoComRegistro } from "@/lib/fiscal/emitir";
import { avisarEquipe, avisarUsuario, type ChamadoResumo } from "@/lib/atendimento/servidor";
import { classificar } from "@/lib/atendimento/classificar";
import { prioridadeAcima } from "@/lib/atendimento/autonomo";
import { calcularPrazos, mensagemPrazo, type Prioridade } from "@/config/atendimento";
import { numeroPublicoContrato } from "@/lib/contrato-ref";
import {
  NOTA_DA_FASE_PARA_A_EQUIPE,
  brl,
  dataHoraCompleta,
  diaBRT,
  diaDaData,
  documentoDoMeio,
  fimDoPrazoDoAnexo,
  horaAnunciada,
  textoAvisoDoRegistro,
  PRAZO_HORAS,
  LEMBRETE_HORAS,
  fimDoPrazoDeResposta,
  prazoDeRespostaTerminou,
  naJanelaDoLembrete,
  naJanelaDoLembreteDoAnexo,
  textoFimDoPrazoAoMorador,
  textoFimDoPrazoAoDono,
  textoLembrete,
  textoLembreteDoAnexo,
} from "./devolucao-maquina";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = { from: (t: string) => any; auth?: { admin?: { getUserById?: (id: string) => Promise<{ data: { user: { email?: string | null } | null } }> } } };

const H = 3_600_000;

/** As colunas que a máquina lê do acerto. */
export const COLUNAS_DO_ACERTO =
  "id, contrato_id, tipo, status, caucao_total, valor_devolvido, data_devolucao, meio, created_at, confirmado_em, aviso_em, lembrete_em, confirmacao_via, contestacao_motivo, contestado_em, chamado_id, central_decisao, central_decidido_em, central_motivo, comprovante_path, comprovante_pedido_em, comprovante_anexado_em, comprovante_lembrete_em";

export type Acerto = {
  id: string;
  contrato_id: string;
  tipo: string;
  status: string;
  caucao_total: number | string;
  valor_devolvido: number | string | null;
  data_devolucao: string | null;
  meio: string | null;
  created_at: string;
  confirmado_em: string | null;
  aviso_em: string | null;
  lembrete_em: string | null;
  confirmacao_via: string | null;
  contestacao_motivo: string | null;
  contestado_em: string | null;
  chamado_id: string | null;
  central_decisao: string | null;
  central_decidido_em: string | null;
  central_motivo: string | null;
  comprovante_path: string | null;
  comprovante_pedido_em: string | null;
  comprovante_anexado_em: string | null;
  comprovante_lembrete_em: string | null;
};

/** A contestação recente é da própria ação: a rotina só abre o chamado que ficou sem ele há mais disto. */
export const ESPERA_DA_ACAO_MIN = 10;

/**
 * O retrato dos avisos pendentes desta pessoa, deste evento e deste contrato (id → criado_em). Comparar o de antes com o
 * de depois do envio prova o aviso gravado ou renovado sem depender do relógio do banco (Lab da 7bddfdef0). Leitura
 * que falha: null (nenhuma prova).
 */
async function retratoDoSino(admin: Admin, p: { usuarioId: string; evento: NotificationEvent; refId: string }): Promise<Map<string, string> | null> {
  const { data, error } = await admin.from("avisos").select("id, criado_em").eq("usuario_id", p.usuarioId).eq("evento", p.evento).eq("ref_id", p.refId).is("resolvido_em", null);
  if (error) return null;
  return new Map(((data ?? []) as { id: string; criado_em: string }[]).map((a) => [a.id, String(a.criado_em)]));
}

/** O sino ganhou um aviso, ou renovou um (o criado_em mudou), entre os dois retratos. */
const sinoMudou = (antes: Map<string, string> | null, depois: Map<string, string> | null) => !!antes && !!depois && [...depois].some(([id, criado]) => antes.get(id) !== criado);

/**
 * O aviso do registro ao morador (2.2). A hora grava-se só com o morador lido e com PROVA de envio — um canal que
 * entregou, ou o aviso gravado no sino (ORDEM-DUET 1361; o notify real nunca lança) — e só onde ela está vazia (update
 * … where aviso_em is null): o relógio dos 5 dias começa nesse envio. Sem prova, a hora fica vazia e a rotina tenta de
 * novo; um acerto sem ela nunca confirma por falta de resposta.
 */
export async function enviarAvisoDoRegistro(admin: Admin, a: Pick<Acerto, "id" | "contrato_id" | "valor_devolvido" | "data_devolucao">, agora: Date = new Date()): Promise<boolean> {
  const partes = await partesDoContrato(admin, a.contrato_id);
  if (!partes?.morador || !a.data_devolucao) return false;
  const chave = { usuarioId: partes.morador, evento: "caucao_devolucao_registrada" as const, refId: a.contrato_id };
  const antes = await retratoDoSino(admin, chave);
  const r = await enviar(admin, {
    evento: "caucao_devolucao_registrada",
    userId: partes.morador,
    papel: "morador",
    contratoId: a.contrato_id,
    url: URL_DO_MORADOR,
    texto: textoAvisoDoRegistro({ valor: valorDoAcerto(a), dataDevolucao: a.data_devolucao }),
    cta: "Confirmar ou contestar",
  });
  const avisado = algumCanalEntregou(r) || sinoMudou(antes, await retratoDoSino(admin, chave));
  if (!avisado) return false;
  const { data: mudou } = await admin.from("caucao_acertos").update({ aviso_em: agora.toISOString() }).eq("id", a.id).is("aviso_em", null).select("id");
  return !!mudou?.length;
}

/** O que o chamado da contestação leva (2.4): o valor, o motivo, as datas, o pedido do comprovante e a nota da fase. */
export function mensagemDaContestacao(a: Pick<Acerto, "contrato_id" | "valor_devolvido" | "created_at" | "data_devolucao" | "meio" | "comprovante_path">, p: { motivo: string; contestadoEm: string | Date; pedidoEm: string | Date | null }): { assunto: string; mensagem: string } {
  const contrato = numeroPublicoContrato(a.contrato_id);
  const linhas = [
    `Contestação da devolução da caução de ${brl(valorDoAcerto(a))} (contrato ${contrato}).`,
    `Registrada pelo proprietário em ${diaBRT(a.created_at)}; devolvida em ${a.data_devolucao ? diaDaData(a.data_devolucao) : "data não informada"}, por ${a.meio ?? "meio não informado"}; contestada em ${dataHoraCompleta(new Date(p.contestadoEm))}.`,
    `Motivo do morador: ${p.motivo}`,
    p.pedidoEm ? `A equipe pediu ao proprietário o ${documentoDoMeio(a.meio)}; o prazo do anexo termina em ${horaAnunciada(fimDoPrazoDoAnexo(p.pedidoEm))}.` : "O proprietário já anexou o comprovante.",
    NOTA_DA_FASE_PARA_A_EQUIPE,
  ];
  return { assunto: `Contestação da devolução da caução (${contrato})`, mensagem: linhas.join("\n") };
}

/** De quando conta o prazo da decisão: do fim do prazo do anexo, com o pedido em aberto; do anexo, com ele; ou null. */
export function prazoDaDecisaoDesde(a: Pick<Acerto, "comprovante_pedido_em" | "comprovante_anexado_em">): Date | null {
  if (a.comprovante_pedido_em && !a.comprovante_anexado_em) return fimDoPrazoDoAnexo(a.comprovante_pedido_em);
  if (a.comprovante_pedido_em && a.comprovante_anexado_em) return new Date(a.comprovante_anexado_em);
  return null;
}

/**
 * Liga o chamado ao acerto, sem duplicar (update … where chamado_id is null): a nota do SISTEMA que diz qual acerto é,
 * o chamado_id e o prazo da decisão. Devolve false quando outro chamado já estava ligado (nada se escreve).
 */
export async function ligarChamadoAoAcerto(admin: Admin, a: Pick<Acerto, "id" | "comprovante_pedido_em" | "comprovante_anexado_em">, ch: { id: string; prioridade?: string | null }): Promise<boolean> {
  const { data: mudou } = await admin.from("caucao_acertos").update({ chamado_id: ch.id }).eq("id", a.id).is("chamado_id", null).select("id");
  if (!mudou?.length) return false;
  await admin.from("chamado_mensagens").insert({ chamado_id: ch.id, autor: "sistema", interno: true, corpo: `[devolucao] acerto=${a.id}` });
  const desde = prazoDaDecisaoDesde(a);
  if (desde) await admin.from("chamados").update({ prazo_resolucao: calcularPrazos(((ch.prioridade as Prioridade) ?? "p2"), desde).resolucao.toISOString() }).eq("id", ch.id);
  return true;
}

/**
 * ORDEM-DUET 1359 (correção 2): a rotina abre o chamado da contestação que ficou sem ele — no nome do morador, na fila
 * da caução, com o contrato no contexto e "falar com uma pessoa", como a ação (sem a sessão, que a rotina não tem).
 */
export async function abrirChamadoPeloServidor(admin: Admin, p: { usuarioId: string; contratoId: string; assunto: string; mensagem: string }, agora: Date = new Date()): Promise<{ id: string; prioridade: string } | null> {
  const base = classificar("caucao", p.mensagem);
  const prioridade = prioridadeAcima(base.prioridade);
  const prazos = calcularPrazos(prioridade, agora);
  const { data: ch, error } = await admin
    .from("chamados")
    .insert({
      usuario_id: p.usuarioId,
      tipo: base.tipo,
      categoria: "caucao",
      prioridade,
      canal: "site",
      assunto: p.assunto.slice(0, 140),
      contexto_tipo: "contrato",
      contexto_id: p.contratoId,
      responsavel_tipo: "humano",
      // O padrão do banco (0073); o gatilho da 0135 liga-o para as contas de teste.
      simulacao: false,
      prazo_primeira_resposta: prazos.primeiraResposta.toISOString(),
      prazo_resolucao: prazos.resolucao.toISOString(),
    })
    .select("id, numero_publico, assunto, prioridade, usuario_id")
    .single();
  if (error || !ch) return null;
  const aviso = mensagemPrazo(prioridade);
  await admin.from("chamado_mensagens").insert([
    { chamado_id: ch.id, autor: "usuario", autor_id: p.usuarioId, corpo: p.mensagem.slice(0, 4000) },
    { chamado_id: ch.id, autor: "sistema", corpo: aviso },
  ]);
  await admin.from("chamado_eventos").insert({ chamado_id: ch.id, ator_tipo: "sistema", ator_id: null, acao: "aberto", para: prioridade, detalhe: "caucao · aberto pela rotina da devolução" });
  await admin.from("chamado_eventos").insert({ chamado_id: ch.id, ator_tipo: "sistema", ator_id: null, acao: "pediu_humano", para: prioridade, detalhe: "contestação da devolução da caução" });
  const resumo = { ...(ch as object), prioridade } as ChamadoResumo;
  await avisarUsuario(resumo, "chamado_aberto").catch(() => undefined);
  await avisarEquipe(resumo, "novo chamado · Caução · contestação da devolução").catch(() => undefined);
  return { id: ch.id as string, prioridade };
}

/** As contestações da devolução sem chamado e sem decisão (a Central mostra-as pela linha calculada). */
export async function contestacoesSemChamado(admin: Admin): Promise<(Acerto & { dono: string | null })[]> {
  const { data, error } = await admin
    .from("caucao_acertos")
    .select(COLUNAS_DO_ACERTO)
    .eq("status", "desconto_contestado")
    .not("contestado_em", "is", null)
    .is("chamado_id", null)
    .is("central_decisao", null);
  if (error) throw new Error("Não foi possível ler as contestações sem chamado.");
  const out: (Acerto & { dono: string | null })[] = [];
  for (const a of (data ?? []) as Acerto[]) out.push({ ...a, dono: (await partesDoContrato(admin, a.contrato_id))?.dono ?? null });
  return out;
}

/** O estado confirmado pelo tipo do acerto: a parcial segue a mesma tabela da total (M14). */
export const statusConfirmado = (tipo: string) => (tipo === "devolucao_integral" ? "devolvida_integral" : "desconto_confirmado");

export { disputaAberta } from "./devolucao-maquina";

/**
 * Os botões de cada lado (8.4-5): o morador responde em Minhas locações; o dono vê a caução em Contratos, onde está o
 * estado da devolução, a linha da disputa e o anexo — na lista ancorada no contrato (ORDEM-DUET 1359, ajuste 1).
 */
export const URL_DO_MORADOR = "/dashboard/locacoes";
export const urlDoDono = (contratoId: string) => `/dashboard/contratos#contrato-${contratoId}`;

export const valorDoAcerto = (a: Pick<Acerto, "valor_devolvido">) => Number(a.valor_devolvido ?? 0);

/** Os avisos do morador que saem quando ele responde, ou quando a falta de resposta confirma. */
export const AVISOS_DO_MORADOR: NotificationEvent[] = ["caucao_devolucao_registrada", "caucao_devolucao_lembrete"];
/** Os avisos do dono que saem na decisão da Central (o pedido e o lembrete do anexo saem também no anexo). */
export const AVISOS_DO_DONO_NA_DISPUTA: NotificationEvent[] = ["caucao_devolucao_contestada", "caucao_comprovante_pedido", "caucao_comprovante_lembrete"];

/** As duas partes do contrato (o dono é o do imóvel). */
export async function partesDoContrato(admin: Admin, contratoId: string): Promise<{ dono: string | null; morador: string | null; status: string | null } | null> {
  const { data: c, error } = await admin.from("contratos").select("id, status, tenant_id, properties!inner(owner_id)").eq("id", contratoId).maybeSingle();
  if (error || !c) return null;
  return { dono: (c.properties as { owner_id: string | null } | null)?.owner_id ?? null, morador: (c.tenant_id as string | null) ?? null, status: (c.status as string | null) ?? null };
}

/** O resultado de um envio: o de cada canal (true, false, ou "demo" no laboratório). Sem destinatário, null. */
export type ResultadoDoEnvio = { email?: boolean | "demo"; whatsapp?: boolean | "demo"; push?: boolean | "demo" } | null;

/** Algum canal entregou (ou o laboratório simulou a entrega)? */
export const algumCanalEntregou = (r: ResultadoDoEnvio) => !!r && [r.email, r.whatsapp, r.push].some((v) => v === true || v === "demo");

/**
 * Um envio da máquina: o aviso leva o texto do coordenador e o contrato como referência; o e-mail leva o mesmo texto.
 * Devolve o resultado do notify, que NUNCA lança (ORDEM-DUET 1361): quem precisa de saber se o aviso saiu lê-o.
 */
export async function enviar(
  admin: Admin,
  p: { evento: NotificationEvent; userId: string | null; papel: PapelAviso; contratoId: string; url: string; texto: string; cta?: string },
): Promise<ResultadoDoEnvio> {
  if (!p.userId) return null;
  const u = await admin.auth?.admin?.getUserById?.(p.userId).catch(() => null);
  return await notify({
    event: p.evento,
    email: u?.data?.user?.email ?? undefined,
    userId: p.userId,
    papelAviso: p.papel,
    refId: p.contratoId,
    pushUrl: p.url,
    textoAviso: p.texto,
    body: (n?: string) => `Olá${n ? " " + n : ""}. ${p.texto}`,
    ...(p.cta ? { ctaLabel: p.cta } : {}),
  });
}

/** O envio que nunca derruba quem chama (os avisos depois de uma gravação que já deu certo). */
export async function enviarSemFalhar(admin: Admin, p: Parameters<typeof enviar>[1]): Promise<void> {
  try {
    await enviar(admin, p);
  } catch (e) {
    console.error("[devolucao-caucao] o envio falhou:", p.evento, e instanceof Error ? e.message : e);
  }
}

export async function lerAcerto(admin: Admin, id: string): Promise<{ acerto: Acerto | null; erro: boolean }> {
  const { data, error } = await admin.from("caucao_acertos").select(COLUNAS_DO_ACERTO).eq("id", id).maybeSingle();
  return { acerto: (data as Acerto | null) ?? null, erro: !!error };
}

/**
 * A confirmação por falta de resposta (2.3): só um acerto à espera, com a hora do aviso, e com o prazo terminado em
 * `agora`. A gravação é condicional (o morador pode responder no mesmo instante: ganha quem mudou a linha) e a hora
 * gravada é a do FIM do prazo. Devolve true quando foi esta chamada que confirmou.
 */
export async function confirmarPorFaltaDeResposta(admin: Admin, acertoId: string, agora: Date = new Date()): Promise<boolean> {
  const { acerto: a } = await lerAcerto(admin, acertoId);
  if (!a || a.status !== "aguardando_confirmacao" || !a.aviso_em) return false;
  if (!prazoDeRespostaTerminou(a.aviso_em, agora)) return false;
  const fim = fimDoPrazoDeResposta(a.aviso_em).toISOString();
  const { data: mudou, error } = await admin
    .from("caucao_acertos")
    .update({ status: statusConfirmado(a.tipo), confirmado_em: fim, confirmacao_via: "falta_de_resposta" })
    .eq("id", a.id)
    .eq("status", "aguardando_confirmacao")
    .select("id");
  if (error || !mudou?.length) return false;
  try {
    await emitirTermoDevolucaoComRegistro(a.id);
  } catch (e) {
    console.error("[devolucao-caucao] o termo não saiu:", e instanceof Error ? e.message : e);
  }
  const partes = await partesDoContrato(admin, a.contrato_id);
  const valor = valorDoAcerto(a);
  await resolverAvisosDaReferencia(admin, { eventos: AVISOS_DO_MORADOR, refId: a.contrato_id, usuarioId: partes?.morador ?? null }).catch(() => undefined);
  if (partes) {
    await enviarSemFalhar(admin, { evento: "caucao_devolucao_sem_resposta", userId: partes.morador, papel: "morador", contratoId: a.contrato_id, url: URL_DO_MORADOR, texto: textoFimDoPrazoAoMorador({ valor, registradoEm: a.created_at }), cta: "Ver a caução" });
    await enviarSemFalhar(admin, { evento: "caucao_devolucao_sem_resposta", userId: partes.dono, papel: "dono", contratoId: a.contrato_id, url: urlDoDono(a.contrato_id), texto: textoFimDoPrazoAoDono({ valor }), cta: "Ver a caução" });
  }
  return true;
}

/**
 * A rotina de hora a hora (decidido, ORDENS 1322 e 1325): a falta de resposta, o lembrete do morador e o lembrete do
 * anexo. Correr duas vezes dá o mesmo (M5): cada passo grava antes de enviar, com a condição de a linha não ter mudado.
 */
export async function rodarDevolucaoCaucao(admin: Admin, agora: Date = new Date()): Promise<{ confirmados: number; lembretes: number; lembretesDoAnexo: number; avisosReenviados: number; chamadosAbertos: number }> {
  const r = { confirmados: 0, lembretes: 0, lembretesDoAnexo: 0, avisosReenviados: 0, chamadosAbertos: 0 };
  // 0. ORDEM-DUET 1359 (correção 1): o aviso do registro que falhou volta a ser enviado; a hora grava-se só no envio que
  // dá certo. Sem ela, o acerto nunca confirma por falta de resposta (o passo 1 não o lê).
  const { data: semAviso } = await admin.from("caucao_acertos").select(COLUNAS_DO_ACERTO).eq("status", "aguardando_confirmacao").is("aviso_em", null);
  for (const a of (semAviso ?? []) as Acerto[]) {
    try {
      if (await enviarAvisoDoRegistro(admin, a, agora)) r.avisosReenviados++;
    } catch (e) {
      console.error("[devolucao-caucao] o aviso do registro falhou outra vez:", a.id, e instanceof Error ? e.message : e);
    }
  }
  // 1. A falta de resposta: o aviso saiu há 5 vezes 24 horas ou mais.
  const limite = new Date(agora.getTime() - PRAZO_HORAS * H).toISOString();
  const { data: vencidos } = await admin.from("caucao_acertos").select("id").eq("status", "aguardando_confirmacao").not("aviso_em", "is", null).lte("aviso_em", limite);
  for (const v of (vencidos ?? []) as { id: string }[]) if (await confirmarPorFaltaDeResposta(admin, v.id, agora)) r.confirmados++;

  // 2. O lembrete do morador, nas últimas 24 horas (texto 5, crítico), uma vez só.
  const desde = new Date(agora.getTime() - (PRAZO_HORAS - LEMBRETE_HORAS) * H).toISOString();
  const { data: aLembrar } = await admin.from("caucao_acertos").select(COLUNAS_DO_ACERTO).eq("status", "aguardando_confirmacao").not("aviso_em", "is", null).is("lembrete_em", null).lte("aviso_em", desde);
  for (const a of (aLembrar ?? []) as Acerto[]) {
    if (!a.aviso_em || !naJanelaDoLembrete(a.aviso_em, agora)) continue;
    const { data: mudou } = await admin.from("caucao_acertos").update({ lembrete_em: agora.toISOString() }).eq("id", a.id).eq("status", "aguardando_confirmacao").is("lembrete_em", null).select("id");
    if (!mudou?.length) continue;
    const partes = await partesDoContrato(admin, a.contrato_id);
    await enviarSemFalhar(admin, { evento: "caucao_devolucao_lembrete", userId: partes?.morador ?? null, papel: "morador", contratoId: a.contrato_id, url: URL_DO_MORADOR, texto: textoLembrete({ valor: valorDoAcerto(a), avisoEm: a.aviso_em }), cta: "Confirmar ou contestar" });
    r.lembretes++;
  }

  // 3. O lembrete do anexo, nas últimas 24 horas do prazo do pedido, sem comprovante e sem decisão (crítico), uma vez só.
  const { data: semAnexo } = await admin
    .from("caucao_acertos")
    .select(COLUNAS_DO_ACERTO)
    .eq("status", "desconto_contestado")
    .not("comprovante_pedido_em", "is", null)
    .is("comprovante_anexado_em", null)
    .is("central_decisao", null)
    .is("comprovante_lembrete_em", null)
    .lte("comprovante_pedido_em", desde);
  for (const a of (semAnexo ?? []) as Acerto[]) {
    if (!a.comprovante_pedido_em || !naJanelaDoLembreteDoAnexo(a.comprovante_pedido_em, agora)) continue;
    const { data: mudou } = await admin
      .from("caucao_acertos")
      .update({ comprovante_lembrete_em: agora.toISOString() })
      .eq("id", a.id)
      .is("comprovante_lembrete_em", null)
      .is("comprovante_anexado_em", null)
      .is("central_decisao", null)
      .select("id");
    if (!mudou?.length) continue;
    const partes = await partesDoContrato(admin, a.contrato_id);
    await enviarSemFalhar(admin, { evento: "caucao_comprovante_lembrete", userId: partes?.dono ?? null, papel: "dono", contratoId: a.contrato_id, url: urlDoDono(a.contrato_id), texto: textoLembreteDoAnexo({ meio: a.meio, valor: valorDoAcerto(a), pedidoEm: a.comprovante_pedido_em }), cta: "Anexar o comprovante" });
    r.lembretesDoAnexo++;
  }

  // 4. ORDEM-DUET 1359 (correção 2): a contestação que ficou sem chamado ganha-o aqui (sem duplicar). A contestação dos
  // últimos minutos é da própria ação, que pode estar a abri-lo: espera.
  const antesDe = new Date(agora.getTime() - ESPERA_DA_ACAO_MIN * 60_000).toISOString();
  const { data: semChamado } = await admin
    .from("caucao_acertos")
    .select(COLUNAS_DO_ACERTO)
    .eq("status", "desconto_contestado")
    .not("contestado_em", "is", null)
    .is("chamado_id", null)
    .is("central_decisao", null)
    .lte("contestado_em", antesDe);
  for (const a of (semChamado ?? []) as Acerto[]) {
    const partes = await partesDoContrato(admin, a.contrato_id);
    if (!partes?.morador || !a.contestado_em) continue;
    const { assunto, mensagem } = mensagemDaContestacao(a, { motivo: a.contestacao_motivo ?? "(sem motivo gravado)", contestadoEm: a.contestado_em, pedidoEm: a.comprovante_anexado_em ? null : a.comprovante_pedido_em });
    const ch = await abrirChamadoPeloServidor(admin, { usuarioId: partes.morador, contratoId: a.contrato_id, assunto, mensagem }, agora).catch(() => null);
    if (!ch) continue;
    if (await ligarChamadoAoAcerto(admin, a, ch)) r.chamadosAbertos++;
    else console.error("[devolucao-caucao] o chamado aberto pela rotina chegou tarde: o acerto já tinha outro:", a.id, ch.id);
  }
  return r;
}
