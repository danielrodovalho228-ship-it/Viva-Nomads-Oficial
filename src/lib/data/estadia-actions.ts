"use server";

/*
  Ações da página da estadia (Prompt 32). Toda ação confere a sessão e o papel no contrato (contextoDaEstadia) antes
  de gravar com o cliente de serviço; mudanças de estado conferem o estado atual na própria gravação (dois cliques não
  passam os dois). Nenhum dinheiro passa pela Viva: a taxa do aditivo é registro para o fluxo de cobrança que já existe.
*/
import { after } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { lembreteDeBlocoNoAceite } from "@/lib/estadia/lembrete-bloco-servidor";
import type { NotificationEvent } from "@/lib/notifications/eventos-email";
import { sendEmail } from "@/lib/notifications/email";
import { emailCodigoAssinatura } from "@/lib/notifications/montar-email";
import { SITE_URL } from "@/lib/site";
import { hashResumo } from "@/lib/contrato-assinar";
import { numeroPublicoContrato } from "@/lib/contrato-ref";
import { registrarDocumento } from "@/lib/fiscal/registro";
import { linhaConferir, numeroAditivo } from "@/lib/fiscal/prefixos";
import { fecharConferencia } from "@/lib/fiscal/conferencia-fechamento";
import { cancelarProgramadas, reagendarProgramadas } from "@/lib/respostas/servidor";
import { aoEventoDaEstadia } from "@/lib/automacao/servidor";
import { taxaDoDonoAgora } from "@/lib/cobranca/taxa-servidor";
import { ehAdmin } from "@/lib/data/admin-guard";
import { logModeracao } from "@/lib/data/moderacao-log";
import {
  MSG_CODIGO_BLOQUEADO,
  VALIDADE_CODIGO_ASSINATURA_MS,
  conferirCodigo,
  gerarCodigoAssinatura,
  hashCodigoAssinatura,
  incrementarFalhas,
  podeReenviar,
  type LinhaCodigo,
} from "@/lib/contrato-codigo";
import { ENCERRAMENTO_REGRAS_ATIVO } from "@/lib/flags";
import { HREF_ESTADIA, type PapelEstadia } from "@/lib/estadia/estadia";
import { normalizarInstrucoes, separarSalvamento, type Instrucoes } from "@/lib/estadia/instrucoes";
import { podeAdicionarOcupante, textoListaPortaria, textoTetoOcupantes, validarOcupante, type OcupanteEntrada } from "@/lib/estadia/ocupantes";
import {
  blocosDepoisDoAditivo,
  expiraEmDe,
  expirou,
  linhasDoAditivo,
  resumoDasMudancas,
  taxaDoAditivo,
  validarProposta,
  type ContratoParaAditivo,
  type MudancasAditivo,
  type PropostaAditivo,
} from "@/lib/estadia/aditivo";
import { consequenciasDoEncerramento, rotuloMotivo, validarPedidoEncerramento } from "@/lib/estadia/encerramento";
import {
  assinadoPelasDuas,
  blocosOrdenados,
  contextoDaEstadia,
  hojeEmBrasilia,
  mesesFuturos,
  periodoDoContrato,
  type Contexto,
  type LinhaContratoEstadia,
  type OcupanteView,
} from "@/lib/data/estadia";

export type Res<T = undefined> = { ok: true; valor: T } | { ok: false; erro: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidar(contratoId: string) {
  revalidatePath(HREF_ESTADIA(contratoId));
  revalidatePath(`${HREF_ESTADIA(contratoId)}/ocupantes`);
  revalidatePath(`${HREF_ESTADIA(contratoId)}/alteracao`);
}

async function evento(admin: SupabaseClient, contratoId: string, autorId: string | null, tipo: string, dados: Record<string, unknown> = {}) {
  await admin.from("contrato_eventos").insert({ contrato_id: contratoId, autor_id: autorId, tipo, dados }).then(undefined, () => {});
}

/** Avisa a pessoa (e-mail + central + push), depois da resposta. Best-effort. */
function avisar(admin: SupabaseClient, userId: string, event: NotificationEvent, contratoId: string) {
  after(async () => {
    try {
      const { data } = await admin.auth.admin.getUserById(userId);
      await notify({ event, email: data?.user?.email ?? undefined, userId, pushUrl: HREF_ESTADIA(contratoId) });
    } catch {
      /* aviso é best-effort */
    }
  });
}

function outraParte(ctx: Contexto): string {
  return ctx.papel === "inquilino" ? String(ctx.c.properties?.owner_id ?? "") : ctx.c.tenant_id;
}

// ── Instruções de chegada (o dono preenche uma vez, no imóvel) ───────────────────────────────────────────────────

/** Limite do texto do contrato (contratos_checkin.instrucoes, 0127). */
const COMO_ENTRAR_CONTRATO_MAX = 600;

/**
 * Salva as instruções. Com `contratoId` e texto do contrato (combinação de check-in), "Como entrar" volta para esse
 * texto — só deste contrato — e o resto vai para o imóvel (achado do QA, 21/10: o dono não conseguia corrigir o que
 * estava publicado).
 */
export async function salvarInstrucoes(propertyId: string, campos: Record<string, unknown>, contratoId?: string): Promise<Res> {
  if (!UUID_RE.test(String(propertyId))) return { ok: false, erro: "Imóvel inválido." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, erro: "Serviço indisponível." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Entre para continuar." };
  const { data: imovel } = await supabase.from("properties").select("owner_id").eq("id", propertyId).maybeSingle();
  if ((imovel as { owner_id?: string } | null)?.owner_id !== user.id) return { ok: false, erro: "Só o proprietário edita as instruções." };
  const normalizadas = normalizarInstrucoes(campos);
  let imovelCampos: Instrucoes = normalizadas;
  if (contratoId) {
    if (!UUID_RE.test(String(contratoId))) return { ok: false, erro: "Contrato inválido." };
    const admin = createAdminClient();
    if (!admin) return { ok: false, erro: "Serviço indisponível." };
    // O contrato precisa ser deste imóvel (e o imóvel, do dono, conferido acima).
    const { data: k } = await admin.from("contratos").select("id").eq("id", contratoId).eq("property_id", propertyId).maybeSingle();
    if (!k) return { ok: false, erro: "Contrato não encontrado." };
    const [{ data: ck }, { data: atual }] = await Promise.all([
      admin.from("contratos_checkin").select("instrucoes").eq("contrato_id", contratoId).maybeSingle(),
      supabase.from("imovel_instrucoes_chegada").select("*").eq("property_id", propertyId).maybeSingle(),
    ]);
    const temTexto = !!((ck as { instrucoes?: string | null } | null)?.instrucoes ?? "").trim();
    const destino = separarSalvamento(normalizadas, atual ? normalizarInstrucoes(atual as Record<string, unknown>) : null, temTexto);
    if (temTexto) {
      if (!destino.comoEntrarDoContrato) return { ok: false, erro: "\"Como entrar\" deste contrato não pode ficar vazio." };
      if (destino.comoEntrarDoContrato.length > COMO_ENTRAR_CONTRATO_MAX) return { ok: false, erro: `"Como entrar" deste contrato: até ${COMO_ENTRAR_CONTRATO_MAX} caracteres.` };
      const { error: eK } = await admin.from("contratos_checkin").update({ instrucoes: destino.comoEntrarDoContrato, atualizado_em: new Date().toISOString() }).eq("contrato_id", contratoId);
      if (eK) return { ok: false, erro: "Não foi possível salvar \"Como entrar\" deste contrato." };
    }
    imovelCampos = destino.imovel;
  }
  // Gravação pela sessão do dono: a RLS da 0198 (instrucoes: só o dono) repete a conferência.
  const { error } = await supabase
    .from("imovel_instrucoes_chegada")
    .upsert({ property_id: propertyId, ...imovelCampos, atualizado_em: new Date().toISOString() }, { onConflict: "property_id" });
  if (error) return { ok: false, erro: "Não foi possível salvar as instruções." };
  revalidatePath("/dashboard/estadia/[contratoId]", "page");
  return { ok: true, valor: undefined };
}

// ── Ocupantes (lista para a portaria) ────────────────────────────────────────────────────────────────────────────

/** Devolve o ocupante salvo: a tela atualiza a lista sem depender do refresh da página. */
export async function adicionarOcupante(contratoId: string, entrada: OcupanteEntrada): Promise<Res<OcupanteView>> {
  const ctx = await contextoDaEstadia(contratoId);
  if ("erro" in ctx) return { ok: false, erro: ctx.erro };
  if (ctx.papel !== "inquilino") return { ok: false, erro: "Quem preenche os ocupantes é o morador." };
  if (!assinadoPelasDuas(ctx.c) || ctx.c.status !== "ativo") return { ok: false, erro: "Os ocupantes são preenchidos depois da assinatura das duas partes." };
  const v = validarOcupante(entrada);
  if (!v.ok) return { ok: false, erro: v.erro };
  const { count } = await ctx.admin.from("contrato_ocupantes").select("id", { count: "exact", head: true }).eq("contrato_id", ctx.c.id);
  const previstos = Math.max(1, Number(ctx.c.qtd_ocupantes) || 1);
  if (!podeAdicionarOcupante(count ?? 0, previstos)) return { ok: false, erro: textoTetoOcupantes(previstos) };
  const { data: novo, error } = await ctx.admin.from("contrato_ocupantes").insert({ contrato_id: ctx.c.id, ...v.valor, criado_por: ctx.userId }).select("id").single();
  // O gatilho da 0198 repete o teto no banco (dois cliques ao mesmo tempo não passam do limite).
  if (error || !novo) return { ok: false, erro: error?.code === "23514" ? textoTetoOcupantes(previstos) : "Não foi possível salvar o ocupante." };
  revalidar(ctx.c.id);
  return { ok: true, valor: { id: novo.id as string, nome: v.valor.nome, documento: v.valor.documento, relacao: v.valor.parentesco_ou_relacao } };
}

export async function removerOcupante(contratoId: string, ocupanteId: string): Promise<Res> {
  if (!UUID_RE.test(String(ocupanteId))) return { ok: false, erro: "Ocupante inválido." };
  const ctx = await contextoDaEstadia(contratoId);
  if ("erro" in ctx) return { ok: false, erro: ctx.erro };
  if (ctx.papel !== "inquilino") return { ok: false, erro: "Quem edita os ocupantes é o morador." };
  await ctx.admin.from("contrato_ocupantes").delete().eq("id", ocupanteId).eq("contrato_id", ctx.c.id);
  revalidar(ctx.c.id);
  return { ok: true, valor: undefined };
}

/** "Lista para a portaria" (texto para copiar ou baixar): nome + documento. As duas partes leem. */
export async function listaParaPortaria(contratoId: string): Promise<Res<string>> {
  const ctx = await contextoDaEstadia(contratoId);
  if ("erro" in ctx) return { ok: false, erro: ctx.erro };
  const { data } = await ctx.admin.from("contrato_ocupantes").select("nome, documento").eq("contrato_id", ctx.c.id).order("criado_em");
  const p = periodoDoContrato(ctx.c);
  const texto = textoListaPortaria(
    { numero: numeroPublicoContrato(ctx.c.id), imovel: ctx.c.properties?.title ?? "Imóvel", inicio: p.inicio, fim: p.fim },
    (data ?? []) as { nome: string; documento: string }[],
  );
  // Prompt 56: cada geração da lista é um PRT no registro único, com o número e o código no fim do texto.
  try {
    const reg = await registrarDocumento(ctx.admin, {
      prefixo: "PRT",
      tipo: "lista_portaria",
      ref: { tabela: "contratos", id: ctx.c.id },
      partes: [ctx.c.properties?.owner_id, ctx.c.tenant_id],
      emitidoPor: ctx.userId,
      conteudo: ({ numero, codigo }) => `${texto}\n\nLista ${numero} · ${linhaConferir(SITE_URL, codigo)}`,
    });
    return { ok: true, valor: reg.bytes as string };
  } catch {
    return { ok: false, erro: "Não foi possível gerar a lista agora. Tente de novo." };
  }
}

// ── Notas privadas (só o autor lê) ───────────────────────────────────────────────────────────────────────────────

export async function salvarNota(contratoId: string, texto: string): Promise<Res> {
  const ctx = await contextoDaEstadia(contratoId);
  if ("erro" in ctx) return { ok: false, erro: ctx.erro };
  const t = String(texto ?? "").slice(0, 2000);
  const { error } = await ctx.admin
    .from("contrato_notas")
    .upsert({ contrato_id: ctx.c.id, autor_id: ctx.userId, texto: t, atualizado_em: new Date().toISOString() }, { onConflict: "contrato_id,autor_id" });
  if (error) return { ok: false, erro: "Não foi possível salvar a nota." };
  return { ok: true, valor: undefined };
}

// ── Propor alteração (aditivo) ───────────────────────────────────────────────────────────────────────────────────

function paraAditivo(c: LinhaContratoEstadia): ContratoParaAditivo {
  return {
    valorMensal: Number(c.aluguel_mensal) || 0,
    ocupantes: Math.max(1, Number(c.qtd_ocupantes) || 1),
    capacidade: Math.max(1, Number(c.capacidade_snapshot ?? c.properties?.max_guests ?? c.qtd_ocupantes) || 1),
    tamanhoBlocoMeses: Number(c.tamanho_bloco_meses) || 2,
    blocos: blocosOrdenados(c).map((b) => ({ ...b, valor: Number(b.valor), caucao: Number(b.caucao), meses: Number(b.meses) })),
  };
}

export async function proporAlteracao(contratoId: string, proposta: PropostaAditivo): Promise<Res<{ id: string }>> {
  const ctx = await contextoDaEstadia(contratoId);
  if ("erro" in ctx) return { ok: false, erro: ctx.erro };
  if (ctx.c.status !== "ativo" || !assinadoPelasDuas(ctx.c)) return { ok: false, erro: "A alteração vale para contrato assinado pelas duas partes e em vigor." };
  const v = validarProposta(paraAditivo(ctx.c), proposta, hojeEmBrasilia());
  if (!v.ok) return { ok: false, erro: v.erro };
  await expirarVencidos(ctx.admin, ctx.c.id);
  const { data: ultimo } = await ctx.admin.from("contrato_aditivos").select("numero").eq("contrato_id", ctx.c.id).order("numero", { ascending: false }).limit(1).maybeSingle();
  const numero = Number((ultimo as { numero?: number } | null)?.numero ?? 0) + 1;
  const { data, error } = await ctx.admin
    .from("contrato_aditivos")
    .insert({
      contrato_id: ctx.c.id,
      numero,
      proposto_por: ctx.userId,
      papel_proponente: ctx.papel,
      mudancas: v.valor,
      resumo: resumoDasMudancas(v.valor),
      expira_em: expiraEmDe(),
    })
    .select("id")
    .single();
  // Índice único da 0198: um aditivo aberto por contrato.
  if (error || !data) return { ok: false, erro: error?.code === "23505" ? "Já existe uma proposta de alteração aberta neste contrato." : "Não foi possível enviar a proposta." };
  await evento(ctx.admin, ctx.c.id, ctx.userId, "aditivo_proposto", { aditivo: data.id, numero });
  avisar(ctx.admin, outraParte(ctx), "estadia_aditivo_proposto", ctx.c.id);
  revalidar(ctx.c.id);
  return { ok: true, valor: { id: data.id as string } };
}

interface LinhaAditivo {
  id: string;
  contrato_id: string;
  numero: number;
  status: string;
  proposto_por: string;
  papel_proponente: PapelEstadia;
  mudancas: MudancasAditivo;
  resumo: string;
  expira_em: string;
  criado_em: string;
  hash_documento: string | null;
}

async function carregarAditivo(aditivoId: string): Promise<{ ctx: Contexto; a: LinhaAditivo } | { erro: string }> {
  if (!UUID_RE.test(String(aditivoId))) return { erro: "Proposta não encontrada." };
  const admin = createAdminClient();
  if (!admin) return { erro: "Serviço indisponível." };
  const { data } = await admin.from("contrato_aditivos").select("id, contrato_id, numero, status, proposto_por, papel_proponente, mudancas, resumo, expira_em, criado_em, hash_documento").eq("id", aditivoId).maybeSingle();
  const a = data as LinhaAditivo | null;
  if (!a) return { erro: "Proposta não encontrada." };
  const ctx = await contextoDaEstadia(a.contrato_id);
  if ("erro" in ctx) return { erro: "Proposta não encontrada." };
  return { ctx, a };
}

async function expirarVencidos(admin: SupabaseClient, contratoId: string) {
  const { data } = await admin.from("contrato_aditivos").update({ status: "expirado" }).eq("contrato_id", contratoId).eq("status", "proposto").lt("expira_em", new Date().toISOString()).select("id");
  for (const x of (data ?? []) as { id: string }[]) await evento(admin, contratoId, null, "aditivo_expirado", { aditivo: x.id });
}

/** As linhas do documento do aditivo — o hash das duas assinaturas cobre exatamente isto. */
function documentoDoAditivo(a: LinhaAditivo): string[] {
  return linhasDoAditivo({ numeroContrato: numeroPublicoContrato(a.contrato_id), numero: a.numero, mudancas: a.mudancas, propostoEm: a.criado_em.slice(0, 10) });
}

/** Devolve a base da taxa para o dono mostrar na hora, sem depender do refresh da página. */
export async function responderAditivo(aditivoId: string, resposta: "aceitar" | "recusar"): Promise<Res<{ taxaBase: string | null }>> {
  const r = await carregarAditivo(aditivoId);
  if ("erro" in r) return { ok: false, erro: r.erro };
  const { ctx, a } = r;
  if (a.proposto_por === ctx.userId) return { ok: false, erro: "Quem responde é a outra parte." };
  if (a.status !== "proposto") return { ok: false, erro: "Esta proposta já foi respondida." };
  if (expirou(a.expira_em)) {
    await expirarVencidos(ctx.admin, a.contrato_id);
    return { ok: false, erro: "A proposta venceu (7 dias). Quem propôs pode enviar outra." };
  }
  let taxaBase: string | null = null;
  if (resposta === "recusar") {
    // Recusar não muda nada no contrato.
    const { data } = await ctx.admin.from("contrato_aditivos").update({ status: "recusado", respondido_em: new Date().toISOString() }).eq("id", a.id).eq("status", "proposto").select("id");
    if (!data?.length) return { ok: false, erro: "Esta proposta já foi respondida." };
    await evento(ctx.admin, a.contrato_id, ctx.userId, "aditivo_recusado", { aditivo: a.id });
  } else {
    // Aceito: a taxa sobre a parte alterada fica registrada com a faixa do dono AGORA (decisão (a)).
    const ownerId = String(ctx.c.properties?.owner_id ?? "");
    const faixa = await taxaDoDonoAgora(ctx.admin, ownerId);
    const t = taxaDoAditivo(a.mudancas, {
      valorMensal: Number(ctx.c.aluguel_mensal) || 0,
      mesesNaoIniciados: mesesFuturos(ctx.c, hojeEmBrasilia()),
      taxaCongelada: Number(ctx.c.comissao_percent ?? faixa.taxa),
      taxaFaixaAgora: faixa.taxa,
    });
    const hash = hashResumo(documentoDoAditivo(a));
    const { data } = await ctx.admin
      .from("contrato_aditivos")
      .update({ status: "aceito", respondido_em: new Date().toISOString(), hash_documento: hash })
      .eq("id", a.id)
      .eq("status", "proposto")
      .select("id");
    if (!data?.length) return { ok: false, erro: "Esta proposta já foi respondida." };
    await ctx.admin.from("contrato_aditivo_taxa").upsert({ aditivo_id: a.id, valor: t.valor, percentual: t.percentualFaixa, base_texto: t.baseTexto }, { onConflict: "aditivo_id" });
    await evento(ctx.admin, a.contrato_id, ctx.userId, "aditivo_aceito", { aditivo: a.id });
    if (ctx.papel === "proprietario") taxaBase = t.baseTexto;
  }
  avisar(ctx.admin, a.proposto_por, "estadia_aditivo_respondido", a.contrato_id);
  revalidar(a.contrato_id);
  return { ok: true, valor: { taxaBase } };
}

/** Código de 6 dígitos por e-mail, como na assinatura do contrato (15 min, uso único). */
export async function pedirCodigoAditivo(aditivoId: string): Promise<Res> {
  const r = await carregarAditivo(aditivoId);
  if ("erro" in r) return { ok: false, erro: r.erro };
  const { ctx, a } = r;
  if (a.status !== "aceito") return { ok: false, erro: "Este aditivo não está aguardando assinatura." };
  if (!ctx.email) return { ok: false, erro: "A conta precisa de um e-mail para receber o código." };
  const { data: ja } = await ctx.admin.from("contrato_aditivo_assinaturas").select("papel").eq("aditivo_id", a.id).eq("papel", ctx.papel).maybeSingle();
  if (ja) return { ok: false, erro: "Você já assinou este aditivo." };
  const agora = Date.now();
  const { data: atual } = await ctx.admin.from("contrato_aditivo_codigos").select("enviado_em").eq("aditivo_id", a.id).eq("user_id", ctx.userId).maybeSingle();
  if (!podeReenviar(atual as { enviado_em: string } | null, agora)) return { ok: false, erro: "Espere 1 minuto para pedir outro código." };
  const codigo = gerarCodigoAssinatura();
  const { error } = await ctx.admin.from("contrato_aditivo_codigos").upsert(
    {
      aditivo_id: a.id,
      user_id: ctx.userId,
      codigo_hash: hashCodigoAssinatura(ctx.userId, `aditivo:${a.id}`, codigo),
      expira_em: new Date(agora + VALIDADE_CODIGO_ASSINATURA_MS).toISOString(),
      falhas: 0,
      usado_em: null,
      enviado_em: new Date(agora).toISOString(),
    },
    { onConflict: "aditivo_id,user_id" },
  );
  if (error) return { ok: false, erro: "Não foi possível gerar o código. Tente de novo." };
  const m = emailCodigoAssinatura(SITE_URL, { imovel: `${ctx.c.properties?.title ?? "Imóvel"} (aditivo ${a.numero})`, codigo });
  const env = await sendEmail({ to: ctx.email, subject: m.assunto, text: m.text, evento: "contract_signature_code", usuarioId: ctx.userId, imagem: m.imagem, html: m.html });
  if (env.error) return { ok: false, erro: "Não foi possível enviar o e-mail agora. Tente de novo." };
  return { ok: true, valor: undefined };
}

export async function assinarAditivo(aditivoId: string, codigo: string, aceite: boolean): Promise<Res<{ completo: boolean }>> {
  const r = await carregarAditivo(aditivoId);
  if ("erro" in r) return { ok: false, erro: r.erro };
  const { ctx, a } = r;
  if (a.status !== "aceito" || !a.hash_documento) return { ok: false, erro: "Este aditivo não está aguardando assinatura." };
  if (!aceite) return { ok: false, erro: "Marque que leu e concorda com o aditivo." };
  const chave = { aditivo_id: a.id, user_id: ctx.userId };
  const { data: linha } = await ctx.admin.from("contrato_aditivo_codigos").select("codigo_hash, expira_em, falhas, usado_em, enviado_em").match(chave).maybeSingle();
  const lc = (linha as LinhaCodigo | null) ?? null;
  const conf = conferirCodigo(lc, codigo, ctx.userId, `aditivo:${a.id}`, Date.now());
  if (!conf.ok) {
    if (conf.contarFalha && lc) {
      await incrementarFalhas(
        async () => {
          const { data } = await ctx.admin.from("contrato_aditivo_codigos").select("falhas").match(chave).is("usado_em", null).maybeSingle();
          return data ? Number((data as { falhas: number }).falhas) : null;
        },
        async (de) => {
          const { data } = await ctx.admin.from("contrato_aditivo_codigos").update({ falhas: de + 1 }).match(chave).eq("falhas", de).is("usado_em", null).select("aditivo_id");
          return (data?.length ?? 0) > 0;
        },
      );
    }
    return { ok: false, erro: conf.erro };
  }
  const { data: consumido } = await ctx.admin.from("contrato_aditivo_codigos").update({ usado_em: new Date().toISOString() }).match(chave).eq("codigo_hash", lc!.codigo_hash).is("usado_em", null).select("aditivo_id");
  if (!consumido?.length) return { ok: false, erro: MSG_CODIGO_BLOQUEADO };
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim().slice(0, 64) || null;
  const { error } = await ctx.admin.from("contrato_aditivo_assinaturas").insert({ aditivo_id: a.id, papel: ctx.papel, user_id: ctx.userId, ip, hash_documento: a.hash_documento });
  if (error) return { ok: false, erro: error.code === "23505" ? "Você já assinou este aditivo." : "Não foi possível registrar a assinatura." };
  const { data: assinaturas } = await ctx.admin.from("contrato_aditivo_assinaturas").select("papel").eq("aditivo_id", a.id);
  const completo = new Set(((assinaturas ?? []) as { papel: string }[]).map((x) => x.papel)).size >= 2;
  if (completo) {
    const aplicado = await aplicarAditivo(ctx, a);
    if (!aplicado.ok) return aplicado;
    // Prompt 56: com as duas assinaturas, o aditivo entra no registro único como VN-CT-…-ADn, com o MESMO hash que as
    // duas partes assinaram (o conteúdo é o documento do aditivo). A falha fica no log; o aditivo já valeu.
    await registrarDocumento(ctx.admin, {
      prefixo: "VN-CT",
      tipo: "aditivo",
      ref: { tabela: "contrato_aditivos", id: a.id },
      partes: [ctx.c.properties?.owner_id, ctx.c.tenant_id],
      emitidoPor: ctx.userId,
      numero: numeroAditivo(numeroPublicoContrato(a.contrato_id), a.numero),
      conteudo: () => documentoDoAditivo(a).join("\n"),
    }).catch((e: unknown) => console.error("[aditivo] registro:", e instanceof Error ? e.message : e));
  } else {
    avisar(ctx.admin, outraParte(ctx), "estadia_aditivo_respondido", a.contrato_id);
  }
  revalidar(a.contrato_id);
  return { ok: true, valor: { completo } };
}

/**
 * Só com as duas assinaturas: blocos não iniciados refeitos, datas, ocupantes e valor mensal atualizados — tudo ou
 * nada, na função aplicar_aditivo (0198), que nunca apaga um bloco com pagamento registrado.
 */
async function aplicarAditivo(ctx: Contexto, a: LinhaAditivo): Promise<Res<{ completo: boolean }>> {
  const { data } = await ctx.admin
    .from("contratos")
    .select("id, aluguel_mensal, qtd_ocupantes, capacidade_snapshot, tamanho_bloco_meses, properties(max_guests), contrato_blocos(id, numero_bloco, inicio, fim, meses, valor, caucao, caucao_status, status)")
    .eq("id", a.contrato_id)
    .single();
  const atual = data as unknown as LinhaContratoEstadia;
  const hoje = hojeEmBrasilia();
  const { manter, refazer, novos } = blocosDepoisDoAditivo(paraAditivo(atual), a.mudancas, hoje);
  const ids = blocosOrdenados(atual).filter((b) => refazer.some((r) => r.numero_bloco === b.numero_bloco)).map((b) => b.id);
  const meses = manter.reduce((s, b) => s + Number(b.meses), 0) + novos.reduce((s, b) => s + b.meses, 0);
  const { data: aplicou, error } = await ctx.admin.rpc("aplicar_aditivo", {
    p_aditivo: a.id,
    p_refazer: ids,
    p_novos: novos,
    p_prazo_dias: meses * 30,
    p_qtd: a.mudancas.ocupantes?.depois ?? null,
    p_valor: a.mudancas.valorMensal?.depois ?? null,
  });
  if (error) {
    console.error("[aplicarAditivo]", error.code, error.message);
    return {
      ok: false,
      erro:
        error.code === "23P01"
          ? "As novas datas batem com outra estadia neste imóvel. As assinaturas ficaram registradas; fale com a Viva para ajustar."
          : "As duas assinaturas foram registradas, mas os blocos não foram atualizados. Fale com a Viva.",
    };
  }
  if (aplicou !== true) return { ok: true, valor: { completo: true } };
  await evento(ctx.admin, a.contrato_id, ctx.userId, "estadia_remarcada", { aditivo: a.id, numero: a.numero, mudancas: a.mudancas });
  // Prompt 38: a limpeza/lavanderia automática da saída ganha a janela nova (mesma chave, nunca outro pedido).
  await aoEventoDaEstadia(ctx.admin, a.contrato_id, { tipo: "estadia_remarcada" });
  // Prompt 55-E2: as mensagens programadas que ainda não saíram ganham o horário das datas novas.
  await reagendarProgramadas(ctx.admin, a.contrato_id);
  for (const id of [ctx.c.tenant_id, String(ctx.c.properties?.owner_id ?? "")]) if (id) avisar(ctx.admin, id, "estadia_remarcada", a.contrato_id);
  // E205-B2: o aditivo assinado aceita os blocos novos pelas duas partes — se um deles começa em até 3 dias sem
  // pagamento, o lembrete sai agora (a chave segura o cron).
  after(() => lembreteDeBlocoNoAceite(ctx.admin, a.contrato_id).catch(() => 0));
  return { ok: true, valor: { completo: true } };
}

// ── Encerrar contrato (regras desligadas: a Viva conduz) ──────────────────────────────────────────────────────────

export async function pedirEncerramento(contratoId: string, motivo: string, texto?: string | null): Promise<Res> {
  const ctx = await contextoDaEstadia(contratoId);
  if ("erro" in ctx) return { ok: false, erro: ctx.erro };
  if (ctx.c.status !== "ativo") return { ok: false, erro: "Este contrato já está encerrado." };
  const v = validarPedidoEncerramento({ motivo, texto });
  if (!v.ok) return { ok: false, erro: v.erro };
  // Chave desligada (padrão): nenhum valor de multa ou devolução é calculado; ligada, as regras entram aqui.
  const consequencias = consequenciasDoEncerramento(ENCERRAMENTO_REGRAS_ATIVO);
  const { data, error } = await ctx.admin
    .from("contrato_encerramento_pedidos")
    .insert({ contrato_id: ctx.c.id, pedido_por: ctx.userId, papel: ctx.papel, motivo: v.motivo, texto: v.texto })
    .select("id")
    .single();
  if (error || !data) return { ok: false, erro: error?.code === "23505" ? "Já existe um pedido de encerramento aberto para este contrato." : "Não foi possível registrar o pedido." };
  await evento(ctx.admin, ctx.c.id, ctx.userId, "encerramento_pedido", { pedido: data.id, motivo: v.motivo, consequencias });
  avisar(ctx.admin, outraParte(ctx), "estadia_encerramento_pedido", ctx.c.id);
  after(async () => {
    try {
      const { data: admins } = await ctx.admin.from("profiles").select("id").eq("role", "admin");
      for (const ad of (admins ?? []) as { id: string }[]) {
        const { data: u } = await ctx.admin.auth.admin.getUserById(ad.id);
        await notify({ event: "estadia_encerramento_equipe", email: u?.user?.email ?? undefined, userId: ad.id, pushUrl: "/admin/contratos/encerramentos", interno: true });
      }
    } catch {
      /* best-effort */
    }
  });
  revalidar(ctx.c.id);
  revalidatePath("/admin/contratos/encerramentos");
  return { ok: true, valor: undefined };
}

/** Admin: conduzir ou concluir o pedido. Concluir encerra o contrato (acerto de saída) e emite "contrato_encerrado". */
/**
 * Prompt 56: o encerramento concluído vira o ENC no registro único (hash do pedido e da conclusão), e a conferência de
 * saída aberta fecha junto, registrando quem não respondeu (sem janela automática nova na saída).
 */
async function registrarEncerramento(
  admin: SupabaseClient,
  pedido: { id: string; contrato_id: string; papel: string; motivo: string; texto: string | null; criado_em: string },
  adminId: string,
): Promise<void> {
  try {
    const { data: c } = await admin.from("contratos").select("tenant_id, properties(owner_id)").eq("id", pedido.contrato_id).maybeSingle();
    const ownerId = (c?.properties as unknown as { owner_id: string } | null)?.owner_id;
    const concluidoEm = new Date().toISOString();
    await registrarDocumento(admin, {
      prefixo: "ENC",
      tipo: "encerramento",
      ref: { tabela: "contrato_encerramento_pedidos", id: pedido.id },
      partes: [ownerId, c?.tenant_id as string | undefined],
      emitidoPor: adminId,
      conteudo: ({ numero }) =>
        [
          `Encerramento ${numero} · contrato ${numeroPublicoContrato(pedido.contrato_id)}`,
          `Pedido por: ${pedido.papel === "proprietario" ? "proprietário" : "morador"} em ${pedido.criado_em}`,
          `Motivo: ${rotuloMotivo(pedido.motivo)}${pedido.texto ? ` · ${pedido.texto}` : ""}`,
          `Concluído pela equipe em ${concluidoEm}; contrato em acerto de saída.`,
        ].join("\n"),
    });
    const { data: saida } = await admin.from("conferencias").select("id").eq("contrato_id", pedido.contrato_id).eq("tipo", "saida").is("fechada_em", null).maybeSingle();
    if (saida) await fecharConferencia(admin, saida.id as string, "encerramento_concluido");
  } catch (e) {
    console.error("[encerramento] registro:", e instanceof Error ? e.message : e);
  }
}

export async function atualizarPedidoEncerramento(pedidoId: string, status: "em_conducao" | "concluido"): Promise<Res> {
  if (!UUID_RE.test(String(pedidoId))) return { ok: false, erro: "Pedido inválido." };
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, erro: "Serviço indisponível." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return { ok: false, erro: "Só a equipe." };
  const { data: p } = await admin.from("contrato_encerramento_pedidos").select("id, contrato_id, status, papel, motivo, texto, criado_em").eq("id", pedidoId).maybeSingle();
  const pedido = p as { id: string; contrato_id: string; status: string; papel: string; motivo: string; texto: string | null; criado_em: string } | null;
  if (!pedido || pedido.status === "concluido") return { ok: false, erro: "Pedido não encontrado ou já concluído." };
  await admin.from("contrato_encerramento_pedidos").update({ status, atualizado_em: new Date().toISOString() }).eq("id", pedido.id).neq("status", "concluido");
  if (status === "concluido") {
    await admin.from("contratos").update({ status: "encerrado_em_acerto", encerrado_em: new Date().toISOString() }).eq("id", pedido.contrato_id).eq("status", "ativo");
    await evento(admin, pedido.contrato_id, user.id, "contrato_encerrado", { pedido: pedido.id });
    await registrarEncerramento(admin, pedido, user.id);
    // Prompt 38: a limpeza/lavanderia automática ainda não aceita é cancelada, com aviso ao parceiro.
    await aoEventoDaEstadia(admin, pedido.contrato_id, { tipo: "contrato_encerrado" });
    // Prompt 55-E2: contrato encerrado cancela as mensagens programadas que não saíram.
    await cancelarProgramadas(admin, pedido.contrato_id, "contrato_encerrado");
  }
  await logModeracao(supabase, user.id, status === "concluido" ? "concluir_encerramento" : "conduzir_encerramento", "contrato", pedido.contrato_id);
  revalidatePath("/admin/contratos/encerramentos");
  revalidar(pedido.contrato_id);
  return { ok: true, valor: undefined };
}
