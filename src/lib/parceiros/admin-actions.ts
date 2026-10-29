"use server";

import { sessaoAal2 } from "@/lib/data/admin-guard";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/fotografos/regras";
import { createAdminClient } from "@/lib/supabase/admin";
import { logModeracao } from "@/lib/data/moderacao-log";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/notifications/email";
import { emailParceriaAprovada } from "@/lib/notifications/montar-email";
import { textoEmail } from "@/lib/notifications/texto-seguro";
import { SITE_URL } from "@/lib/site";
import { checklistCompleto, expiraToken, ITENS_CHECKLIST, lerParceiroGeral } from "./regras";
import { gerarToken, hashToken } from "./token";
import { MOTIVO_NOTA_NAO_EMITIDA } from "./fiscal";
import { recusaObservador } from "@/lib/qa/observador";

// ── Prompt 31a: análise das solicitações de parceria (/admin/parceiros) ─────────────────────────────────────────
// Toda ação confere admin + 2FA (sessaoAal2) e grava pelo service_role; cada decisão vai para o moderacao_log.

type Res<T = null> = { ok: true; valor: T } | { ok: false; erro: string };

async function exigirAdminParceria() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (perfil?.role !== "admin" || !(await sessaoAal2(supabase))) return null;
  const admin = createAdminClient();
  return admin ? { supabase, admin, user } : null;
}

/** Alvo da decisão sobre um pedido de parceria: a conta de quem pediu (sem conta = real, para o observador da QA). */
async function alvoDaSolicitacao(admin: NonNullable<ReturnType<typeof createAdminClient>>, id: string) {
  const { data } = await admin.from("parceiro_solicitacoes").select("user_id").eq("id", id).maybeSingle();
  const uid = (data?.user_id as string | null) ?? null;
  return { perfis: [uid], semPerfil: uid ? 0 : 1 };
}

function revalidar() {
  revalidatePath("/admin/parceiros");
}

/** Marca/desmarca itens do checklist da ficha ("conferido em" do documento é gravado ao marcar). */
export async function salvarChecklistParceria(id: string, entrada: Record<string, unknown>): Promise<Res<Record<string, unknown>>> {
  if (!ehUuid(id)) return { ok: false, erro: "Registro inválido." };
  const a = await exigirAdminParceria();
  if (!a) return { ok: false, erro: "Sem permissão." };
  const recusaQa = await recusaObservador(a.user.id, await alvoDaSolicitacao(a.admin, id));
  if (recusaQa) return { ok: false, erro: recusaQa };
  const { data: sol } = await a.admin.from("parceiro_solicitacoes").select("checklist, status").eq("id", id).maybeSingle();
  if (!sol) return { ok: false, erro: "Pedido não encontrado." };
  if (sol.status !== "pendente") return { ok: false, erro: "Só pedidos pendentes podem ser conferidos." };
  const atual = (sol.checklist ?? {}) as Record<string, unknown>;
  const novo: Record<string, unknown> = { ...atual };
  for (const i of ITENS_CHECKLIST) if (typeof entrada[i.chave] === "boolean") novo[i.chave] = entrada[i.chave];
  if (typeof entrada.identidade_manual === "boolean") novo.identidade_manual = entrada.identidade_manual;
  if (novo.documento === true && !atual.documento_conferido_em) novo.documento_conferido_em = new Date().toISOString();
  if (novo.documento !== true) delete novo.documento_conferido_em;
  novo.conferido_por = a.user.id;
  const { error } = await a.admin.from("parceiro_solicitacoes").update({ checklist: novo, atualizado_em: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível salvar." };
  revalidar();
  return { ok: true, valor: novo };
}

/** Gera um token novo (o antigo deixa de valer) e manda o e-mail de ativação (link só no botão). */
async function enviarAtivacao(admin: NonNullable<ReturnType<typeof createAdminClient>>, sol: { id: string; email: string; nome: string; user_id: string | null }) {
  const token = gerarToken();
  const agora = new Date();
  const { error } = await admin
    .from("parceiro_solicitacoes")
    .update({ token_ativacao_hash: hashToken(token), token_expira_em: expiraToken(agora), atualizado_em: agora.toISOString() })
    .eq("id", sol.id);
  if (error) return false;
  const m = emailParceriaAprovada(SITE_URL, { url: `${SITE_URL}/parceiros/ativar?t=${encodeURIComponent(token)}`, nome: sol.nome });
  await sendEmail({ to: sol.email, subject: m.titulo, html: m.html, text: m.text, evento: "parceria_aprovada", imagem: m.imagem, usuarioId: sol.user_id ?? undefined }).catch(() => {});
  return true;
}

export async function aprovarSolicitacao(id: string): Promise<Res> {
  if (!ehUuid(id)) return { ok: false, erro: "Registro inválido." };
  const a = await exigirAdminParceria();
  if (!a) return { ok: false, erro: "Sem permissão." };
  const recusaQa = await recusaObservador(a.user.id, await alvoDaSolicitacao(a.admin, id));
  if (recusaQa) return { ok: false, erro: recusaQa };
  const { data: sol } = await a.admin.from("parceiro_solicitacoes").select("id, email, nome, user_id, status, checklist, documento").eq("id", id).maybeSingle();
  if (!sol) return { ok: false, erro: "Pedido não encontrado." };
  if (sol.status !== "pendente") return { ok: false, erro: "Este pedido não está pendente." };
  if (!sol.email || !sol.documento) return { ok: false, erro: "Faltam e-mail ou documento: peça para a pessoa completar o pedido." };
  if (!checklistCompleto(sol.checklist as Record<string, unknown>)) return { ok: false, erro: "Complete o checklist antes de aprovar." };
  const token = gerarToken();
  const agora = new Date();
  // Só aprova se ainda estiver pendente (dois admins ao mesmo tempo não aprovam duas vezes).
  const { data: upd, error } = await a.admin
    .from("parceiro_solicitacoes")
    .update({ status: "aprovada", decidido_por: a.user.id, decidido_em: agora.toISOString(), token_ativacao_hash: hashToken(token), token_expira_em: expiraToken(agora), atualizado_em: agora.toISOString() })
    .eq("id", id)
    .eq("status", "pendente")
    .select("id");
  if (error || !upd?.length) return { ok: false, erro: "Não foi possível aprovar agora." };
  const m = emailParceriaAprovada(SITE_URL, { url: `${SITE_URL}/parceiros/ativar?t=${encodeURIComponent(token)}`, nome: sol.nome as string });
  await sendEmail({ to: sol.email as string, subject: m.titulo, html: m.html, text: m.text, evento: "parceria_aprovada", imagem: m.imagem, usuarioId: (sol.user_id as string | null) ?? undefined }).catch(() => {});
  await logModeracao(a.supabase, a.user.id, "parceria_aprovada", "parceiro_solicitacao", id);
  revalidar();
  return { ok: true, valor: null };
}

export async function recusarSolicitacao(id: string, motivo: string): Promise<Res> {
  if (!ehUuid(id)) return { ok: false, erro: "Registro inválido." };
  const texto = String(motivo ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (texto.length < 10) return { ok: false, erro: "Escreva o motivo (ou escolha um modelo)." };
  const a = await exigirAdminParceria();
  if (!a) return { ok: false, erro: "Sem permissão." };
  const recusaQa = await recusaObservador(a.user.id, await alvoDaSolicitacao(a.admin, id));
  if (recusaQa) return { ok: false, erro: recusaQa };
  const { data: sol } = await a.admin.from("parceiro_solicitacoes").select("id, email, nome, user_id, status").eq("id", id).maybeSingle();
  if (!sol) return { ok: false, erro: "Pedido não encontrado." };
  if (!["pendente", "aguardando_email", "aprovada"].includes(sol.status as string)) return { ok: false, erro: "Este pedido já foi decidido." };
  const { error } = await a.admin
    .from("parceiro_solicitacoes")
    .update({ status: "recusada", motivo_recusa: texto, decidido_por: a.user.id, decidido_em: new Date().toISOString(), token_ativacao_hash: null, token_expira_em: null, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível recusar agora." };
  if (sol.email) {
    await notify({ event: "parceria_recusada", email: sol.email as string, name: sol.nome as string, userId: (sol.user_id as string | null) ?? undefined, pushUrl: "/dashboard/parceiro", detailsHtml: `<p><strong>Motivo:</strong> ${textoEmail(texto, 500)}</p>`, detailsText: `Motivo: ${texto}` });
  }
  await logModeracao(a.supabase, a.user.id, "parceria_recusada", "parceiro_solicitacao", id, texto);
  revalidar();
  return { ok: true, valor: null };
}

/** Reenvia a ativação: token novo; o link antigo deixa de valer. */
export async function reenviarAtivacao(id: string): Promise<Res> {
  if (!ehUuid(id)) return { ok: false, erro: "Registro inválido." };
  const a = await exigirAdminParceria();
  if (!a) return { ok: false, erro: "Sem permissão." };
  const recusaQa = await recusaObservador(a.user.id, await alvoDaSolicitacao(a.admin, id));
  if (recusaQa) return { ok: false, erro: recusaQa };
  const { data: sol } = await a.admin.from("parceiro_solicitacoes").select("id, email, nome, user_id, status").eq("id", id).maybeSingle();
  if (!sol || sol.status !== "aprovada" || !sol.email) return { ok: false, erro: "Só pedidos aprovados (ainda não ativados) recebem um novo link." };
  if (!(await enviarAtivacao(a.admin, { id, email: sol.email as string, nome: sol.nome as string, user_id: (sol.user_id as string | null) ?? null }))) return { ok: false, erro: "Não foi possível reenviar agora." };
  await logModeracao(a.supabase, a.user.id, "parceria_ativacao_reenviada", "parceiro_solicitacao", id);
  revalidar();
  return { ok: true, valor: null };
}

/** Suspende o parceiro: a página sai do ar e da busca (a conta continua para alugar ou anunciar). */
export async function suspenderParceiro(parceiroId: string, motivo: string): Promise<Res> {
  if (!ehUuid(parceiroId)) return { ok: false, erro: "Registro inválido." };
  const texto = String(motivo ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (texto.length < 5) return { ok: false, erro: "Escreva o motivo da suspensão." };
  const a = await exigirAdminParceria();
  if (!a) return { ok: false, erro: "Sem permissão." };
  const { data: parc } = await a.admin.from("parceiros").select("user_id").eq("id", parceiroId).maybeSingle();
  const recusaQa = await recusaObservador(a.user.id, { perfis: [(parc?.user_id as string | null) ?? null], semPerfil: parc?.user_id ? 0 : 1 });
  if (recusaQa) return { ok: false, erro: recusaQa };
  const { error } = await a.admin.from("parceiros").update({ status: "suspenso", suspenso_motivo: texto, atualizado_em: new Date().toISOString() }).eq("id", parceiroId);
  if (error) return { ok: false, erro: "Não foi possível suspender agora." };
  await logModeracao(a.supabase, a.user.id, "parceiro_suspenso", "parceiro", parceiroId, texto);
  revalidar();
  return { ok: true, valor: null };
}

/**
 * FISCAL-PARCEIRO-B: denúncia "Não emitiu a nota fiscal declarada" julgada PROCEDENTE no chamado. Tira o selo
 * (emite_nota = false), registra o motivo e avisa o parceiro (e-mail + push pela matriz) — uma vez só: repetir não
 * avisa de novo. Só vale para chamado dessa categoria ligado a um parceiro PJ que declarou emitir nota.
 */
export async function denunciaNotaProcedente(chamadoId: string): Promise<Res> {
  if (!ehUuid(chamadoId)) return { ok: false, erro: "Registro inválido." };
  const a = await exigirAdminParceria();
  if (!a) return { ok: false, erro: "Sem permissão." };
  const recusaQa = await recusaObservador(a.user.id);
  if (recusaQa) return { ok: false, erro: recusaQa };
  const { data: ch } = await a.admin.from("chamados").select("id, categoria, contexto_tipo, contexto_id").eq("id", chamadoId).maybeSingle();
  if (!ch || ch.categoria !== "nota_parceiro" || ch.contexto_tipo !== "parceiro" || !ch.contexto_id) return { ok: false, erro: "Este chamado não é uma denúncia de nota fiscal de parceiro." };
  const { data: p } = await a.admin.from("parceiros").select("id, user_id, tipo_pessoa, emite_nota, nota_selo_removido_em").eq("id", ch.contexto_id).maybeSingle();
  if (!p) return { ok: false, erro: "Parceiro não encontrado." };
  if (p.nota_selo_removido_em) return { ok: true, valor: null };
  if (p.tipo_pessoa !== "pj" || p.emite_nota !== true) return { ok: false, erro: "Este parceiro não declara emitir nota fiscal: não há selo para tirar." };
  const agora = new Date().toISOString();
  const { data: feito, error } = await a.admin
    .from("parceiros")
    .update({ emite_nota: false, nota_selo_removido_em: agora, nota_selo_motivo: MOTIVO_NOTA_NAO_EMITIDA, atualizado_em: agora })
    .eq("id", p.id)
    .is("nota_selo_removido_em", null)
    .select("id");
  if (error) return { ok: false, erro: "Não foi possível tirar o selo agora." };
  if (!feito?.length) return { ok: true, valor: null };
  await a.admin.from("chamado_eventos").insert({ chamado_id: chamadoId, ator_tipo: "admin", ator_id: a.user.id, acao: "denuncia_procedente", para: "selo_nota_removido", detalhe: MOTIVO_NOTA_NAO_EMITIDA });
  await logModeracao(a.supabase, a.user.id, "parceiro_selo_nota_removido", "parceiro", p.id as string, MOTIVO_NOTA_NAO_EMITIDA);
  try {
    const { data: d } = await a.admin.from("profiles").select("email, full_name, notif_email").eq("id", p.user_id).maybeSingle();
    const dest = d as { email: string | null; full_name: string | null; notif_email: boolean | null } | null;
    await notify({ event: "parceiro_selo_nota_removido", email: dest?.notif_email === false ? undefined : (dest?.email ?? undefined), name: dest?.full_name ?? undefined, userId: p.user_id as string, pushUrl: "/dashboard/parceiro" });
  } catch {
    /* o aviso é complemento: o selo já saiu */
  }
  revalidatePath(`/admin/atendimento/${chamadoId}`);
  revalidatePath("/parceiros/buscar");
  return { ok: true, valor: null };
}

/** Suporte: a equipe abre o pedido por alguém (pelo e-mail). A pessoa recebe o convite, completa e confirma (LGPD). */
export async function criarSolicitacaoSuporte(entrada: { email: string; nome: string }): Promise<Res> {
  const email = String(entrada?.email ?? "").trim().toLowerCase();
  const nome = String(entrada?.nome ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, erro: "E-mail inválido." };
  if (nome.length < 3) return { ok: false, erro: "Informe o nome." };
  const a = await exigirAdminParceria();
  if (!a) return { ok: false, erro: "Sem permissão." };
  const recusaQa = await recusaObservador(a.user.id);
  if (recusaQa) return { ok: false, erro: recusaQa };
  const { data, error } = await a.admin.from("parceiro_solicitacoes").insert({ email, nome, status: "aguardando_email", origem: "suporte" }).select("id").single();
  if (error) return { ok: false, erro: error.code === "23505" ? "Já existe um pedido aberto para este e-mail." : "Não foi possível criar agora." };
  await notify({ event: "parceria_convite", email, name: nome, pushUrl: "/parceiros?seja=1#quero-ser-parceiro" });
  await logModeracao(a.supabase, a.user.id, "parceria_suporte_criada", "parceiro_solicitacao", data.id as string);
  revalidar();
  return { ok: true, valor: null };
}

/** Cartão do parceiro geral na busca vazia (chave PARCEIRO_GERAL_FALLBACK). Sem logo de terceiros. */
export async function definirParceiroGeral(entrada: { ligada: boolean; nome: string; cidade: string; descricao: string }): Promise<Res> {
  const a = await exigirAdminParceria();
  if (!a) return { ok: false, erro: "Sem permissão." };
  const recusaQa = await recusaObservador(a.user.id);
  if (recusaQa) return { ok: false, erro: recusaQa };
  const g = lerParceiroGeral(entrada, entrada?.ligada === true);
  if (g.ligado && !g.nome) return { ok: false, erro: "Informe o nome antes de ligar o cartão." };
  const agora = new Date().toISOString();
  const { error } = await a.admin
    .from("chaves_plataforma")
    .upsert({ chave: "PARCEIRO_GERAL_FALLBACK", ligada: g.ligado, ligada_em: g.ligado ? agora : null, alterada_em: agora, alterada_por: a.user.id, valor: { nome: g.nome, cidade: g.cidade, descricao: g.descricao } }, { onConflict: "chave" });
  if (error) return { ok: false, erro: "Não foi possível salvar." };
  await logModeracao(a.supabase, a.user.id, g.ligado ? "parceiro_geral_ligado" : "parceiro_geral_desligado", "chave_plataforma", a.user.id, "PARCEIRO_GERAL_FALLBACK");
  revalidar();
  revalidatePath("/parceiros/buscar");
  return { ok: true, valor: null };
}
