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
import {
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

/** O estado confirmado pelo tipo do acerto: a parcial segue a mesma tabela da total (M14). */
export const statusConfirmado = (tipo: string) => (tipo === "devolucao_integral" ? "devolvida_integral" : "desconto_confirmado");

export { disputaAberta } from "./devolucao-maquina";

/**
 * Os botões de cada lado (8.4-5): o morador responde em Minhas locações; o dono vê a caução em Contratos, onde está o
 * estado da devolução, a linha da disputa e o anexo (a página de um contrato não mostra a devolução).
 */
export const URL_DO_MORADOR = "/dashboard/locacoes";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const urlDoDono = (_contratoId: string) => "/dashboard/contratos";

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

/**
 * Um envio da máquina: o aviso leva o texto do coordenador e o contrato como referência; o e-mail leva o mesmo texto.
 * Lança se o envio lançar (o registro precisa de saber se o aviso saiu, M4).
 */
export async function enviar(
  admin: Admin,
  p: { evento: NotificationEvent; userId: string | null; papel: PapelAviso; contratoId: string; url: string; texto: string; cta?: string },
): Promise<void> {
  if (!p.userId) return;
  const u = await admin.auth?.admin?.getUserById?.(p.userId).catch(() => null);
  await notify({
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
export async function rodarDevolucaoCaucao(admin: Admin, agora: Date = new Date()): Promise<{ confirmados: number; lembretes: number; lembretesDoAnexo: number }> {
  const r = { confirmados: 0, lembretes: 0, lembretesDoAnexo: 0 };
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
  return r;
}
