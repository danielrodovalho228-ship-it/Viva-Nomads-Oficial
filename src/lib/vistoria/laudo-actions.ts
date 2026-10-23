"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessaoAal2 } from "@/lib/data/admin-guard";
import { semMetadados } from "@/lib/foto-reconversao";
import { juntarRodadas, rodadaValida, validarLocal } from "@/lib/internet-medida";
import { coordenadasDoImovel } from "@/lib/internet-medida-servidor";
import { validarRespostasRuido } from "@/lib/niveis/regras";
import { itemChecklist, type ValorItem } from "@/config/checklist-avaliacao";
import { vistoriaAtiva } from "./chave";
import { podeContestar, valorValido } from "./laudo";
import { abrirContestacao, emitirLaudo, liberar, registrarCorrecao, type LinhaLaudo } from "./laudo-servidor";
import { porteDoImovel, precoVigente, type LinhaPreco, type Porte } from "./regras";
import { ROTA_ADMIN, ROTA_AVALIADOR, avisar, designar, rotaDono } from "./servidor";
import type { MotivoVerificacao } from "./strikes";

/*
  Prompt 62-B2 — ações da execução da avaliação. O avaliador designado preenche o checklist no celular (salvando a cada
  item; a fila local do aparelho reenvia em lote), mede a internet na hora (motor do 57, prova de local pela distância)
  e envia: o laudo VIS é emitido pela PLATAFORMA. O dono contesta (7 dias), envia a foto da correção e confirma a
  devolução. A verificação é aberta só pelo admin (duas etapas), com motivo. Tudo atrás de VISTORIA_ATIVA.
*/

export type Res = { ok: true; mensagem?: string } | { ok: false; erro: string };
const BUCKET = "avaliacao-imovel";
const TIPOS_FOTO = new Set(["image/jpeg", "image/png", "image/webp"]);
const SEM_ACESSO: Res = { ok: false, erro: "Esta ação não está disponível." };
const DESLIGADA: Res = { ok: false, erro: "A avaliação do imóvel ainda não está disponível." };
const MOTIVOS_VERIFICACAO: readonly MotivoVerificacao[] = ["denuncia_procedente", "pendencia_conforto", "ressalva_vencida", "outro"];

async function sessao() {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, admin, userId: user.id } : null;
}

const texto = (v: FormDataEntryValue | null, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** O avaliador designado do pedido (pela conta do parceiro). */
async function comoAvaliador(pedidoId: string) {
  if (!(await vistoriaAtiva())) return null;
  const s = await sessao();
  if (!s) return null;
  const { data: p } = await s.admin
    .from("vistoria_pedidos")
    .select("id, property_id, owner_id, status, tipo, agendado_para, avaliador_id, avaliadores_credenciamento(parceiros(user_id))")
    .eq("id", pedidoId)
    .maybeSingle();
  const dono = (p?.avaliadores_credenciamento as unknown as { parceiros: { user_id: string } | null } | null)?.parceiros?.user_id;
  if (!p || dono !== s.userId) return null;
  return { ...s, p };
}

const EM_VISITA = ["agendado", "realizada"];

// ── Checklist (salva a cada item; o lote vem da fila local quando a rede volta) ──────────────────────────────────
export async function salvarItens(form: FormData): Promise<Res> {
  const c = await comoAvaliador(String(form.get("pedidoId") ?? ""));
  if (!c || !EM_VISITA.includes(c.p.status)) return SEM_ACESSO;
  let itens: { chave: string; valor: string; observacao?: string | null }[];
  try {
    itens = JSON.parse(String(form.get("itens") ?? "[]"));
  } catch {
    return { ok: false, erro: "Envio inválido." };
  }
  if (!Array.isArray(itens) || itens.length === 0 || itens.length > 100) return { ok: false, erro: "Envio inválido." };
  const agora = new Date().toISOString();
  const linhas = [];
  for (const i of itens) {
    if (!valorValido(String(i?.chave), i?.valor)) return { ok: false, erro: `Resposta inválida em ${itemChecklist(String(i?.chave))?.rotulo ?? "um item"}.` };
    linhas.push({ pedido_id: c.p.id, chave: i.chave, valor: i.valor, observacao: i.observacao ? texto(i.observacao, 300) || null : null, salvo_em: agora });
  }
  const { error } = await c.admin.from("vistoria_checklist").upsert(linhas, { onConflict: "pedido_id,chave" });
  if (error) return { ok: false, erro: "Não foi possível salvar. A fila do aparelho tenta de novo." };
  return { ok: true, mensagem: linhas.length === 1 ? "Item salvo." : `${linhas.length} itens salvos.` };
}

/** Foto da avaliação: 1 por cômodo + 1 por item não conforme. Sem pessoas nem pertences; o EXIF sai aqui. */
export async function enviarFotoAvaliacao(form: FormData): Promise<Res> {
  const c = await comoAvaliador(String(form.get("pedidoId") ?? ""));
  if (!c || !EM_VISITA.includes(c.p.status)) return SEM_ACESSO;
  return gravarFoto(c.admin, c.p.id, form);
}

async function gravarFoto(admin: NonNullable<ReturnType<typeof createAdminClient>>, pedidoId: string, form: FormData): Promise<Res> {
  const arquivo = form.get("foto");
  const itemChave = texto(form.get("item"), 40) || null;
  const comodo = itemChave ? null : texto(form.get("comodo"), 40) || null;
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: "Escolha a foto." };
  if (!TIPOS_FOTO.has(arquivo.type) || arquivo.size > 10 * 1024 * 1024) return { ok: false, erro: "Envie a foto em JPG, PNG ou WebP de até 10 MB." };
  if (itemChave && !itemChecklist(itemChave)) return { ok: false, erro: "Item inválido." };
  if (!itemChave && (!comodo || comodo.length < 2)) return { ok: false, erro: "Diga de qual cômodo é a foto." };
  const limpo = await semMetadados(new Uint8Array(await arquivo.arrayBuffer()), arquivo.type);
  if (!limpo) return { ok: false, erro: "Não foi possível ler a foto. Envie de novo." };
  const path = `${pedidoId}/${Date.now()}-${randomBytes(4).toString("hex")}`;
  const up = await admin.storage.from(BUCKET).upload(path, Buffer.from(limpo), { contentType: arquivo.type, upsert: false });
  if (up.error) return { ok: false, erro: "Não foi possível enviar a foto." };
  await admin.from("vistoria_checklist_fotos").insert({ pedido_id: pedidoId, item_chave: itemChave, comodo, path });
  return { ok: true, mensagem: "Foto enviada." };
}

/**
 * Medição NA HORA: internet pelo motor do 57 (rodadas → mediana; a prova de local guarda só a distância) e dB(A) como
 * apoio. Nada daqui é publicado: a internet do laudo entra no nível sustentado; o dB(A) fica só com a equipe.
 */
export async function registrarMedicao(form: FormData): Promise<Res> {
  const c = await comoAvaliador(String(form.get("pedidoId") ?? ""));
  if (!c || !EM_VISITA.includes(c.p.status)) return SEM_ACESSO;
  const tipo = String(form.get("tipo") ?? "");
  if (tipo === "ruido_dba") {
    const dba = Number(String(form.get("dba") ?? "").replace(",", "."));
    if (!(dba >= 0 && dba <= 140)) return { ok: false, erro: "Informe o dB(A) medido." };
    await c.admin.from("vistoria_medicoes").insert({ pedido_id: c.p.id, tipo, dba: Math.round(dba * 10) / 10 });
    return { ok: true, mensagem: "Medição de ruído guardada (uso interno)." };
  }
  if (tipo !== "internet") return { ok: false, erro: "Medição inválida." };
  const ponto = String(form.get("ponto") ?? "");
  if (ponto !== "quarto_principal" && ponto !== "trabalho") return { ok: false, erro: "Escolha o ponto da medição." };
  let rodadas: unknown;
  try {
    rodadas = JSON.parse(String(form.get("rodadas") ?? "[]"));
  } catch {
    return { ok: false, erro: "Medição inválida." };
  }
  const validas = Array.isArray(rodadas) ? rodadas.filter(rodadaValida) : [];
  const r = juntarRodadas(validas);
  if (!r) return { ok: false, erro: "Medição inválida." };
  const lat = Number(form.get("lat"));
  const lng = Number(form.get("lng"));
  const local = validarLocal(form.get("lat") ? { lat, lng } : null, await coordenadasDoImovel(c.admin, c.p.property_id), form.get("wifi") === "on");
  if (!local.validada) return { ok: false, erro: "A medição precisa ser feita no imóvel, no Wi-Fi do imóvel, com a localização permitida." };
  await c.admin.from("vistoria_medicoes").insert({ pedido_id: c.p.id, tipo, ponto, download_mbps: r.downloadMbps, upload_mbps: r.uploadMbps, latencia_ms: r.latenciaMs, distancia_m: local.distanciaM });
  return { ok: true, mensagem: "Internet medida." };
}

/** As 4 perguntas de ruído respondidas na visita (vão para o imóvel com origem "vistoria" quando o laudo sai). */
export async function salvarRuidoVisita(form: FormData): Promise<Res> {
  const c = await comoAvaliador(String(form.get("pedidoId") ?? ""));
  if (!c || !EM_VISITA.includes(c.p.status)) return SEM_ACESSO;
  const v = validarRespostasRuido({
    via_intensa: form.get("via_intensa") === "sim",
    noturno_obra_100m: form.get("noturno_obra_100m") === "sim",
    aviao_ferrovia: form.get("aviao_ferrovia") === "sim",
    isolamento_acustico: form.get("isolamento_acustico") === "sim",
  });
  if (!v.ok) return { ok: false, erro: v.erro };
  await c.admin.from("vistoria_pedidos").update({ ruido_respostas: v.respostas, atualizado_em: new Date().toISOString() }).eq("id", c.p.id);
  return { ok: true, mensagem: "Ruído classificado." };
}

export async function concluirVisita(form: FormData): Promise<Res> {
  const c = await comoAvaliador(String(form.get("pedidoId") ?? ""));
  if (!c || c.p.status !== "agendado") return SEM_ACESSO;
  const agora = new Date().toISOString();
  await c.admin.from("vistoria_pedidos").update({ status: "realizada", visita_concluida_em: agora, atualizado_em: agora }).eq("id", c.p.id).eq("status", "agendado");
  revalidatePath(ROTA_AVALIADOR);
  return { ok: true, mensagem: "Visita concluída. Envie o laudo em até 48 horas úteis." };
}

/** O avaliador envia: a PLATAFORMA emite o laudo VIS (o checklist precisa estar completo). */
export async function enviarLaudo(form: FormData): Promise<Res> {
  const c = await comoAvaliador(String(form.get("pedidoId") ?? ""));
  if (!c || c.p.status !== "realizada") return SEM_ACESSO;
  const r = await emitirLaudo(c.admin, c.p.id, new Date());
  if (!r.ok) return r;
  revalidatePath(ROTA_AVALIADOR);
  revalidatePath(`/dashboard/imoveis/${c.p.property_id}/nivel`);
  return { ok: true, mensagem: `Laudo ${r.numero} emitido.` };
}

async function laudoPorId(admin: NonNullable<ReturnType<typeof createAdminClient>>, id: string): Promise<LinhaLaudo | null> {
  const { data } = await admin.from("vistoria_laudos").select("*").eq("id", id).maybeSingle();
  return (data as LinhaLaudo | null) ?? null;
}

/** Reverificação da ressalva (uma, incluída): o mesmo avaliador confere a foto do dono ou a nova visita. */
export async function confirmarCorrecao(form: FormData): Promise<Res> {
  if (!(await vistoriaAtiva())) return DESLIGADA;
  const s = await sessao();
  if (!s) return SEM_ACESSO;
  const l = await laudoPorId(s.admin, String(form.get("laudoId") ?? ""));
  if (!l || !l.avaliador_id || l.ressalva_vencida_em || l.corrigido_em || l.contestado_em) return SEM_ACESSO;
  const { data: cred } = await s.admin.from("avaliadores_credenciamento").select("parceiros(user_id)").eq("id", l.avaliador_id).maybeSingle();
  if ((cred?.parceiros as unknown as { user_id: string } | null)?.user_id !== s.userId) return SEM_ACESSO;
  const corrigidos: Record<string, ValorItem> = {};
  for (const r of l.ressalvas) {
    const v = String(form.get(`item_${r.chave}`) ?? "");
    if (!valorValido(r.chave, v)) return { ok: false, erro: `Responda ${itemChecklist(r.chave)?.rotulo ?? r.chave}.` };
    corrigidos[r.chave] = v as ValorItem;
  }
  for (const g of l.graves) {
    const v = String(form.get(`item_${g}`) ?? "");
    if (valorValido(g, v)) corrigidos[g] = v as ValorItem;
  }
  const r = await registrarCorrecao(s.admin, l.pedido_id, corrigidos, new Date());
  if (!r.ok) return r;
  revalidatePath(ROTA_AVALIADOR);
  return { ok: true, mensagem: r.resultado === "aprovado" ? "Correção confirmada: o laudo ganhou nova versão, aprovado." : "Nova versão do laudo emitida." };
}

// ── O dono ───────────────────────────────────────────────────────────────────────────────────────────────────────
async function comoDono(laudoId: string) {
  if (!(await vistoriaAtiva())) return null;
  const s = await sessao();
  if (!s) return null;
  const l = await laudoPorId(s.admin, laudoId);
  if (!l || l.owner_id !== s.userId) return null;
  return { ...s, l };
}

/** Foto da correção de uma ressalva (reverificação por foto). O avaliador confere e emite a versão nova. */
export async function enviarFotoCorrecao(form: FormData): Promise<Res> {
  const c = await comoDono(String(form.get("laudoId") ?? ""));
  if (!c || c.l.corrigido_em || c.l.ressalva_vencida_em) return SEM_ACESSO;
  const chave = String(form.get("item") ?? "");
  const ressalva = c.l.ressalvas.find((r) => r.chave === chave) ?? (c.l.graves.includes(chave) ? { chave, reverificacao: "foto" as const } : null);
  if (!ressalva) return { ok: false, erro: "Este item não está entre as ressalvas." };
  const r = await gravarFoto(c.admin, c.l.pedido_versao_id, form);
  if (!r.ok) return r;
  const { data: cred } = c.l.avaliador_id ? await c.admin.from("avaliadores_credenciamento").select("parceiros(user_id)").eq("id", c.l.avaliador_id).maybeSingle() : { data: null };
  await avisar(c.admin, (cred?.parceiros as unknown as { user_id: string } | null)?.user_id, "vistoria_correcao_enviada", ROTA_AVALIADOR);
  revalidatePath(`/dashboard/imoveis/${c.l.property_id}/nivel`);
  return { ok: true, mensagem: "Foto enviada. O avaliador confere e o laudo ganha nova versão." };
}

export async function contestarLaudo(form: FormData): Promise<Res> {
  const c = await comoDono(String(form.get("laudoId") ?? ""));
  if (!c) return SEM_ACESSO;
  const motivo = texto(form.get("motivo"), 500);
  if (motivo.length < 10) return { ok: false, erro: "Escreva o motivo da contestação." };
  const pode = podeContestar(c.l.emitido_em, new Date(), !!c.l.contestado_em);
  if (!pode.ok) return { ok: false, erro: pode.motivo };
  const r = await abrirContestacao(c.admin, c.l, motivo, new Date());
  if (!r.ok) return r;
  revalidatePath(`/dashboard/imoveis/${c.l.property_id}/nivel`);
  return { ok: true, mensagem: "Contestação registrada. Outro avaliador credenciado faz a 2ª avaliação." };
}

export async function confirmarDevolucao(form: FormData): Promise<Res> {
  if (!(await vistoriaAtiva())) return DESLIGADA;
  const s = await sessao();
  if (!s) return SEM_ACESSO;
  const { data } = await s.admin
    .from("vistoria_devolucoes")
    .update({ recebido_confirmado_em: new Date().toISOString() })
    .eq("id", String(form.get("devolucaoId") ?? ""))
    .eq("owner_id", s.userId)
    .is("recebido_confirmado_em", null)
    .select("id");
  if (!data?.length) return SEM_ACESSO;
  revalidatePath("/dashboard/imoveis");
  return { ok: true, mensagem: "Recebimento confirmado." };
}

// ── Admin: verificação (só a Viva abre, com motivo) e bloqueios ──────────────────────────────────────────────────
async function exigirAdmin() {
  const s = await sessao();
  if (!s) return null;
  const { data: perfil } = await s.supabase.from("profiles").select("role").eq("id", s.userId).maybeSingle();
  if (!(perfil?.role === "admin" && (await sessaoAal2(s.supabase)))) return null;
  return s;
}

export async function adminAbrirVerificacao(form: FormData): Promise<Res> {
  const a = await exigirAdmin();
  if (!a) return SEM_ACESSO;
  const motivo = String(form.get("motivo") ?? "") as MotivoVerificacao;
  const detalhe = texto(form.get("detalhe"), 500);
  if (!MOTIVOS_VERIFICACAO.includes(motivo)) return { ok: false, erro: "Escolha o motivo da verificação." };
  if (detalhe.length < 10) return { ok: false, erro: "Descreva o motivo." };
  const { data: im } = await a.admin.from("properties").select("id, owner_id, city, bedrooms").eq("id", texto(form.get("propertyId"), 40)).maybeSingle();
  if (!im) return { ok: false, erro: "Imóvel não encontrado." };
  const agora = new Date();
  const { data: tabela } = await a.admin.from("vistoria_precos").select("cidade, porte, valor, inclui_texto, vigente_desde").eq("cidade", im.city ?? "");
  const linhas: LinhaPreco[] = ((tabela ?? []) as { cidade: string; porte: Porte; valor: number | string; inclui_texto: string | null; vigente_desde: string }[]).map((l) => ({ cidade: l.cidade, porte: l.porte, valor: Number(l.valor), incluiTexto: l.inclui_texto, vigenteDesde: l.vigente_desde }));
  const porte = porteDoImovel(im.bedrooms as number);
  const preco = precoVigente(linhas, im.city ?? "", porte, agora);
  if (!preco) return { ok: false, erro: "Sem preço na tabela para esta cidade e porte." };
  const { data: dono } = await a.admin.from("profiles").select("is_teste").eq("id", im.owner_id).maybeSingle();
  const { data: p, error } = await a.admin
    .from("vistoria_pedidos")
    .insert({ property_id: im.id, owner_id: im.owner_id, cidade: im.city ?? "", tipo: "verificacao", porte, valor_tabela: preco.valor, verificacao_motivo: motivo, verificacao_detalhe: detalhe, verificacao_aberta_por: a.userId, teste: dono?.is_teste === true })
    .select("id")
    .single();
  if (error || !p) return { ok: false, erro: "Este imóvel já tem uma avaliação em andamento." };
  await designar(a.admin, p.id as string, agora);
  await avisar(a.admin, im.owner_id as string, "vistoria_verificacao", rotaDono(im.id as string));
  revalidatePath(ROTA_ADMIN);
  return { ok: true, mensagem: "Verificação aberta e designada pelo rodízio." };
}

/** Saída manual de um bloqueio (ex.: correção de segurança comprovada fora do fluxo do avaliador), com registro. */
export async function adminResolverBloqueio(form: FormData): Promise<Res> {
  const a = await exigirAdmin();
  if (!a) return SEM_ACESSO;
  const { data: b } = await a.admin.from("vistoria_bloqueios").select("property_id, motivo").eq("id", String(form.get("id") ?? "")).is("resolvido_em", null).maybeSingle();
  if (!b) return SEM_ACESSO;
  await liberar(a.admin, b.property_id as string, [b.motivo as "seguranca_grave" | "strike_2" | "strike_3"], new Date());
  revalidatePath(ROTA_ADMIN);
  return { ok: true };
}
