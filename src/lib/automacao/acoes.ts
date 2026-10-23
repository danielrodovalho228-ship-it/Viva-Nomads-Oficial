"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, type NotificationEvent } from "@/lib/notifications";
import { ehAdmin } from "@/lib/data/admin-guard";
import { logModeracao } from "@/lib/data/moderacao-log";
import { integracoesSimuladas } from "@/lib/integracoes";
import { buscarParceiros } from "@/lib/data/parceiros-publico";
import { rotuloCategoria } from "@/lib/parceiros/regras";
import { evento, rota } from "@/lib/parceiros/pedido-servidor";
import { automacaoDaEstadia, criarPedidoAutomatico, enviarAoParceiro } from "./servidor";
import { textoConvite, textoResposta } from "./textos-vinculo";
import { CATEGORIAS_VINCULO, ROTULO_GATILHO, type CategoriaVinculo, type Gatilho, type ModoVinculo } from "./pedidos-do-evento";

/*
  Ações do Prompt 38 ("Viva rodando automático"): o dono convida o parceiro fixo do imóvel, troca o modo e as
  instruções, encerra; o parceiro aceita ou recusa o convite; o dono confirma o pedido que espera o toque dele ou troca
  de parceiro. Toda escrita confere a sessão e a parte e grava com o cliente de serviço.
*/

type Res<T = null> = { ok: true; valor: T } | { ok: false; erro: string };
type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INSTRUCOES_MAX = 200;

async function sessao(): Promise<{ admin: Admin; userId: string } | { erro: string }> {
  const supabase = await createClient();
  if (!supabase) return { erro: "Entre para continuar." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { erro: "Entre para continuar." };
  const admin = createAdminClient();
  if (!admin) return { erro: "Não foi possível continuar agora. Tente de novo em instantes." };
  return { admin, userId: user.id };
}

async function avisoSimples(admin: Admin, destino: string, ev: NotificationEvent, url: string, texto?: { subject: string; body: (n?: string) => string }) {
  try {
    const { data } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", destino).maybeSingle();
    const d = data as { email: string | null; full_name: string | null; notif_email: boolean | null } | null;
    await notify({ event: ev, email: d?.notif_email === false ? undefined : (d?.email ?? undefined), name: d?.full_name ?? undefined, userId: destino, pushUrl: url, ...texto });
  } catch {
    /* aviso é complemento */
  }
}

const rotaParceiros = (propertyId: string) => `/dashboard/imoveis/${propertyId}/parceiros`;

async function imovelDoDono(admin: Admin, propertyId: string, userId: string): Promise<{ id: string; title: string | null; city: string | null } | null> {
  if (!UUID.test(propertyId)) return null;
  const { data } = await admin.from("properties").select("id, title, city").eq("id", propertyId).eq("owner_id", userId).maybeSingle();
  return (data as { id: string; title: string | null; city: string | null } | null) ?? null;
}

// ── Leitura: página "Parceiros do imóvel" ────────────────────────────────────────────────────────────────────────

export interface VinculoNaTela {
  id: string;
  categoria: CategoriaVinculo;
  status: "pendente" | "ativo";
  modo: ModoVinculo;
  instrucoes: string | null;
  parceiro: { id: string; nome: string; slug: string };
  servico: { id: string; titulo: string; precoBase: number | null; unidade: string | null } | null;
}

export interface OpcaoParceiro {
  id: string;
  nome: string;
  slug: string;
  servicos: { id: string; titulo: string; precoBase: number | null; unidade: string | null }[];
}

export interface ParceirosDoImovel {
  imovel: { id: string; titulo: string; cidade: string | null };
  vinculos: VinculoNaTela[];
  opcoes: Record<CategoriaVinculo, OpcaoParceiro[]>;
}

export async function parceirosDoImovel(propertyId: string): Promise<ParceirosDoImovel | null> {
  const s = await sessao();
  if ("erro" in s) return null;
  const im = await imovelDoDono(s.admin, propertyId, s.userId);
  if (!im) return null;
  const { data } = await s.admin
    .from("imovel_parceiros")
    .select("id, categoria, status, modo, instrucoes, parceiro_id, servico_id, parceiros(id, nome_publico, slug), parceiro_servicos(id, titulo, preco_base, unidade)")
    .eq("property_id", im.id)
    .in("status", ["pendente", "ativo"]);
  type L = {
    id: string;
    categoria: CategoriaVinculo;
    status: "pendente" | "ativo";
    modo: ModoVinculo;
    instrucoes: string | null;
    parceiros: { id: string; nome_publico: string; slug: string } | null;
    parceiro_servicos: { id: string; titulo: string; preco_base: number | string | null; unidade: string | null } | null;
  };
  const vinculos: VinculoNaTela[] = ((data ?? []) as unknown as L[])
    .filter((v) => v.parceiros)
    .map((v) => ({
      id: v.id,
      categoria: v.categoria,
      status: v.status,
      modo: v.modo,
      instrucoes: v.instrucoes,
      parceiro: { id: v.parceiros!.id, nome: v.parceiros!.nome_publico, slug: v.parceiros!.slug },
      servico: v.parceiro_servicos ? { id: v.parceiro_servicos.id, titulo: v.parceiro_servicos.titulo, precoBase: v.parceiro_servicos.preco_base == null ? null : Number(v.parceiro_servicos.preco_base), unidade: v.parceiro_servicos.unidade } : null,
    }));
  // Opções por categoria: parceiros publicados que atendem a cidade do imóvel, com os serviços da categoria.
  const opcoes = {} as Record<CategoriaVinculo, OpcaoParceiro[]>;
  const faltam = CATEGORIAS_VINCULO.filter((c) => !vinculos.some((v) => v.categoria === c));
  const listas = await Promise.all(faltam.map((c) => buscarParceiros({ categoria: c, cidade: im.city }).then((r) => r.lista)));
  const ids = [...new Set(listas.flat().map((p) => p.id))];
  const { data: sv } = ids.length
    ? await s.admin.from("parceiro_servicos").select("id, parceiro_id, categoria, titulo, preco_base, unidade").in("parceiro_id", ids).eq("ativo", true).order("criado_em")
    : { data: [] };
  const servicos = (sv ?? []) as { id: string; parceiro_id: string; categoria: string; titulo: string; preco_base: number | string | null; unidade: string | null }[];
  for (const c of CATEGORIAS_VINCULO) opcoes[c] = [];
  faltam.forEach((c, i) => {
    opcoes[c] = listas[i]
      .filter((p) => p.id && p.slug)
      .slice(0, 12)
      .map((p) => ({
        id: p.id,
        nome: p.nomePublico,
        slug: p.slug,
        servicos: servicos.filter((x) => x.parceiro_id === p.id && x.categoria === c).map((x) => ({ id: x.id, titulo: x.titulo, precoBase: x.preco_base == null ? null : Number(x.preco_base), unidade: x.unidade })),
      }));
  });
  return { imovel: { id: im.id, titulo: im.title ?? "Imóvel", cidade: im.city }, vinculos, opcoes };
}

// ── Dono: convidar, mudar, encerrar ──────────────────────────────────────────────────────────────────────────────

export interface EntradaVinculo {
  propertyId: string;
  categoria: string;
  parceiroId: string;
  servicoId?: string | null;
  modo: string;
  instrucoes?: string | null;
}

function validarModoInstrucoes(modo: string, instrucoes?: string | null): { modo: ModoVinculo; instrucoes: string | null } | { erro: string } {
  if (modo !== "confirmar" && modo !== "automatico") return { erro: "Escolha como o pedido sai." };
  const t = (instrucoes ?? "").replace(/\s+/g, " ").trim();
  if (t.length > INSTRUCOES_MAX) return { erro: `Instruções com até ${INSTRUCOES_MAX} caracteres.` };
  return { modo, instrucoes: t || null };
}

export async function convidarParceiroFixo(e: EntradaVinculo): Promise<Res<{ id: string }>> {
  const s = await sessao();
  if ("erro" in s) return { ok: false, erro: s.erro };
  const im = await imovelDoDono(s.admin, e.propertyId, s.userId);
  if (!im) return { ok: false, erro: "Imóvel não encontrado." };
  if (!(CATEGORIAS_VINCULO as readonly string[]).includes(e.categoria)) return { ok: false, erro: "Escolha a categoria." };
  const v = validarModoInstrucoes(e.modo, e.instrucoes);
  if ("erro" in v) return { ok: false, erro: v.erro };
  if (!UUID.test(e.parceiroId)) return { ok: false, erro: "Escolha o parceiro." };
  const { data: parc } = await s.admin.from("parceiros").select("id, user_id, status, categorias, nome_publico").eq("id", e.parceiroId).maybeSingle();
  const p = parc as { id: string; user_id: string; status: string; categorias: string[] | null; nome_publico: string | null } | null;
  if (!p || p.status !== "publicado" || !(p.categorias ?? []).includes(e.categoria)) return { ok: false, erro: "Este parceiro não atende essa categoria agora." };
  if (p.user_id === s.userId) return { ok: false, erro: "Você não pode se convidar." };
  if (e.servicoId) {
    if (!UUID.test(e.servicoId)) return { ok: false, erro: "Escolha o serviço." };
    const { data: sv } = await s.admin.from("parceiro_servicos").select("id").eq("id", e.servicoId).eq("parceiro_id", p.id).eq("categoria", e.categoria).eq("ativo", true).maybeSingle();
    if (!sv) return { ok: false, erro: "Escolha um serviço da lista do parceiro." };
  }
  const { data, error } = await s.admin
    .from("imovel_parceiros")
    .insert({ property_id: im.id, categoria: e.categoria, parceiro_id: p.id, servico_id: e.servicoId ?? null, modo: v.modo, instrucoes: v.instrucoes })
    .select("id")
    .single();
  if (error?.code === "23505") return { ok: false, erro: `Este imóvel já tem ${rotuloCategoria(e.categoria).toLowerCase()} fixa. Encerre a atual para trocar.` };
  if (error || !data) return { ok: false, erro: "Não foi possível enviar o convite. Tente de novo." };
  const { data: dono } = await s.admin.from("profiles").select("full_name").eq("id", s.userId).maybeSingle();
  await avisoSimples(
    s.admin,
    p.user_id,
    "vinculo_parceiro_convite",
    "/dashboard/parceiro#imoveis-fixos",
    textoConvite({ categoria: e.categoria, tituloImovel: im.title, cidade: im.city, nomeDono: (dono as { full_name: string | null } | null)?.full_name ?? null, nomeParceiro: p.nome_publico }),
  );
  revalidatePath(rotaParceiros(im.id));
  return { ok: true, valor: { id: (data as { id: string }).id } };
}

type LinhaVinculo = {
  id: string;
  property_id: string;
  categoria: string;
  status: string;
  parceiro_id: string;
  properties: { owner_id: string; title: string | null; city: string | null } | null;
  parceiros: { user_id: string; nome_publico: string | null } | null;
};

async function carregarVinculo(admin: Admin, vinculoId: string): Promise<LinhaVinculo | null> {
  if (!UUID.test(vinculoId)) return null;
  const { data } = await admin.from("imovel_parceiros").select("id, property_id, categoria, status, parceiro_id, properties(owner_id, title, city), parceiros(user_id, nome_publico)").eq("id", vinculoId).maybeSingle();
  return (data as unknown as LinhaVinculo | null) ?? null;
}

export async function atualizarVinculo(vinculoId: string, e: { modo: string; instrucoes?: string | null }): Promise<Res> {
  const s = await sessao();
  if ("erro" in s) return { ok: false, erro: s.erro };
  const v = await carregarVinculo(s.admin, vinculoId);
  if (!v || v.properties?.owner_id !== s.userId || !["pendente", "ativo"].includes(v.status)) return { ok: false, erro: "Vínculo não encontrado." };
  const m = validarModoInstrucoes(e.modo, e.instrucoes);
  if ("erro" in m) return { ok: false, erro: m.erro };
  const { error } = await s.admin.from("imovel_parceiros").update({ modo: m.modo, instrucoes: m.instrucoes }).eq("id", v.id).in("status", ["pendente", "ativo"]);
  if (error) return { ok: false, erro: "Não foi possível salvar." };
  revalidatePath(rotaParceiros(v.property_id));
  return { ok: true, valor: null };
}

/** Dono ou parceiro encerram. Pedido que ainda espera o toque do dono é cancelado junto. */
export async function encerrarVinculo(vinculoId: string): Promise<Res> {
  const s = await sessao();
  if ("erro" in s) return { ok: false, erro: s.erro };
  const v = await carregarVinculo(s.admin, vinculoId);
  const dono = v?.properties?.owner_id === s.userId;
  const parceiro = v?.parceiros?.user_id === s.userId;
  if (!v || (!dono && !parceiro) || !["pendente", "ativo"].includes(v.status)) return { ok: false, erro: "Vínculo não encontrado." };
  const { data } = await s.admin.from("imovel_parceiros").update({ status: "encerrado", respondido_em: new Date().toISOString() }).eq("id", v.id).in("status", ["pendente", "ativo"]).select("id");
  if (!data?.length) return { ok: false, erro: "O vínculo mudou. Atualize a página." };
  await s.admin.from("parceiro_pedidos").update({ status: "cancelado", atualizado_em: new Date().toISOString() }).eq("vinculo_id", v.id).eq("aguardando_dono", true).eq("status", "solicitado");
  revalidatePath(rotaParceiros(v.property_id));
  revalidatePath("/dashboard/parceiro");
  return { ok: true, valor: null };
}

// ── Parceiro: "Imóveis fixos" ────────────────────────────────────────────────────────────────────────────────────

export interface ImovelFixo {
  id: string;
  categoria: string;
  status: "pendente" | "ativo";
  modo: ModoVinculo;
  instrucoes: string | null;
  imovel: { bairro: string | null; cidade: string | null };
  servico: string | null;
}

/** Convites e vínculos ativos do parceiro logado. Endereço exato nunca: só bairro e cidade. */
export async function meusImoveisFixos(): Promise<ImovelFixo[]> {
  const s = await sessao();
  if ("erro" in s) return [];
  const { data: parc } = await s.admin.from("parceiros").select("id").eq("user_id", s.userId).maybeSingle();
  if (!parc) return [];
  const { data } = await s.admin
    .from("imovel_parceiros")
    .select("id, categoria, status, modo, instrucoes, properties(address, city), parceiro_servicos(titulo)")
    .eq("parceiro_id", (parc as { id: string }).id)
    .in("status", ["pendente", "ativo"])
    .order("criado_em", { ascending: false })
    .limit(100);
  return ((data ?? []) as unknown as { id: string; categoria: string; status: "pendente" | "ativo"; modo: ModoVinculo; instrucoes: string | null; properties: { address: string | null; city: string | null } | null; parceiro_servicos: { titulo: string } | null }[]).map(
    (v) => ({ id: v.id, categoria: v.categoria, status: v.status, modo: v.modo, instrucoes: v.instrucoes, imovel: { bairro: v.properties?.address ?? null, cidade: v.properties?.city ?? null }, servico: v.parceiro_servicos?.titulo ?? null }),
  );
}

export async function responderConviteFixo(vinculoId: string, aceitar: boolean): Promise<Res> {
  const s = await sessao();
  if ("erro" in s) return { ok: false, erro: s.erro };
  const v = await carregarVinculo(s.admin, vinculoId);
  if (!v || v.parceiros?.user_id !== s.userId || v.status !== "pendente") return { ok: false, erro: "Convite não encontrado." };
  const { data } = await s.admin
    .from("imovel_parceiros")
    .update({ status: aceitar ? "ativo" : "recusado", respondido_em: new Date().toISOString() })
    .eq("id", v.id)
    .eq("status", "pendente")
    .select("id");
  if (!data?.length) return { ok: false, erro: "O convite mudou. Atualize a página." };
  if (v.properties?.owner_id) {
    const dados = { categoria: v.categoria, tituloImovel: v.properties.title, cidade: v.properties.city, nomeDono: null, nomeParceiro: v.parceiros?.nome_publico ?? null };
    await avisoSimples(s.admin, v.properties.owner_id, "vinculo_parceiro_resposta", rotaParceiros(v.property_id), textoResposta(dados, aceitar));
  }
  revalidatePath("/dashboard/parceiro");
  return { ok: true, valor: null };
}

// ── Dono: confirmar o pedido automático (modo "confirmar") e trocar de parceiro ───────────────────────────────────

type LinhaAuto = {
  id: string;
  cliente_id: string;
  parceiro_id: string;
  property_id: string | null;
  contrato_id: string | null;
  vinculo_id: string | null;
  servico_id: string | null;
  categoria: string;
  status: string;
  origem: string;
  aguardando_dono: boolean;
  descricao: string | null;
  chave_automacao: string | null;
  gatilho: Gatilho | null;
  janela_inicio: string | null;
  janela_fim: string | null;
  parceiros: { user_id: string } | null;
};
const COLS = "id, cliente_id, parceiro_id, property_id, contrato_id, vinculo_id, servico_id, categoria, status, origem, aguardando_dono, descricao, chave_automacao, gatilho, janela_inicio, janela_fim, parceiros(user_id)";

async function pedidoDoDono(admin: Admin, pedidoId: string, userId: string): Promise<LinhaAuto | null> {
  if (!UUID.test(pedidoId)) return null;
  const { data } = await admin.from("parceiro_pedidos").select(COLS).eq("id", pedidoId).maybeSingle();
  const p = data as unknown as LinhaAuto | null;
  return p && p.cliente_id === userId && p.origem === "automatico" ? p : null;
}

export async function confirmarPedidoAutomatico(pedidoId: string): Promise<Res> {
  const s = await sessao();
  if ("erro" in s) return { ok: false, erro: s.erro };
  const p = await pedidoDoDono(s.admin, pedidoId, s.userId);
  if (!p || !p.aguardando_dono || p.status !== "solicitado") return { ok: false, erro: "Este pedido não espera a sua confirmação." };
  const agora = new Date();
  const { data } = await s.admin
    .from("parceiro_pedidos")
    .update({ aguardando_dono: false, enviado_em: agora.toISOString(), atualizado_em: agora.toISOString() })
    .eq("id", p.id)
    .eq("aguardando_dono", true)
    .eq("status", "solicitado")
    .select("id");
  if (!data?.length) return { ok: false, erro: "O pedido mudou. Atualize a página." };
  await evento(s.admin, p.id, s.userId, "confirmado_pelo_dono", {});
  await enviarAoParceiro(s.admin, p);
  revalidatePath(rota(p.id));
  revalidatePath("/dashboard/servicos");
  if (p.contrato_id) revalidatePath(`/dashboard/estadia/${p.contrato_id}`);
  return { ok: true, valor: null };
}

/**
 * Trocar de parceiro com 1 toque: cancela o pedido parado (solicitado) e manda o mesmo pedido ao próximo parceiro da
 * cidade que atende a categoria. A chave do pedido antigo ganha o sufixo da troca; o novo fica com a chave original.
 */
export async function trocarParceiro(pedidoId: string): Promise<Res<{ id: string; parceiro: string }>> {
  const s = await sessao();
  if ("erro" in s) return { ok: false, erro: s.erro };
  const p = await pedidoDoDono(s.admin, pedidoId, s.userId);
  if (!p || !p.chave_automacao || !p.gatilho || p.status !== "solicitado" || !p.property_id || !p.contrato_id) return { ok: false, erro: "Este pedido não pode trocar de parceiro agora." };
  const { data: im } = await s.admin.from("properties").select("city").eq("id", p.property_id).maybeSingle();
  const { data: tentados } = await s.admin.from("parceiro_pedidos").select("parceiro_id").like("chave_automacao", `${p.chave_automacao}%`);
  const excluir = new Set([p.parceiro_id, ...((tentados ?? []) as { parceiro_id: string }[]).map((x) => x.parceiro_id)]);
  const { lista } = await buscarParceiros({ categoria: p.categoria, cidade: (im as { city: string | null } | null)?.city ?? null });
  const proximo = lista.find((x) => !excluir.has(x.id));
  if (!proximo) return { ok: false, erro: "Não há outro parceiro dessa categoria na cidade agora. Busque na lista de parceiros." };
  const agora = new Date();
  const { data: cancelou } = await s.admin
    .from("parceiro_pedidos")
    .update({ status: "cancelado", chave_automacao: `${p.chave_automacao}:troca:${Date.now()}`, atualizado_em: agora.toISOString() })
    .eq("id", p.id)
    .eq("status", "solicitado")
    .select("id");
  if (!cancelou?.length) return { ok: false, erro: "O pedido mudou. Atualize a página." };
  await evento(s.admin, p.id, s.userId, "cancelar", { motivo: "troca_de_parceiro" });
  const descricaoBase = (p.descricao ?? ROTULO_GATILHO[p.gatilho]).split("\nServiço:")[0].replace(/\nFora da sua agenda: proponha outro horário\.$/, "");
  const novo = await criarPedidoAutomatico(s.admin, {
    ctx: { id: p.contrato_id, propertyId: p.property_id, ownerId: s.userId },
    acao: {
      tipo: "criar",
      categoria: p.categoria as CategoriaVinculo,
      gatilho: p.gatilho,
      vinculoId: "", // o parceiro novo não é o do vínculo: grava nulo
      parceiroId: proximo.id,
      servicoId: null,
      aguardandoDono: false,
      chave: p.chave_automacao,
      janela: p.janela_inicio && p.janela_fim ? { inicio: p.janela_inicio, fim: p.janela_fim, novaEntrada: null } : null,
      descricao: descricaoBase,
    },
    agora,
  });
  if (!novo) return { ok: false, erro: "O pedido antigo foi cancelado, mas o novo não saiu. Peça pela lista de parceiros." };
  revalidatePath("/dashboard/servicos");
  revalidatePath(`/dashboard/estadia/${p.contrato_id}`);
  return { ok: true, valor: { id: novo.id, parceiro: proximo.nomePublico } };
}

// ── Admin: rodar a automação do dia ──────────────────────────────────────────────────────────────────────────────

/**
 * Admin roda o passo diário do 38 na hora. De verdade só no laboratório ou com AUTOMACOES_ATIVO=1 (a mesma trava do
 * cron); fora disso, só conta o que sairia.
 */
export async function rodarAutomacaoAgora(): Promise<Res<{ simulado: boolean; automaticos: number; sugestoesMorador: number; semResposta: number }>> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, erro: "Serviço indisponível." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return { ok: false, erro: "Só a equipe." };
  const simulado = !(integracoesSimuladas() || process.env.AUTOMACOES_ATIVO === "1");
  const r = await automacaoDaEstadia(admin, new Date(), simulado);
  await logModeracao(supabase, user.id, simulado ? "simular_automacao_38" : "rodar_automacao_38", "automacao", user.id);
  revalidatePath("/admin/parceiros/pedidos");
  return { ok: true, valor: { simulado, ...r } };
}
