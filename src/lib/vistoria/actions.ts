"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessaoAal2 } from "@/lib/data/admin-guard";
import { estadoIdentidade } from "@/lib/identidade/estado-servidor";
import { cnpjValido, cpfValido } from "@/lib/documento-pessoa";
import { contemContato } from "@/lib/pedidos/pedidos";
import { semMetadados } from "@/lib/foto-reconversao";
import { chaveCidade } from "@/lib/cidades";
import { vistoriaAtiva } from "./chave";
import { CATEGORIA_AVALIADOR, pendenciasDoCredenciamento, podeAprovarParaTeste, podeAtivar, solicitacaoDoAvaliador, validarPedidoAvaliador } from "./entrada";
import { slugBase } from "@/lib/parceiros/regras";
import {
  CODIGO_CONDUTA,
  PORTES,
  consequenciaAusencia,
  pedidoPodeAbrir,
  podeReagendar,
  porteDoImovel,
  precoVigente,
  propoeDescredenciamento,
  siglaCidade,
  transicaoCredenciamento,
  validarConduta,
  valorDoPedido,
  condicaoRetorno,
  linhaDaTabela,
  COLUNAS_PRECO,
  type LinhaPreco,
  type Porte,
  type StatusCredenciamento,
} from "./regras";
import { ROTA_ADMIN, ROTA_AVALIADOR, avisar, comTesteConcluido, designar, naFilaDoAdmin, passarAoProximo, rotaDono, rotaMorador } from "./servidor";

/*
  Prompt 62-B1 — ações da avaliação do imóvel. Cada ação confere QUEM é (dono do imóvel, avaliador designado, morador
  do imóvel ou admin com duas etapas) e grava com o cliente de serviço. O dono NUNCA escolhe o avaliador: nenhuma ação
  dele recebe avaliador (pedirAvaliacao só leva o imóvel). Com VISTORIA_ATIVA desligada, as ações do dono e do morador
  recusam; credenciamento e admin funcionam.
*/

export type Res = { ok: true; mensagem?: string } | { ok: false; erro: string };
const BUCKET = "avaliadores";
const TIPOS_EXPERIENCIA = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const SEM_ACESSO: Res = { ok: false, erro: "Esta ação não está disponível." };
const DESLIGADA: Res = { ok: false, erro: "A avaliação do imóvel ainda não está disponível." };

async function sessao() {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, admin, userId: user.id } : null;
}

async function exigirAdmin() {
  const s = await sessao();
  if (!s) return null;
  const { data: perfil } = await s.supabase.from("profiles").select("role").eq("id", s.userId).maybeSingle();
  if (!(perfil?.role === "admin" && (await sessaoAal2(s.supabase)))) return null;
  return s;
}

const texto = (v: FormDataEntryValue | null, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// ── Credenciamento (o parceiro pede) ───────────────────────────────────────────────────────────────────────────
export async function pedirCredenciamento(form: FormData): Promise<Res> {
  const s = await sessao();
  if (!s) return { ok: false, erro: "Entre na sua conta para pedir o credenciamento." };
  const { data: parc } = await s.admin.from("parceiros").select("id, documento, tipo_pessoa, categorias").eq("user_id", s.userId).maybeSingle();
  // Correção 62-B3: um só credenciamento por pessoa, seja ou não parceiro ainda.
  const { data: ja } = await s.admin.from("avaliadores_credenciamento").select("id").or(parc ? `parceiro_id.eq.${parc.id},user_id.eq.${s.userId}` : `user_id.eq.${s.userId}`).limit(1);
  if (ja?.length) return { ok: false, erro: "Você já pediu o credenciamento." };

  const arquivo = form.get("experienciaArquivo");
  const temArquivo = arquivo instanceof File && arquivo.size > 0;
  // Pedido único (62-B3): quem não é parceiro manda os dados de parceiro no mesmo formulário; quem já é, só os do
  // credenciamento. A identidade não recusa o pedido: fica como pendência (a aprovação para teste exige).
  const v = validarPedidoAvaliador({
    jaParceiro: !!parc,
    nome: String(form.get("nome") ?? ""),
    tipoPessoa: String(form.get("tipoPessoa") ?? ""),
    documento: String(form.get("documento") ?? ""),
    cidade: String(form.get("cidade") ?? ""),
    experienciaLink: String(form.get("experienciaLink") ?? ""),
    experienciaArquivo: temArquivo,
    aceiteConduta: form.get("aceiteConduta") === "on",
  });
  if (!v.ok) return { ok: false, erro: `Falta: ${v.falta.join(" ")}` };
  if (parc) {
    const doc = String(parc.documento ?? "");
    if (!(parc.tipo_pessoa === "pj" ? cnpjValido(doc) : cpfValido(doc))) return { ok: false, erro: "Falta: CPF ou CNPJ válido no cadastro de parceiro." };
  }
  const { cidade, experienciaLink: link } = v.valor;

  let experienciaPath: string | null = null;
  if (temArquivo) {
    const f = arquivo as File;
    if (!TIPOS_EXPERIENCIA.has(f.type) || f.size > 10 * 1024 * 1024) return { ok: false, erro: "Envie o portfólio em PDF ou imagem de até 10 MB." };
    const limpo = await semMetadados(new Uint8Array(await f.arrayBuffer()), f.type);
    if (!limpo) return { ok: false, erro: "Não foi possível ler o arquivo. Envie de novo." };
    experienciaPath = `${parc?.id ?? `u-${s.userId}`}/experiencia-${Date.now()}-${randomBytes(3).toString("hex")}`;
    const up = await s.admin.storage.from(BUCKET).upload(experienciaPath, Buffer.from(limpo), { contentType: f.type, upsert: false });
    if (up.error) return { ok: false, erro: "Não foi possível enviar o arquivo." };
  }

  // Relações declaradas: e-mails de proprietários e links/códigos de imóveis (resolvidos aqui; o texto também fica).
  const declaracao = texto(form.get("relacoes"), 1000);
  const emails = [...new Set((declaracao.match(/[^\s,;]+@[^\s,;]+\.[^\s,;]+/g) ?? []).map((e) => e.toLowerCase()))];
  const idsImoveis = [...new Set(declaracao.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? [])];
  const donos: string[] = [];
  if (emails.length) {
    const { data } = await s.admin.from("profiles").select("id, email").in("email", emails);
    donos.push(...((data ?? []) as { id: string }[]).map((p) => p.id));
  }
  const imoveis: string[] = [];
  if (idsImoveis.length) {
    const { data } = await s.admin.from("properties").select("id, owner_id").in("id", idsImoveis);
    for (const p of (data ?? []) as { id: string; owner_id: string }[]) {
      imoveis.push(p.id);
      donos.push(p.owner_id);
    }
  }

  // Quem não é parceiro: a solicitação de parceiro com a categoria "vistoria" (só por este caminho), ligada ao pedido.
  let solicitacaoId: string | null = null;
  if (!parc) {
    const { data: u } = await s.supabase.auth.getUser();
    const { data: sol, error: eSol } = await s.admin
      .from("parceiro_solicitacoes")
      .insert(solicitacaoDoAvaliador(v.valor.parceiro!, cidade, link, s.userId, u.user?.email?.toLowerCase() ?? null))
      .select("id")
      .single();
    if (eSol || !sol) {
      console.error("[pedirCredenciamento] solicitação", eSol?.code, eSol?.message);
      return { ok: false, erro: eSol?.code === "23505" ? "Você já tem um pedido de parceria em análise. Fale com o atendimento." : "Não foi possível registrar agora. Tente de novo." };
    }
    solicitacaoId = sol.id as string;
  }

  const { data: numero, error: eNum } = await s.admin.rpc("proximo_numero_avaliador", { p_sigla: siglaCidade(cidade) });
  if (eNum || !numero) return { ok: false, erro: "Não foi possível registrar agora. Tente de novo." };
  const { error } = await s.admin.from("avaliadores_credenciamento").insert({
    parceiro_id: parc?.id ?? null,
    user_id: s.userId,
    solicitacao_id: solicitacaoId,
    cidade,
    numero_credenciado: numero,
    experiencia_path: experienciaPath,
    experiencia_link: link,
    conduta_versao: CODIGO_CONDUTA.versao,
    relacoes_donos: [...new Set(donos)],
    relacoes_imoveis: imoveis,
    relacoes_descricao: declaracao || null,
  });
  if (error) {
    console.error("[pedirCredenciamento]", error.code, error.message);
    if (solicitacaoId) await s.admin.from("parceiro_solicitacoes").delete().eq("id", solicitacaoId);
    return { ok: false, erro: "Não foi possível registrar agora. Tente de novo." };
  }
  if (parc) {
    const categorias = [...new Set([...((parc.categorias as string[]) ?? []), CATEGORIA_AVALIADOR])];
    await s.admin.from("parceiros").update({ categorias }).eq("id", parc.id);
  }
  const identidade = await estadoIdentidade(s.admin, s.userId);
  const pend = pendenciasDoCredenciamento({ identidadeVerificada: identidade.estado === "confirmada" });
  revalidatePath(ROTA_AVALIADOR);
  revalidatePath(ROTA_ADMIN);
  return {
    ok: true,
    mensagem: `Pedido de credenciamento registrado: nº ${numero}. A Viva confere e marca a sua avaliação de teste.${pend.length ? ` Antes da aprovação: ${pend.join(" ").toLowerCase()}` : ""}`,
  };
}

// ── Admin (duas etapas) ────────────────────────────────────────────────────────────────────────────────────────
export async function adminDecidirCredenciamento(form: FormData): Promise<Res> {
  const a = await exigirAdmin();
  if (!a) return SEM_ACESSO;
  const id = String(form.get("id") ?? "");
  const para = String(form.get("para") ?? "") as StatusCredenciamento;
  const motivo = texto(form.get("motivo"), 500) || null;
  const { data: c } = await a.admin.from("avaliadores_credenciamento").select("status, user_id, parceiro_id, solicitacao_id").eq("id", id).maybeSingle();
  if (!c) return { ok: false, erro: "Credenciamento não encontrado." };
  if (!transicaoCredenciamento(c.status as StatusCredenciamento, para).ok) return { ok: false, erro: "Mudança de situação não permitida." };
  if ((para === "suspenso" || para === "descredenciado") && !motivo) return { ok: false, erro: "Escreva o motivo." };
  const agora = new Date().toISOString();
  // Correção 62-B3: "Aprovar para teste" é UMA aprovação — exige a identidade verificada e, para quem ainda não é
  // parceiro, ativa o parceiro (categoria "vistoria") na mesma ação.
  let parceiroId = (c.parceiro_id as string | null) ?? null;
  if (para === "em_teste") {
    const ident = c.user_id ? await estadoIdentidade(a.admin, c.user_id as string) : null;
    const pode = podeAprovarParaTeste({ status: c.status as string, identidadeVerificada: ident?.estado === "confirmada" });
    if (!pode.ok) return { ok: false, erro: pode.motivo };
    if (!parceiroId) {
      const r = await ativarParceiroDoAvaliador(a.admin, c.user_id as string, c.solicitacao_id as string | null, a.userId, agora);
      if (!r.ok) return r;
      parceiroId = r.parceiroId;
    }
  }
  // E30: ativar é a SEGUNDA aprovação, só com a avaliação de teste registrada (laudo emitido num pedido de teste).
  if (para === "ativo") {
    const feito = (await comTesteConcluido(a.admin, [id])).has(id);
    const pode = podeAtivar({ status: c.status as string, testeConcluido: feito });
    if (!pode.ok) return { ok: false, erro: pode.motivo };
  }
  await a.admin
    .from("avaliadores_credenciamento")
    .update({ status: para, motivo, decidido_por: a.userId, decidido_em: agora, parceiro_id: parceiroId, ...(para === "ativo" && c.status === "em_teste" ? { ativado_em: agora } : {}) })
    .eq("id", id);
  if (para === "em_teste") await naFilaDoAdmin(a.admin, "avaliacao_teste", { avaliadorId: id }, "Marcar a avaliação de teste num imóvel de teste e revisar.");
  if (para === "ativo") await a.admin.from("vistoria_fila_admin").update({ resolvido_em: agora, resolvido_por: a.userId }).eq("avaliador_id", id).in("tipo", ["avaliacao_teste", "suspensao_automatica"]).is("resolvido_em", null);
  revalidatePath(ROTA_ADMIN);
  return { ok: true };
}

/**
 * Ativa o parceiro do candidato a avaliador a partir da solicitação ligada (categoria "vistoria"), sem o link de
 * ativação por e-mail: a pessoa já está logada na própria conta e a aprovação é uma só.
 */
async function ativarParceiroDoAvaliador(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  solicitacaoId: string | null,
  adminId: string,
  agora: string,
): Promise<{ ok: true; parceiroId: string } | { ok: false; erro: string }> {
  const { data: existente } = await admin.from("parceiros").select("id, categorias").eq("user_id", userId).maybeSingle();
  if (existente) {
    const categorias = [...new Set([...((existente.categorias as string[]) ?? []), CATEGORIA_AVALIADOR])];
    await admin.from("parceiros").update({ categorias }).eq("id", existente.id);
    return { ok: true, parceiroId: existente.id as string };
  }
  if (!solicitacaoId) return { ok: false, erro: "Pedido sem os dados de parceiro." };
  const { data: sol } = await admin.from("parceiro_solicitacoes").select("id, nome, tipo_pessoa, documento, cidades, descricao, telefone").eq("id", solicitacaoId).maybeSingle();
  if (!sol) return { ok: false, erro: "Pedido sem os dados de parceiro." };
  const base = slugBase(sol.nome as string);
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base.slice(0, 54)}-${i + 1}`;
    const { data: p, error } = await admin
      .from("parceiros")
      .insert({
        user_id: userId,
        solicitacao_id: sol.id,
        tipo_pessoa: sol.tipo_pessoa,
        documento: sol.documento,
        razao_social: sol.tipo_pessoa === "pj" ? sol.nome : null,
        nome_publico: String(sol.nome).slice(0, 80),
        slug,
        categorias: [CATEGORIA_AVALIADOR],
        cidades: sol.cidades,
        descricao: sol.descricao,
        telefone: sol.telefone,
        status: "rascunho",
      })
      .select("id")
      .single();
    if (!error && p) {
      await admin.from("parceiro_solicitacoes").update({ status: "ativada", decidido_por: adminId, decidido_em: agora, atualizado_em: agora }).eq("id", sol.id);
      return { ok: true, parceiroId: p.id as string };
    }
    if (error && (error.code !== "23505" || !/slug/.test(error.message))) {
      console.error("[ativarParceiroDoAvaliador]", error.code, error.message);
      return { ok: false, erro: "Não foi possível ativar o parceiro agora. Tente de novo." };
    }
  }
  return { ok: false, erro: "Não foi possível ativar o parceiro agora. Tente de novo." };
}

/** Avaliação de TESTE: o admin aponta um imóvel de teste (is_teste) e o avaliador em teste; a designação é direta. */
export async function adminCriarAvaliacaoTeste(form: FormData): Promise<Res> {
  const a = await exigirAdmin();
  if (!a) return SEM_ACESSO;
  const avaliadorId = String(form.get("avaliadorId") ?? "");
  const propertyId = String(form.get("propertyId") ?? "");
  const { data: c } = await a.admin.from("avaliadores_credenciamento").select("status, parceiros(user_id)").eq("id", avaliadorId).maybeSingle();
  if (c?.status !== "em_teste") return { ok: false, erro: "O avaliador precisa estar em teste." };
  const { data: im } = await a.admin.from("properties").select("id, owner_id, city, bedrooms").eq("id", propertyId).maybeSingle();
  if (!im) return { ok: false, erro: "Imóvel não encontrado." };
  const { data: dono } = await a.admin.from("profiles").select("is_teste").eq("id", im.owner_id).maybeSingle();
  if (!dono?.is_teste) return { ok: false, erro: "A avaliação de teste é só em imóvel de conta de teste." };
  const agora = new Date().toISOString();
  const { data: p, error } = await a.admin
    .from("vistoria_pedidos")
    .insert({ property_id: im.id, owner_id: im.owner_id, cidade: im.city ?? "", porte: porteDoImovel(im.bedrooms as number), valor_tabela: 0, status: "designado", avaliador_id: avaliadorId, designado_em: agora, teste: true })
    .select("id")
    .single();
  if (error || !p) return { ok: false, erro: "Este imóvel já tem uma avaliação aberta." };
  await a.admin.from("vistoria_designacoes").insert({ pedido_id: p.id, avaliador_id: avaliadorId, designado_em: agora });
  await avisar(a.admin, (c.parceiros as unknown as { user_id: string } | null)?.user_id, "vistoria_designada", ROTA_AVALIADOR);
  revalidatePath(ROTA_ADMIN);
  return { ok: true };
}

/** Tabela de preço: cada mudança é uma linha nova (histórico); vale a mais recente. Sem valor no código. */
export async function adminSalvarPreco(form: FormData): Promise<Res> {
  const a = await exigirAdmin();
  if (!a) return SEM_ACESSO;
  const cidade = texto(form.get("cidade"), 80);
  const porte = String(form.get("porte") ?? "") as Porte;
  const valor = Number(String(form.get("valor") ?? "").replace(/\./g, "").replace(",", "."));
  const inclui = texto(form.get("inclui"), 300) || null;
  if (!chaveCidade(cidade)) return { ok: false, erro: "Informe a cidade." };
  if (!PORTES.includes(porte)) return { ok: false, erro: "Escolha o porte." };
  if (!(valor > 0) || valor > 100_000) return { ok: false, erro: "Informe um valor válido." };
  // Adendo 62-B1: condição de retorno (opcional, depois da cotação). Os dois vazios = não existe; um só = erro.
  const diasTxt = String(form.get("retornoDias") ?? "").trim();
  const pctTxt = String(form.get("retornoPercentual") ?? "").trim().replace(",", ".");
  let retorno: { dias: number; percentual: number } | null = null;
  if (diasTxt || pctTxt) {
    retorno = condicaoRetorno({ retornoDias: diasTxt ? Number(diasTxt) : null, retornoPercentual: pctTxt ? Number(pctTxt) : null });
    if (!retorno) return { ok: false, erro: "Condição de retorno: preencha os dois campos (dias inteiros e desconto de 1 a 100%) ou deixe os dois vazios." };
  }
  const { error } = await a.admin.from("vistoria_precos").insert({
    cidade,
    porte,
    valor: Math.round(valor * 100) / 100,
    inclui_texto: inclui,
    retorno_dias: retorno?.dias ?? null,
    retorno_percentual: retorno?.percentual ?? null,
    alterado_por: a.userId,
  });
  if (error) return { ok: false, erro: "Não foi possível salvar." };
  revalidatePath(ROTA_ADMIN);
  return { ok: true };
}

export async function adminRevisarAuditoria(form: FormData): Promise<Res> {
  const a = await exigirAdmin();
  if (!a) return SEM_ACESSO;
  const id = String(form.get("id") ?? "");
  const resultado = String(form.get("resultado") ?? "");
  const motivo = texto(form.get("motivo"), 500) || null;
  if (resultado !== "confere" && resultado !== "nao_confere") return { ok: false, erro: "Escolha confere ou não confere." };
  if (resultado === "nao_confere" && !motivo) return { ok: false, erro: "Escreva o motivo." };
  const agora = new Date();
  const { data: linha } = await a.admin
    .from("vistoria_auditoria")
    .update({ resultado, motivo, revisado_por: a.userId, revisado_em: agora.toISOString() })
    .eq("id", id)
    .is("resultado", null)
    .select("avaliador_id")
    .maybeSingle();
  if (!linha) return { ok: false, erro: "Revisão já registrada." };
  const { data: revisoes } = await a.admin.from("vistoria_auditoria").select("resultado, revisado_em").eq("avaliador_id", linha.avaliador_id).not("resultado", "is", null);
  const lista = ((revisoes ?? []) as { resultado: "confere" | "nao_confere"; revisado_em: string }[]).map((r) => ({ resultado: r.resultado, em: r.revisado_em }));
  if (propoeDescredenciamento(lista, agora)) await naFilaDoAdmin(a.admin, "proposta_descredenciamento", { avaliadorId: linha.avaliador_id }, "2 laudos que não conferem em 12 meses.");
  revalidatePath(ROTA_ADMIN);
  return { ok: true };
}

export async function adminResolverFila(form: FormData): Promise<Res> {
  const a = await exigirAdmin();
  if (!a) return SEM_ACESSO;
  await a.admin.from("vistoria_fila_admin").update({ resolvido_em: new Date().toISOString(), resolvido_por: a.userId }).eq("id", String(form.get("id") ?? "")).is("resolvido_em", null);
  revalidatePath(ROTA_ADMIN);
  return { ok: true };
}

// ── O dono pede a avaliação (só o imóvel: o avaliador é a Viva que designa) ─────────────────────────────────────
export async function pedirAvaliacao(form: FormData): Promise<Res> {
  const propertyId = String(form.get("propertyId") ?? "");
  const s = await sessao();
  if (!s) return { ok: false, erro: "Entre na sua conta." };
  const { data: im } = await s.admin.from("properties").select("id, owner_id, status, city, bedrooms").eq("id", propertyId).maybeSingle();
  if (!im || im.owner_id !== s.userId) return SEM_ACESSO;
  const agora = new Date();
  const { data: tabela } = await s.admin.from("vistoria_precos").select(COLUNAS_PRECO).eq("cidade", im.city ?? "");
  const linhas: LinhaPreco[] = ((tabela ?? []) as Parameters<typeof linhaDaTabela>[0][]).map(linhaDaTabela);
  const porte = porteDoImovel(im.bedrooms as number);
  const preco = precoVigente(linhas, im.city ?? "", porte, agora);
  // Prompt 62-B2: o anúncio que a Viva tirou da busca (segurança grave ou 3º strike) volta justamente por nova avaliação.
  const { data: bloq } = await s.admin.from("vistoria_bloqueios").select("id").eq("property_id", im.id).is("resolvido_em", null).limit(1);
  const pode = pedidoPodeAbrir({ chaveAtiva: await vistoriaAtiva(), anuncioPublicado: im.status === "active" || !!bloq?.length, preco });
  if (!pode.ok) return { ok: false, erro: pode.motivo };
  // Imóvel ocupado agora: a visita só acontece com a concordância do morador.
  const hoje = agora.toISOString().slice(0, 10);
  const { data: contratos } = await s.admin.from("contratos").select("tenant_id, contrato_blocos(inicio, fim, status)").eq("property_id", im.id).eq("status", "ativo");
  const ocupante = ((contratos ?? []) as { tenant_id: string; contrato_blocos: { inicio: string; fim: string; status: string | null }[] | null }[]).find((c) =>
    (c.contrato_blocos ?? []).some((b) => b.status !== "nao_aceito" && b.inicio <= hoje && b.fim >= hoje),
  );
  const { data: dono } = await s.admin.from("profiles").select("is_teste").eq("id", s.userId).maybeSingle();
  // Adendo 62-B1: depois de "reprovado" ou de ressalva vencida, é NOVA AVALIAÇÃO (novo pedido completo, outro avaliador
  // pelo rodízio): valor da tabela, menos a condição de retorno da cidade só se ela existir e estiver no prazo.
  const { data: ultimo } = await s.admin.from("vistoria_laudos").select("resultado, emitido_em, ressalva_vencida_em").eq("property_id", im.id).order("emitido_em", { ascending: false }).limit(1).maybeSingle();
  const desde = ultimo?.resultado === "reprovado" ? (ultimo.emitido_em as string) : ((ultimo?.ressalva_vencida_em as string | null | undefined) ?? null);
  const tipo = desde ? "nova_avaliacao" : "inicial";
  const cobranca = valorDoPedido(tipo, preco!, desde, agora);
  const { data: p, error } = await s.admin
    .from("vistoria_pedidos")
    .insert({
      property_id: im.id,
      owner_id: s.userId,
      cidade: im.city ?? "",
      tipo,
      porte,
      valor_tabela: cobranca.valor,
      retorno_percentual_aplicado: cobranca.retorno?.percentual ?? null,
      ocupado: !!ocupante,
      morador_id: ocupante?.tenant_id ?? null,
      teste: dono?.is_teste === true,
    })
    .select("id")
    .single();
  if (error || !p) return { ok: false, erro: "Este imóvel já tem uma avaliação em andamento." };
  const designado = await designar(s.admin, p.id, agora);
  if (designado) await avisar(s.admin, s.userId, "vistoria_designado_dono", rotaDono(im.id));
  revalidatePath(`/dashboard/imoveis/${im.id}/nivel`);
  return { ok: true, mensagem: designado ? "Pedido registrado. A Viva designou o avaliador credenciado." : "Pedido registrado. A Viva está designando o avaliador." };
}

// ── O avaliador designado ──────────────────────────────────────────────────────────────────────────────────────
async function comoAvaliador(pedidoId: string) {
  const s = await sessao();
  if (!s) return null;
  const { data: p } = await s.admin
    .from("vistoria_pedidos")
    .select("id, property_id, owner_id, morador_id, status, ocupado, agendado_para, concordancia_em, reagendou_avaliador, avaliador_id, avaliadores_credenciamento(id, parceiros(user_id))")
    .eq("id", pedidoId)
    .maybeSingle();
  const cred = (p?.avaliadores_credenciamento as unknown as { id: string; parceiros: { user_id: string } | null } | null) ?? null;
  if (!p || cred?.parceiros?.user_id !== s.userId) return null;
  return { ...s, p };
}

export async function responderDesignacao(form: FormData): Promise<Res> {
  const c = await comoAvaliador(String(form.get("pedidoId") ?? ""));
  if (!c || c.p.status !== "designado") return SEM_ACESSO;
  const aceitar = form.get("resposta") === "aceitar";
  const agora = new Date();
  if (aceitar) {
    const { data } = await c.admin.from("vistoria_designacoes").update({ resposta: "aceita", respondido_em: agora.toISOString() }).eq("pedido_id", c.p.id).eq("avaliador_id", c.p.avaliador_id!).is("resposta", null).select("id");
    if (!data?.length) return { ok: false, erro: "O prazo de 24 horas para responder já passou." };
    await avisar(c.admin, c.p.owner_id, "vistoria_designado_dono", rotaDono(c.p.property_id));
  } else {
    await passarAoProximo(c.admin, c.p.id, c.p.avaliador_id!, "recusada", agora);
  }
  revalidatePath(ROTA_AVALIADOR);
  return { ok: true };
}

/** Agenda (ou reagenda) a visita. Imóvel ocupado: pede a concordância do morador antes de confirmar. */
export async function agendarVisita(form: FormData): Promise<Res> {
  const pedidoId = String(form.get("pedidoId") ?? "");
  // datetime-local vem sem fuso: é hora de Brasília (o servidor roda em UTC).
  const bruto = String(form.get("quando") ?? "");
  const quando = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(bruto) ? bruto : `${bruto}${bruto.length === 16 ? ":00" : ""}-03:00`);
  if (Number.isNaN(quando.getTime()) || quando.getTime() < Date.now()) return { ok: false, erro: "Escolha uma data e hora futuras." };
  const s = await sessao();
  if (!s) return SEM_ACESSO;
  const { data: p } = await s.admin
    .from("vistoria_pedidos")
    .select("id, property_id, owner_id, morador_id, status, ocupado, agendado_para, reagendou_dono, reagendou_avaliador, avaliador_id, avaliadores_credenciamento(parceiros(user_id))")
    .eq("id", pedidoId)
    .maybeSingle();
  if (!p) return SEM_ACESSO;
  const avaliadorUser = (p.avaliadores_credenciamento as unknown as { parceiros: { user_id: string } | null } | null)?.parceiros?.user_id;
  const parte = s.userId === p.owner_id ? "dono" : s.userId === avaliadorUser ? "avaliador" : null;
  if (!parte || !["designado", "agendado"].includes(p.status)) return SEM_ACESSO;
  if (parte === "dono" && !(await vistoriaAtiva())) return DESLIGADA;
  const { data: aceita } = await s.admin.from("vistoria_designacoes").select("id").eq("pedido_id", p.id).eq("avaliador_id", p.avaliador_id!).eq("resposta", "aceita").maybeSingle();
  if (!aceita) return { ok: false, erro: "O avaliador ainda não aceitou a designação." };
  const reagendando = !!p.agendado_para;
  if (reagendando) {
    const r = podeReagendar(p.agendado_para!, new Date(), parte === "dono" ? p.reagendou_dono : p.reagendou_avaliador);
    if (!r.ok) return { ok: false, erro: r.motivo };
  }
  const agora = new Date().toISOString();
  await s.admin
    .from("vistoria_pedidos")
    .update({
      agendado_para: quando.toISOString(),
      status: p.ocupado ? "designado" : "agendado",
      concordancia_em: null,
      concordancia_pedida_em: p.ocupado ? agora : null,
      lembrete_d1_em: null,
      atualizado_em: agora,
      ...(reagendando ? (parte === "dono" ? { reagendou_dono: true } : { reagendou_avaliador: true }) : {}),
    })
    .eq("id", p.id);
  if (p.ocupado) await avisar(s.admin, p.morador_id, "vistoria_concordancia", rotaMorador(p.id));
  else {
    await avisar(s.admin, p.owner_id, "vistoria_agendada", rotaDono(p.property_id));
    await avisar(s.admin, avaliadorUser, "vistoria_agendada", ROTA_AVALIADOR);
  }
  revalidatePath(ROTA_AVALIADOR);
  revalidatePath(`/dashboard/imoveis/${p.property_id}/nivel`);
  return { ok: true, mensagem: p.ocupado ? "Data proposta. A visita fica confirmada quando o morador concordar." : "Visita agendada." };
}

/** O morador concorda com a data (1 toque). Sem a concordância, a visita não acontece. */
export async function concordarVisita(form: FormData): Promise<Res> {
  if (!(await vistoriaAtiva())) return DESLIGADA;
  const s = await sessao();
  if (!s) return SEM_ACESSO;
  const { data: p } = await s.admin.from("vistoria_pedidos").select("id, property_id, owner_id, morador_id, ocupado, agendado_para, status, avaliadores_credenciamento(parceiros(user_id))").eq("id", String(form.get("pedidoId") ?? "")).maybeSingle();
  if (!p || p.morador_id !== s.userId || !p.ocupado || !p.agendado_para || p.status !== "designado") return SEM_ACESSO;
  await s.admin.from("vistoria_pedidos").update({ concordancia_em: new Date().toISOString(), status: "agendado", atualizado_em: new Date().toISOString() }).eq("id", p.id);
  await avisar(s.admin, p.owner_id, "vistoria_agendada", rotaDono(p.property_id));
  await avisar(s.admin, (p.avaliadores_credenciamento as unknown as { parceiros: { user_id: string } | null } | null)?.parceiros?.user_id, "vistoria_agendada", ROTA_AVALIADOR);
  revalidatePath(rotaMorador(p.id));
  return { ok: true, mensagem: "Obrigado. A visita está confirmada." };
}

/**
 * Ausência na visita agendada. Avaliador ausente (registrado pelo dono ou pelo admin): nova designação com prioridade,
 * sem custo ao dono, e conta para a suspensão automática. Dono ou morador ausente (registrado pelo avaliador): o pedido
 * fica "ausencia" e nova visita é novo pedido pela tabela.
 */
export async function registrarAusencia(form: FormData): Promise<Res> {
  const s = await sessao();
  if (!s) return SEM_ACESSO;
  const quem = String(form.get("quem") ?? "") as "dono" | "morador" | "avaliador";
  const { data: p } = await s.admin.from("vistoria_pedidos").select("id, property_id, owner_id, status, agendado_para, avaliador_id, avaliadores_credenciamento(parceiros(user_id))").eq("id", String(form.get("pedidoId") ?? "")).maybeSingle();
  if (!p || p.status !== "agendado" || !p.agendado_para || Date.parse(p.agendado_para) > Date.now()) return { ok: false, erro: "A ausência só pode ser registrada depois do horário da visita." };
  const avaliadorUser = (p.avaliadores_credenciamento as unknown as { parceiros: { user_id: string } | null } | null)?.parceiros?.user_id;
  const { data: perfil } = await s.supabase.from("profiles").select("role").eq("id", s.userId).maybeSingle();
  const ehAdmin = perfil?.role === "admin" && (await sessaoAal2(s.supabase));
  const c = consequenciaAusencia(quem);
  if (quem === "avaliador") {
    if (!(s.userId === p.owner_id || ehAdmin)) return SEM_ACESSO;
    await avisar(s.admin, avaliadorUser, "vistoria_ausencia", ROTA_AVALIADOR);
    await avisar(s.admin, p.owner_id, "vistoria_ausencia", rotaDono(p.property_id));
    await passarAoProximo(s.admin, p.id, p.avaliador_id!, "ausencia", new Date());
    revalidatePath(`/dashboard/imoveis/${p.property_id}/nivel`);
    return { ok: true, mensagem: c.redesignarComPrioridade ? "Ausência do avaliador registrada. A Viva designa outro avaliador, sem custo para você." : undefined };
  }
  if (!(s.userId === avaliadorUser || ehAdmin)) return SEM_ACESSO;
  await s.admin.from("vistoria_pedidos").update({ status: "ausencia", atualizado_em: new Date().toISOString() }).eq("id", p.id);
  await avisar(s.admin, p.owner_id, "vistoria_ausencia", rotaDono(p.property_id));
  revalidatePath(ROTA_AVALIADOR);
  return { ok: true, mensagem: "Ausência registrada. Uma nova visita é um novo pedido pela tabela." };
}

// ── Pagamento direto (a plataforma só registra) ────────────────────────────────────────────────────────────────
export async function marcarRecebido(form: FormData): Promise<Res> {
  const c = await comoAvaliador(String(form.get("pedidoId") ?? ""));
  if (!c || !["realizada", "laudo_emitido"].includes(c.p.status)) return SEM_ACESSO;
  await c.admin.from("vistoria_pedidos").update({ recebido_marcado_em: new Date().toISOString() }).eq("id", c.p.id).is("recebido_marcado_em", null);
  revalidatePath(ROTA_AVALIADOR);
  return { ok: true };
}

export async function confirmarRecebido(form: FormData): Promise<Res> {
  const s = await sessao();
  if (!s) return SEM_ACESSO;
  const { data: p } = await s.admin.from("vistoria_pedidos").select("id, owner_id, property_id, recebido_marcado_em").eq("id", String(form.get("pedidoId") ?? "")).maybeSingle();
  if (!p || p.owner_id !== s.userId || !p.recebido_marcado_em) return SEM_ACESSO;
  await s.admin.from("vistoria_pedidos").update({ recebido_confirmado_em: new Date().toISOString() }).eq("id", p.id).is("recebido_confirmado_em", null);
  revalidatePath(`/dashboard/imoveis/${p.property_id}/nivel`);
  return { ok: true };
}

// ── Avaliação mútua: só conduta ────────────────────────────────────────────────────────────────────────────────
export async function avaliarConduta(form: FormData): Promise<Res> {
  const s = await sessao();
  if (!s) return SEM_ACESSO;
  const { data: p } = await s.admin.from("vistoria_pedidos").select("id, owner_id, property_id, status, avaliador_id, avaliadores_credenciamento(parceiros(user_id))").eq("id", String(form.get("pedidoId") ?? "")).maybeSingle();
  if (!p || p.status !== "laudo_emitido" || !p.avaliador_id) return { ok: false, erro: "A avaliação de conduta abre depois do laudo." };
  const avaliadorUser = (p.avaliadores_credenciamento as unknown as { parceiros: { user_id: string } | null } | null)?.parceiros?.user_id;
  const autor = s.userId === p.owner_id ? "dono" : s.userId === avaliadorUser ? "avaliador" : null;
  if (!autor) return SEM_ACESSO;
  const notas: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) if (k.startsWith("nota_")) notas[k.slice(5)] = v;
  const v = validarConduta(autor, notas, String(form.get("comentario") ?? ""), contemContato);
  if (!v.ok) return { ok: false, erro: v.erro };
  const { error } = await s.admin.from("vistoria_conduta").insert({ pedido_id: p.id, autor, avaliador_id: p.avaliador_id, ...v.notas, comentario: v.texto });
  if (error) return { ok: false, erro: "Você já avaliou esta visita." };
  revalidatePath(autor === "dono" ? `/dashboard/imoveis/${p.property_id}/nivel` : ROTA_AVALIADOR);
  return { ok: true };
}
