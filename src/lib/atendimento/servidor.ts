import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { assuntoChamado, assuntoManutencao } from "@/lib/notifications/assuntos";
import { anuncioParaPausarPorCamera, type ContratoParaCamera } from "@/lib/atendimento/camera-anuncio";
import { textoEmail } from "@/lib/notifications/texto-seguro";
import { SITE_URL, SUPORTE_EMAIL } from "@/lib/site";
import { PRAZOS, PROMESSA_ATENDIMENTO, PRAZO_MANUTENCAO_H, prazoManutencao, type Prioridade, type UrgenciaManutencao } from "@/config/atendimento";
import { guardContactInfo } from "@/lib/messages/contact-guard";
import { urgenciaManutencao } from "@/lib/atendimento/classificar";
import { situacaoLimite } from "@/lib/limites";
import { equipeAvisadaDaMensagem, JANELA_AVISO_EQUIPE_S } from "@/lib/atendimento/dono";
import { adminsPorAviso } from "@/lib/notifications/push-admins";
import { notificacaoLigada } from "@/lib/notifications/preferencias";
import { COLUNAS_VIGENCIA, contratoPermiteManutencao, type ContratoParaManutencao } from "@/lib/manutencao-solicitacoes";
import { estadoSolucao } from "@/lib/manutencao-solucao";

/** Prompt 59: "Resolver até [hora]" na abertura (urgente: a provisória e a definitiva). */
function fraseSolucao(urgencia: UrgenciaManutencao, abertaEm: Date): string {
  const s = estadoSolucao({ priority: urgencia, openedAt: abertaEm.toISOString(), status: "aberto" }, abertaEm);
  const r = s.texto.charAt(0).toUpperCase() + s.texto.slice(1);
  return s.provisoria ? `Solução provisória até ${s.provisoria.ate.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}. ${r}` : r;
}

/**
 * Atendimento — utilidades SÓ DO SERVIDOR: token da nota de 1 a 5 (um clique,
 * sem login), avisos à equipe e e-mails ao usuário. Nunca importar no cliente.
 */

function segredo(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "viva-nomads";
}

/** Assinatura do link "dê uma nota" (chamado + nota). */
export function assinarNota(chamadoId: string, nota: number): string {
  return crypto.createHmac("sha256", segredo()).update(`nota:${chamadoId}:${nota}`).digest("hex").slice(0, 32);
}

export function notaValida(chamadoId: string, nota: number, assinatura: string): boolean {
  if (!/^[0-9a-f]{32}$/.test(assinatura)) return false;
  const esperado = Buffer.from(assinarNota(chamadoId, nota));
  return crypto.timingSafeEqual(esperado, Buffer.from(assinatura));
}

export function linkNota(chamadoId: string, nota: number): string {
  return `${SITE_URL}/api/atendimento/avaliar?c=${chamadoId}&n=${nota}&s=${assinarNota(chamadoId, nota)}`;
}

/** Link "Falar com uma pessoa" do e-mail (assinado; funciona sem login). Abre a
 *  Central com um botão de confirmação: robôs que abrem links de e-mail não
 *  passam o chamado sozinhos. */
function assinarPessoa(chamadoId: string): string {
  return crypto.createHmac("sha256", segredo()).update(`pessoa:${chamadoId}`).digest("hex").slice(0, 32);
}

export function pessoaValida(chamadoId: string, assinatura: string): boolean {
  if (!/^[0-9a-f]{32}$/.test(assinatura)) return false;
  return crypto.timingSafeEqual(Buffer.from(assinarPessoa(chamadoId)), Buffer.from(assinatura));
}

export function linkPessoa(chamadoId: string): string {
  return `${SITE_URL}/ajuda?pessoa=${chamadoId}&s=${assinarPessoa(chamadoId)}`;
}

export interface ChamadoResumo {
  id: string;
  numero_publico: string;
  assunto: string;
  prioridade: Prioridade;
  usuario_id: string | null;
  visitante_email?: string | null;
  visitante_nome?: string | null;
}

/** Destinatário do chamado: perfil (com preferências) ou visitante. */
async function destinatario(c: ChamadoResumo) {
  const admin = createAdminClient();
  if (c.usuario_id && admin) {
    const { data } = await admin
      .from("profiles")
      .select("email, full_name, notif_email")
      .eq("id", c.usuario_id)
      .maybeSingle();
    if (!data) return null;
    return {
      email: data.notif_email === false ? undefined : ((data.email as string) ?? undefined),
      nome: (data.full_name as string) ?? undefined,
      // Prompt 30, item 8: sem aviso por WhatsApp (ficam e-mail e o aviso no app); o canal da Viva é "Falar com a Viva".
      phone: undefined,
      userId: c.usuario_id,
    };
  }
  if (c.visitante_email) return { email: c.visitante_email, nome: c.visitante_nome ?? undefined, phone: undefined, userId: undefined };
  return null;
}

function linkChamado(c: ChamadoResumo): string {
  return c.usuario_id ? `${SITE_URL}/ajuda?chamado=${c.numero_publico}` : `${SITE_URL}/ajuda`;
}

/** E-mail ao usuário (abertura, resposta, resolução) e o aviso no app. */
export async function avisarUsuario(
  c: ChamadoResumo,
  evento: "chamado_aberto" | "chamado_respondido" | "chamado_resolvido",
  extraHtml = ""
): Promise<void> {
  const d = await destinatario(c);
  if (!d) return;
  const numero = textoEmail(c.numero_publico, 20);
  let notas = "";
  if (evento === "chamado_resolvido") {
    notas = `<p style="margin:16px 0 6px;color:#0f1722;font-weight:600;">Como foi o atendimento? (1 = ruim, 5 = ótimo)</p><p style="margin:0;">${[1, 2, 3, 4, 5]
      .map(
        (n) =>
          `<a href="${linkNota(c.id, n)}" style="display:inline-block;margin:0 6px 6px 0;padding:8px 14px;border:1px solid #dce9e0;border-radius:10px;color:#1c6b3a;text-decoration:none;font-weight:600;">${n}</a>`
      )
      .join("")}</p>`;
  }
  await notify({
    event: evento,
    email: d.email,
    name: d.nome,
    phone: evento === "chamado_respondido" ? d.phone : undefined,
    userId: d.userId,
    pushUrl: "/ajuda",
    subject: assuntoChamado(evento, c.numero_publico),
    detailsText: `Chamado ${c.numero_publico}: ${linkChamado(c)}`,
    detailsHtml: `<p style="margin:12px 0 0;color:#334155;">Chamado <strong>${numero}</strong> · ${textoEmail(c.assunto, 140)}</p>${extraHtml}${notas}<p style="margin:16px 0 0;"><a href="${linkChamado(c)}" style="color:#1c6b3a;font-weight:600;">${c.usuario_id ? "Acompanhar o chamado" : "Abrir a Central de Ajuda"}</a></p><p style="margin:12px 0 0;color:#64748b;font-size:13px;">Dúvidas: ${SUPORTE_EMAIL}. ${PROMESSA_ATENDIMENTO}.</p>`,
  }).catch(() => null);
}

/** Avisa os admins (e-mail + push): P1/P2, aprovação, prazo em risco. */
export async function avisarEquipe(c: ChamadoResumo, motivo: string, detalhesHtml?: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  // Chamado de conta de teste / simulação nunca acorda a equipe (ordem 7436a29a, item 3).
  const { data: sim } = await admin.from("chamados").select("simulacao").eq("id", c.id).maybeSingle();
  if (sim?.simulacao) return;
  // Só admins que ligaram "receber alertas" na Conta (ordem 27cfd36a); admin novo nasce desligado.
  const admins = await adminsPorAviso<{ email: string | null; full_name: string | null; notif_email: boolean | null }>("operacional", "email, full_name, notif_email");
  const rotulo = PRAZOS[c.prioridade]?.rotulo ?? c.prioridade;
  for (const a of admins) {
    await notify({
      event: "chamado_equipe",
      email: a.notif_email === false ? undefined : ((a.email as string) ?? undefined),
      name: (a.full_name as string) ?? undefined,
      userId: a.id as string,
      pushUrl: `/admin/atendimento/${c.id}`,
      interno: true,
      subject: `${c.prioridade.toUpperCase()} ${rotulo} — ${c.numero_publico}: ${motivo}`,
      detailsHtml:
        detalhesHtml ??
        `<p style="margin:12px 0 0;color:#334155;"><strong>${textoEmail(c.numero_publico, 20)}</strong> · ${textoEmail(c.assunto, 140)}<br/>${textoEmail(motivo, 200)}</p><p style="margin:16px 0 0;"><a href="${SITE_URL}/admin/atendimento/${c.id}" style="color:#1c6b3a;font-weight:600;">Abrir no admin</a></p>`,
    }).catch(() => null);
  }
}

/**
 * A pessoa respondeu (pela Central ou por e-mail): registra no histórico e, se
 * quem atende é a equipe, avisa os admins — no máximo 1 aviso por chamado a
 * cada 15 min. Se o limitador falhar, avisa assim mesmo (melhor um e-mail a
 * mais que uma mensagem esquecida).
 */
export async function registrarMensagemDaPessoa(
  c: ChamadoResumo & { responsavel_tipo: string; status: string },
  autorId: string | null,
  canal: "site" | "email",
  /** false: quem chama roda o responderNaEquipe, que manda o e-mail já com a sugestão. */
  avisar = true
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from("chamado_eventos").insert({ chamado_id: c.id, ator_tipo: "usuario", ator_id: autorId, acao: "mensagem", detalhe: canal === "email" ? "por e-mail" : "pela Central de Ajuda" });
  if (!avisar || !equipeAvisadaDaMensagem(c)) return;
  if ((await situacaoLimite(`equipe-msg:${c.id}`, 1, JANELA_AVISO_EQUIPE_S)) === "estourou") return;
  await avisarEquipe(c, "nova mensagem da pessoa");
}

// ── Manutenção (formulário e Viva usam a MESMA regra) ──────────────────────
const CATEGORIAS_SO = ["hidraulica", "eletrica", "eletrodomesticos", "estrutura", "internet", "outros"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface OrdemCriada {
  serviceOrderId: string;
  urgencia: UrgenciaManutencao;
  ownerId: string;
  propertyTitle: string;
}

/**
 * Abre a ordem de manutenção para o proprietário, no contrato ATIVO da pessoa
 * inquilina. Sem contrato informado, usa o único contrato ativo (se houver só um).
 * A urgência é a maior entre a escolhida e a que o texto indica (falta de água = urgente).
 */
export async function criarOrdemManutencao(input: {
  tenantId: string;
  contratoId: string | null;
  mensagem: string;
  urgencia?: UrgenciaManutencao;
  categoria?: string;
}): Promise<{ ok: true; ordem: OrdemCriada } | { ok: false; error: string }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Indisponível no momento." };
  let contratoId = input.contratoId;
  if (!contratoId) {
    const { data: candidatos } = await admin.from("contratos").select(`id, ${COLUNAS_VIGENCIA}`).eq("tenant_id", input.tenantId).in("status", ["ativo", "encerrado_em_acerto"]).limit(20);
    const ativos = (candidatos ?? []).filter((c) => contratoPermiteManutencao(c as ContratoParaManutencao));
    if (!ativos || ativos.length === 0) return { ok: false, error: "Manutenção só pode ser pedida no contrato ativo do seu imóvel." };
    if (ativos.length > 1) return { ok: false, error: "Há mais de um contrato ativo: diga em qual imóvel é o problema." };
    contratoId = ativos[0].id as string;
  }
  if (!UUID_RE.test(contratoId)) return { ok: false, error: "Escolha o contrato do imóvel." };
  const { data: ct } = await admin
    .from("contratos")
    .select(`id, tenant_id, property_id, ${COLUNAS_VIGENCIA}, properties(owner_id, title)`)
    .eq("id", contratoId)
    .maybeSingle();
  const prop = ct?.properties as { owner_id?: string; title?: string } | null;
  if (!ct || ct.tenant_id !== input.tenantId || !contratoPermiteManutencao(ct as ContratoParaManutencao) || !prop?.owner_id) {
    return { ok: false, error: "Manutenção só pode ser pedida no contrato ativo do seu imóvel." };
  }
  const urgencia = urgenciaManutencao(input.mensagem, input.urgencia);
  const categoria = (CATEGORIAS_SO as readonly string[]).includes(input.categoria ?? "") ? input.categoria : "outros";
  const { data: so, error } = await admin
    .from("service_orders")
    .insert({
      contract_id: null, // aponta para a tabela antiga "contracts"; o vínculo real é contrato_id (0118)
      contrato_id: ct.id as string,
      property_id: ct.property_id,
      tenant_id: input.tenantId,
      owner_id: prop.owner_id,
      category: categoria,
      priority: urgencia,
      description: guardContactInfo(input.mensagem.trim().slice(0, 2000)).text,
      status: "aberto",
    })
    .select("id")
    .single();
  if (error || !so) {
    console.error("[atendimento] ordem de manutenção:", error?.message);
    return { ok: false, error: "Não foi possível registrar a manutenção agora. Tente de novo." };
  }
  // Histórico da ordem (0109): a abertura é a primeira linha. Falha aqui não desfaz a ordem.
  const { error: eHist } = await admin
    .from("service_order_eventos")
    .insert({ service_order_id: so.id, ator_id: input.tenantId, papel: "inquilino", tipo: "aberto", status_para: "aberto" });
  if (eHist) console.error("[atendimento] histórico da ordem:", eHist.code);
  return { ok: true, ordem: { serviceOrderId: so.id as string, urgencia, ownerId: prop.owner_id, propertyTitle: prop.title ?? "seu imóvel" } };
}

/** E-mail ao proprietário: manutenção nova (ou lembrete), com o prazo. */
export async function avisarProprietarioManutencao(ordem: OrdemCriada, agora: Date, lembrete = false): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const { data: dono } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", ordem.ownerId).maybeSingle();
  if (!dono?.email || !notificacaoLigada(dono.notif_email as boolean | null)) return;
  await notify({
    event: "manutencao_nova",
    email: dono.email as string,
    name: (dono.full_name as string) ?? undefined,
    userId: ordem.ownerId,
    pushUrl: "/dashboard/solicitacoes",
    subject: assuntoManutencao({ urgente: ordem.urgencia === "urgente", lembrete }),
    // A urgência e o prazo vão no corpo (o assunto não grita).
    detailsHtml: `<p style="margin:12px 0 0;color:#334155;">Imóvel: <strong>${textoEmail(ordem.propertyTitle, 120)}</strong><br/>Urgência: ${ordem.urgencia === "urgente" ? "urgente" : "normal"} · responda em até ${PRAZO_MANUTENCAO_H[ordem.urgencia]} h<br/>Prazo para responder: até ${prazoManutencao(ordem.urgencia, agora).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}.<br/>${textoEmail(fraseSolucao(ordem.urgencia, agora), 200)}.</p>`,
  }).catch(() => null);
}

/**
 * Câmera escondida: tira o anúncio da busca (status "paused") e deixa o rastro no chamado.
 * Só o inquilino do contrato aciona; anúncio que não está ativo não muda. Devolve se pausou.
 */
export async function pausarAnuncioPorCamera(chamadoId: string, usuarioId: string | null, contratoId: string | null): Promise<boolean> {
  if (!usuarioId || !contratoId) return false;
  const admin = createAdminClient();
  if (!admin) return false;
  const { data: ct } = await admin.from("contratos").select("status, tenant_id, property_id").eq("id", contratoId).maybeSingle();
  const propId = anuncioParaPausarPorCamera("camera", usuarioId, (ct as ContratoParaCamera | null) ?? null);
  if (!propId) return false;
  const { data: pausado } = await admin.from("properties").update({ status: "paused", pausa_motivo: "camera" }).eq("id", propId).eq("status", "active").select("id");
  if (!pausado?.length) return false;
  await admin.from("chamado_eventos").insert({ chamado_id: chamadoId, ator_tipo: "sistema", acao: "anuncio_pausado", detalhe: "câmera/dispositivo de gravação: anúncio fora da busca até a equipe decidir" });
  return true;
}
