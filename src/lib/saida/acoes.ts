"use server";

/*
  Prompt 51, fase 1 — Sair da Viva (ações). Toda gravação pelo cliente de serviço DEPOIS de conferir quem age; as regras
  são as de ./regras.ts. Pausar nunca é bloqueado por pendência; o motivo nunca é obrigatório.
*/
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessaoAal2 } from "@/lib/data/admin-guard";
import { abrirChamado } from "@/lib/data/atendimento-actions";
import { abrirCorrecoesDevidas } from "@/lib/data/qualidade";
import { ajudaDoMotivo, motivoDenunciaValido, motivoValido, pendenciasParaSair, podeFecharCorrecao, prioridadeDenuncia, MOTIVOS_DENUNCIA, NIVEIS_SAIDA, VALORES_SURPRESA, type NivelSaida, type PapelSaida, type PendenciaSaida } from "./regras";

export type Res = { ok: true; mensagem?: string } | { ok: false; erro: string };

async function sessao() {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, admin, uid: user.id } : null;
}

type Sessao = NonNullable<Awaited<ReturnType<typeof sessao>>>;

async function papelDa(s: Sessao): Promise<PapelSaida> {
  const [{ data: parc }, { data: perfil }] = await Promise.all([
    s.admin.from("parceiros").select("id").eq("user_id", s.uid).limit(1),
    s.admin.from("profiles").select("role").eq("id", s.uid).maybeSingle(),
  ]);
  if (parc?.length) return "parceiro";
  return perfil?.role === "owner" ? "proprietario" : "morador";
}

/** O que a tela "Sair da Viva" precisa: o papel, se a conta está pausada e as pendências reais. */
export async function estadoSaida(): Promise<{ papel: PapelSaida; pausadaEm: string | null; pendencias: PendenciaSaida[] } | null> {
  const s = await sessao();
  if (!s) return null;
  const [papel, { data: perfil }, comoMorador, comoDono, { data: pedidos }] = await Promise.all([
    papelDa(s),
    s.admin.from("profiles").select("pausada_em").eq("id", s.uid).maybeSingle(),
    s.admin.from("contratos").select("id, properties(title)").eq("tenant_id", s.uid).eq("status", "ativo"),
    s.admin.from("contratos").select("id, properties!inner(title, owner_id)").eq("properties.owner_id", s.uid).eq("status", "ativo"),
    s.admin.from("parceiro_pedidos").select("id, parceiros(nome_publico)").eq("cliente_id", s.uid).in("status", ["solicitado", "orcado", "aceito", "agendado", "em_execucao", "entregue"]),
  ]);
  const contratos = [...((comoMorador.data ?? []) as unknown[]), ...((comoDono.data ?? []) as unknown[])] as { id: string; properties: { title: string | null } | null }[];
  const ids = contratos.map((c) => c.id);
  const [{ data: caucoes }, { data: encerramentos }] = ids.length
    ? await Promise.all([
        s.admin.from("caucao_acertos").select("contrato_id").in("contrato_id", ids).eq("status", "aguardando_confirmacao"),
        s.admin.from("contrato_encerramento_pedidos").select("contrato_id").in("contrato_id", ids).in("status", ["aberto", "em_conducao"]),
      ])
    : [{ data: [] }, { data: [] }];
  const titulo = new Map(contratos.map((c) => [c.id, c.properties?.title || "Imóvel"]));
  return {
    papel,
    pausadaEm: (perfil?.pausada_em as string | null) ?? null,
    pendencias: pendenciasParaSair({
      contratosEmVigencia: contratos.map((c) => ({ id: c.id, titulo: titulo.get(c.id)! })),
      pedidosParceiroAbertos: ((pedidos ?? []) as unknown as { id: string; parceiros: { nome_publico: string | null } | null }[]).map((p) => ({ id: p.id, titulo: p.parceiros?.nome_publico || "Parceiro" })),
      caucoesADevolver: ((caucoes ?? []) as { contrato_id: string }[]).map((c) => ({ contratoId: c.contrato_id, titulo: titulo.get(c.contrato_id) ?? "Imóvel" })),
      encerramentosAbertos: ((encerramentos ?? []) as { contrato_id: string }[]).map((e) => ({ contratoId: e.contrato_id })),
    }),
  };
}

function revalidarConta() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/conta/excluir");
  revalidatePath("/buscar");
}

/**
 * Pausa a conta: os anúncios publicados saem da busca (o contrato em vigência não muda), a página de parceiro sai do ar
 * (fora da busca e noindex), alertas e lembretes param. Avisos de contrato, segurança e jurídicos continuam.
 * Nunca bloqueado por pendência. Só o que a pausa tirou do ar volta na reativação.
 */
export async function pausarConta(): Promise<Res> {
  const s = await sessao();
  if (!s) return { ok: false, erro: "Entre na sua conta." };
  const agora = new Date().toISOString();
  const { error } = await s.admin.from("profiles").update({ pausada_em: agora }).eq("id", s.uid).is("pausada_em", null);
  if (error) {
    console.error("[pausarConta]", error.code, error.message);
    return { ok: false, erro: "Não foi possível pausar agora. Tente de novo." };
  }
  await s.admin.from("properties").update({ status: "paused", pausado_pela_conta: true }).eq("owner_id", s.uid).eq("status", "active");
  await s.admin.from("parceiros").update({ status: "pausado", pausado_pela_conta: true }).eq("user_id", s.uid).eq("status", "publicado");
  revalidarConta();
  return { ok: true, mensagem: "Conta pausada. Para voltar, toque em \"Reativar minha conta\" no topo do painel." };
}

/** Reativa em 1 toque: devolve à busca só o que a pausa tirou do ar. */
export async function reativarConta(): Promise<Res> {
  const s = await sessao();
  if (!s) return { ok: false, erro: "Entre na sua conta." };
  const { error } = await s.admin.from("profiles").update({ pausada_em: null }).eq("id", s.uid);
  if (error) return { ok: false, erro: "Não foi possível reativar agora. Tente de novo." };
  await s.admin.from("properties").update({ status: "active", pausado_pela_conta: false }).eq("owner_id", s.uid).eq("status", "paused").eq("pausado_pela_conta", true);
  await s.admin.from("parceiros").update({ status: "publicado", pausado_pela_conta: false }).eq("user_id", s.uid).eq("status", "pausado").eq("pausado_pela_conta", true);
  revalidarConta();
  return { ok: true, mensagem: "Conta reativada." };
}

/**
 * Grava o motivo (opcional: tudo pode vir vazio — "Continuar sem responder" grava só o nível) e devolve a ajuda ligada
 * ao motivo, se houver. Nunca bloqueia a saída.
 */
export async function registrarMotivoSaida(form: FormData): Promise<{ ok: true; id: string | null; ajuda: ReturnType<typeof ajudaDoMotivo> } | { ok: false; erro: string }> {
  const s = await sessao();
  if (!s) return { ok: false, erro: "Entre na sua conta." };
  const nivel = String(form.get("nivel") ?? "") as NivelSaida;
  if (!NIVEIS_SAIDA.includes(nivel)) return { ok: false, erro: "Escolha como quer sair." };
  const papel = await papelDa(s);
  const bruto = String(form.get("motivo") ?? "");
  const motivo = motivoValido(papel, bruto) ? bruto : null;
  const det = String(form.get("detalhe") ?? "");
  const detalhe = motivo && VALORES_SURPRESA.some((v) => v.chave === det) ? det : null;
  const texto = String(form.get("texto") ?? "").replace(/\s+/g, " ").trim().slice(0, 1000) || null;
  const ajuda = ajudaDoMotivo(papel, motivo);
  const { data: perfil } = await s.admin.from("profiles").select("is_teste").eq("id", s.uid).maybeSingle();
  const { data, error } = await s.admin
    .from("saidas_motivos")
    .insert({ user_id: s.uid, papel, nivel, motivo, detalhe, texto_livre: texto, ajuda_oferecida: ajuda?.chave ?? null, teste: perfil?.is_teste === true })
    .select("id")
    .single();
  // Falhar ao gravar o motivo nunca impede a saída.
  if (error) console.error("[registrarMotivoSaida]", error.code, error.message);
  // Loop fechado: com mais de 3 saídas pelo mesmo motivo em 30 dias, a Correção aparece no painel de qualidade.
  else if (motivo && perfil?.is_teste !== true) await abrirCorrecoesDevidas(s.admin).catch(() => null);
  return { ok: true, id: (data?.id as string | undefined) ?? null, ajuda };
}

/** A pessoa escolheu a ajuda em vez de seguir com a saída: conta como saída revertida pela ajuda (métrica de ouro). */
export async function aceitarAjudaSaida(id: string): Promise<Res> {
  const s = await sessao();
  if (!s || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, erro: "Sem permissão." };
  await s.admin.from("saidas_motivos").update({ ajuda_aceita: true, revertida: true }).eq("id", id).eq("user_id", s.uid);
  return { ok: true };
}

// ── Denunciar anúncio ──────────────────────────────────────────────────────────────────────────────────────────
/** Uma por conta por anúncio; vai à fila do atendimento (P1 para pagamento/contato fora, P2 o resto). Não tira da busca. */
export async function denunciarAnuncio(form: FormData): Promise<Res> {
  const s = await sessao();
  if (!s) return { ok: false, erro: "Entre com seu e-mail para denunciar o anúncio." };
  const propertyId = String(form.get("propertyId") ?? "");
  const motivo = String(form.get("motivo") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(propertyId)) return { ok: false, erro: "Anúncio não encontrado." };
  if (!motivoDenunciaValido(motivo)) return { ok: false, erro: "Escolha o motivo da denúncia." };
  const texto = String(form.get("texto") ?? "").replace(/\s+/g, " ").trim().slice(0, 1000) || null;
  const { data: im } = await s.admin.from("properties").select("id, title, owner_id").eq("id", propertyId).maybeSingle();
  if (!im) return { ok: false, erro: "Anúncio não encontrado." };
  if (im.owner_id === s.uid) return { ok: false, erro: "Este anúncio é seu." };
  const { data: perfil } = await s.admin.from("profiles").select("is_teste").eq("id", s.uid).maybeSingle();
  const { data: d, error } = await s.admin.from("denuncias_anuncio").insert({ property_id: propertyId, user_id: s.uid, motivo, texto, teste: perfil?.is_teste === true }).select("id").single();
  if (error?.code === "23505") return { ok: false, erro: "Você já denunciou este anúncio. Acompanhe o estado aqui mesmo." };
  if (error || !d) return { ok: false, erro: "Não foi possível enviar a denúncia agora. Tente de novo." };
  const rotulo = MOTIVOS_DENUNCIA.find((m) => m.chave === motivo)!.rotulo;
  // P1 (pagamento/contato fora) entra como segurança; o resto como anúncio (P2).
  const ch = await abrirChamado({
    categoria: prioridadeDenuncia(motivo) === "p1" ? "seguranca" : "anuncio",
    assunto: `Denúncia de anúncio: ${rotulo}`,
    mensagem: `Denúncia do anúncio "${im.title ?? propertyId}": ${rotulo}.${texto ? ` ${texto}` : ""}`,
    canal: "site",
    contextoTipo: "anuncio",
    contextoId: propertyId,
  }).catch(() => null);
  if (ch?.ok) await s.admin.from("denuncias_anuncio").update({ chamado_numero: ch.numero }).eq("id", d.id);
  revalidatePath(`/imoveis/${propertyId}`);
  return { ok: true, mensagem: "Denúncia recebida. O atendimento da Viva analisa e você acompanha o estado aqui." };
}

// ── Admin: painel de qualidade ─────────────────────────────────────────────────────────────────────────────────
async function exigirAdmin() {
  const s = await sessao();
  if (!s) return null;
  const { data: perfil } = await s.supabase.from("profiles").select("role").eq("id", s.uid).maybeSingle();
  return perfil?.role === "admin" && (await sessaoAal2(s.supabase)) ? s : null;
}

/** Dono e prazo obrigatórios para a Correção sair de "sem dono". */
export async function adminDefinirCorrecao(form: FormData): Promise<Res> {
  const a = await exigirAdmin();
  if (!a) return { ok: false, erro: "Esta ação não está disponível." };
  const dono = String(form.get("dono") ?? "").trim().slice(0, 80);
  const prazo = String(form.get("prazo") ?? "");
  if (dono.length < 2) return { ok: false, erro: "Informe quem é o dono da correção." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo)) return { ok: false, erro: "Informe o prazo." };
  const { data } = await a.admin.from("qualidade_correcoes").update({ dono, prazo }).eq("id", String(form.get("id") ?? "")).is("fechada_em", null).select("id");
  if (!data?.length) return { ok: false, erro: "Correção não encontrada." };
  revalidatePath("/admin/qualidade");
  return { ok: true, mensagem: "Dono e prazo registrados." };
}

/** Fechar exige a ligação a um PR ou a uma ação registrada (e dono e prazo já definidos). */
export async function adminFecharCorrecao(form: FormData): Promise<Res> {
  const a = await exigirAdmin();
  if (!a) return { ok: false, erro: "Esta ação não está disponível." };
  const ligacao = String(form.get("ligacao") ?? "").trim().slice(0, 300);
  const pode = podeFecharCorrecao(ligacao);
  if (!pode.ok) return { ok: false, erro: pode.motivo };
  const { data: c } = await a.admin.from("qualidade_correcoes").select("dono, prazo").eq("id", String(form.get("id") ?? "")).is("fechada_em", null).maybeSingle();
  if (!c) return { ok: false, erro: "Correção não encontrada." };
  if (!c.dono || !c.prazo) return { ok: false, erro: "Defina o dono e o prazo antes de fechar." };
  await a.admin.from("qualidade_correcoes").update({ fechada_em: new Date().toISOString(), fechada_por: a.uid, ligacao }).eq("id", String(form.get("id") ?? "")).is("fechada_em", null);
  revalidatePath("/admin/qualidade");
  return { ok: true, mensagem: "Correção fechada." };
}

/** O atendimento muda o estado da denúncia (recebida → em análise → resolvida); quem denunciou vê o estado. */
export async function adminEstadoDenuncia(form: FormData): Promise<Res> {
  const a = await exigirAdmin();
  if (!a) return { ok: false, erro: "Esta ação não está disponível." };
  const status = String(form.get("status") ?? "");
  if (!["recebida", "em_analise", "resolvida"].includes(status)) return { ok: false, erro: "Escolha o estado." };
  await a.admin.from("denuncias_anuncio").update({ status, atualizado_em: new Date().toISOString() }).eq("id", String(form.get("id") ?? ""));
  revalidatePath("/admin/qualidade");
  return { ok: true, mensagem: "Estado atualizado." };
}

/** A denúncia que a própria pessoa fez deste anúncio (para mostrar o estado: recebida · em análise · resolvida). */
export async function minhaDenuncia(propertyId: string): Promise<{ logado: boolean; denuncia: { status: string; motivo: string } | null }> {
  const s = await sessao();
  if (!s) return { logado: false, denuncia: null };
  if (!/^[0-9a-f-]{36}$/i.test(propertyId)) return { logado: true, denuncia: null };
  const { data } = await s.admin.from("denuncias_anuncio").select("status, motivo").eq("property_id", propertyId).eq("user_id", s.uid).maybeSingle();
  return { logado: true, denuncia: (data as { status: string; motivo: string } | null) ?? null };
}
