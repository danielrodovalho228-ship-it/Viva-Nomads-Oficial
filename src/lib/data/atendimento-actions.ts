"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { situacaoLimite, HORA } from "@/lib/limites";
import { guardContactInfo } from "@/lib/messages/contact-guard";
import { textoEmail } from "@/lib/notifications/texto-seguro";
import { isValidEmail } from "@/lib/auth-errors";
import {
  calcularPrazos,
  dentroDoHorario,
  mensagemPrazo,
  PRAZO_MANUTENCAO_H,
  type Prioridade,
  type UrgenciaManutencao,
} from "@/config/atendimento";
import { avisoEmergencia, categoria, classificar, ehNumeroPublico, numeroEmergencia } from "@/lib/atendimento/classificar";
import { avisarEquipe, avisarProprietarioManutencao, avisarUsuario, criarOrdemManutencao, pessoaValida, type ChamadoResumo, type OrdemCriada } from "@/lib/atendimento/servidor";
import { escalarParaPessoa, rodarViva, vivaAtiva, chamarClaude } from "@/lib/atendimento/viva-servidor";
import { atenderViva } from "@/lib/atendimento/viva-motor";
import { CENARIOS, entradaDoCenario, falhasDoCenario, ferramentasDeTeste } from "@/lib/atendimento/viva-cenarios";
import { AVISO_VIVA, ehGolpe, ORIENTACAO_GOLPE } from "@/lib/atendimento/viva-regras";

/**
 * Atendimento (PR 1, sem IA). TODA escrita é do servidor (service role) depois
 * da checagem — o banco não deixa ninguém gravar chamado pela API (0073). A
 * leitura do próprio chamado usa o cliente da pessoa (RLS).
 */

type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTEXTOS = ["pedido", "contrato", "anuncio"] as const;
type Contexto = (typeof CONTEXTOS)[number];

async function ipHashAtual(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim() || "desconhecido";
  return crypto.createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "viva-nomads").update(`ip:${ip}`).digest("hex").slice(0, 32);
}

function limpar(texto: string, max: number): string {
  return guardContactInfo((texto ?? "").replace(/\s+\n/g, "\n").trim().slice(0, max)).text;
}

/** O contexto informado é mesmo da pessoa? (senão, é descartado). */
async function contextoValido(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  tipo: Contexto,
  id: string
): Promise<boolean> {
  if (!UUID_RE.test(id)) return false;
  if (tipo === "pedido") {
    const { data } = await admin.from("pedidos_moradia").select("id").eq("id", id).eq("inquilino_id", userId).maybeSingle();
    return !!data;
  }
  if (tipo === "contrato") {
    const { data } = await admin.from("contratos").select("id, tenant_id, properties(owner_id)").eq("id", id).maybeSingle();
    const dono = (data?.properties as { owner_id?: string } | null)?.owner_id;
    return !!data && (data.tenant_id === userId || dono === userId);
  }
  // Anúncio: público (qualquer um pode reportar um anúncio que existe).
  const { data } = await admin.from("properties").select("id").eq("id", id).maybeSingle();
  return !!data;
}

export interface AbrirChamadoInput {
  categoria: string;
  mensagem: string;
  assunto?: string;
  canal?: "site" | "app";
  contextoTipo?: Contexto | null;
  contextoId?: string | null;
  /** Manutenção: contrato e detalhes. */
  contratoId?: string | null;
  urgencia?: UrgenciaManutencao;
  categoriaManutencao?: string;
  /** Visitante (sem login). */
  visitanteNome?: string;
  visitanteEmail?: string;
}

export async function abrirChamado(
  input: AbrirChamadoInput
): Promise<Res<{ numero: string; aviso: string; emergencia: boolean }>> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, error: "Atendimento indisponível no momento. Tente de novo em instantes." };
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const mensagem = (input.mensagem ?? "").trim();
  if (mensagem.length < 5) return { ok: false, error: "Conte em poucas palavras o que aconteceu (mínimo de 5 letras)." };
  if (mensagem.length > 4000) return { ok: false, error: "Mensagem longa demais (máx. 4.000 caracteres)." };

  let visitanteEmail: string | null = null;
  let visitanteNome: string | null = null;
  if (!user) {
    visitanteEmail = (input.visitanteEmail ?? "").trim().toLowerCase().slice(0, 254);
    visitanteNome = (input.visitanteNome ?? "").trim().slice(0, 60) || null;
    if (!isValidEmail(visitanteEmail)) return { ok: false, error: "Informe um e-mail válido para receber a resposta." };
  }

  // Limite: 8 chamados por hora por pessoa (ou por IP, para visitante).
  const chaveLimite = user ? `chamado:u:${user.id}` : `chamado:ip:${await ipHashAtual()}`;
  if ((await situacaoLimite(chaveLimite, 8, HORA)) === "estourou") {
    return { ok: false, error: "Muitos chamados em pouco tempo. Se for urgente, responda no chamado que já está aberto." };
  }

  const cat = categoria(input.categoria) ?? categoria("duvida")!;
  const { tipo, prioridade: prioridadeBase, emergencia } = classificar(cat.key, mensagem);
  let prioridade: Prioridade = prioridadeBase;
  const agora = new Date();

  // Contexto (pedido/contrato/anúncio) só se for da pessoa.
  let contextoTipo: Contexto | "manutencao" | null = null;
  let contextoId: string | null = null;
  if (user && input.contextoTipo && CONTEXTOS.includes(input.contextoTipo) && input.contextoId) {
    if (await contextoValido(admin, user.id, input.contextoTipo, input.contextoId)) {
      contextoTipo = input.contextoTipo;
      contextoId = input.contextoId;
    }
  }

  // Manutenção: cria a ordem para o proprietário (inquilino com contrato ativo).
  let serviceOrderId: string | null = null;
  let manut: OrdemCriada | null = null;
  if (tipo === "manutencao") {
    if (!user) return { ok: false, error: "Entre na sua conta para pedir manutenção." };
    const contratoId = input.contratoId ?? (contextoTipo === "contrato" ? contextoId : null);
    if (!contratoId) return { ok: false, error: "Escolha o contrato do imóvel." };
    const r = await criarOrdemManutencao({ tenantId: user.id, contratoId, mensagem, urgencia: input.urgencia, categoria: input.categoriaManutencao });
    if (!r.ok) return { ok: false, error: r.error };
    manut = r.ordem;
    serviceOrderId = manut.serviceOrderId;
    contextoTipo = "manutencao";
    contextoId = serviceOrderId;
    if (prioridade !== "p1") prioridade = manut.urgencia === "urgente" ? "p2" : "p3";
  }

  const prazos = calcularPrazos(prioridade, agora);
  // Com a Viva ligada, ela atende primeiro (menos emergência/P1, que já vão para uma pessoa).
  const comViva = vivaAtiva() && !emergencia && prioridade !== "p1";
  const assunto = limpar(input.assunto?.trim() || mensagem.split("\n")[0], 140) || cat.rotulo;
  const { data: chamado, error } = await admin
    .from("chamados")
    .insert({
      usuario_id: user?.id ?? null,
      visitante_email: visitanteEmail,
      visitante_nome: visitanteNome,
      tipo,
      categoria: cat.key,
      prioridade,
      canal: input.canal === "app" ? "app" : "site",
      assunto,
      contexto_tipo: contextoTipo,
      contexto_id: contextoId,
      service_order_id: serviceOrderId,
      responsavel_tipo: comViva ? "ia" : "humano",
      prazo_primeira_resposta: prazos.primeiraResposta.toISOString(),
      prazo_resolucao: prazos.resolucao.toISOString(),
    })
    .select("id, numero_publico, assunto, prioridade, usuario_id, visitante_email, visitante_nome")
    .single();
  if (error || !chamado) {
    console.error("[atendimento] abrir:", error?.message);
    return { ok: false, error: "Não foi possível abrir o chamado agora. Tente de novo em instantes." };
  }
  const c = chamado as ChamadoResumo;

  // Mensagem da pessoa + resposta automática (emergência primeiro; prazo).
  const aviso = [
    emergencia ? avisoEmergencia(emergencia) : null,
    ehGolpe(mensagem) ? ORIENTACAO_GOLPE : null,
    manut
      ? `Abrimos o pedido de manutenção para o proprietário: ele tem até ${PRAZO_MANUTENCAO_H[manut.urgencia]} horas para responder. Você acompanha por aqui.`
      : null,
    comViva ? AVISO_VIVA : mensagemPrazo(prioridade, agora),
  ]
    .filter(Boolean)
    .join(" ");
  await admin.from("chamado_mensagens").insert([
    { chamado_id: c.id, autor: "usuario", autor_id: user?.id ?? null, corpo: limpar(mensagem, 4000) },
    { chamado_id: c.id, autor: "sistema", corpo: aviso },
  ]);
  await admin.from("chamado_eventos").insert({
    chamado_id: c.id,
    ator_tipo: user ? "usuario" : "sistema",
    ator_id: user?.id ?? null,
    acao: "aberto",
    para: prioridade,
    detalhe: `${cat.key}${emergencia ? ` · emergência: ${emergencia}` : ""}${dentroDoHorario(agora) ? "" : " · fora do horário"}`,
  });

  // Avisos: pessoa (número do chamado), equipe (P1/P2), proprietário (manutenção).
  await avisarUsuario(c, "chamado_aberto", `<p style="margin:12px 0 0;color:#334155;">${textoEmail(aviso, 600)}</p>`);
  if (prioridade === "p1" || prioridade === "p2") {
    await avisarEquipe(c, emergencia ? `EMERGÊNCIA (${emergencia}) — orientado a ligar ${numeroEmergencia(emergencia)}` : cat.rotulo);
  }
  if (manut) await avisarProprietarioManutencao(manut, agora);
  if (comViva) after(() => rodarViva(c.id));

  return { ok: true, numero: c.numero_publico, aviso, emergencia: !!emergencia };
}

export interface ChamadoLista {
  id: string;
  numero_publico: string;
  assunto: string;
  status: string;
  prioridade: Prioridade;
  tipo: string;
  criado_em: string;
  atualizado_em: string;
}

/** Meus chamados (RLS: só os da pessoa). */
export async function meusChamados(): Promise<ChamadoLista[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("chamados")
    .select("id, numero_publico, assunto, status, prioridade, tipo, criado_em, atualizado_em")
    .eq("usuario_id", user.id)
    .order("atualizado_em", { ascending: false })
    .limit(50);
  return (data ?? []) as ChamadoLista[];
}

export interface MensagemChamado {
  id: number;
  autor: "usuario" | "ia" | "admin" | "sistema";
  corpo: string;
  interno?: boolean;
  criado_em: string;
}

/** Um chamado da pessoa, pelo número (RLS esconde notas internas). */
export async function meuChamado(numero: string): Promise<{ chamado: ChamadoLista & { nota_satisfacao: number | null; responsavel_tipo: string }; mensagens: MensagemChamado[] } | null> {
  if (!ehNumeroPublico(numero)) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: c } = await supabase
    .from("chamados")
    .select("id, numero_publico, assunto, status, prioridade, tipo, criado_em, atualizado_em, nota_satisfacao, responsavel_tipo")
    .eq("numero_publico", numero.trim().toUpperCase())
    .maybeSingle();
  if (!c) return null;
  const { data: m } = await supabase
    .from("chamado_mensagens")
    .select("id, autor, corpo, criado_em")
    .eq("chamado_id", c.id)
    .order("criado_em", { ascending: true });
  return { chamado: c as ChamadoLista & { nota_satisfacao: number | null; responsavel_tipo: string }, mensagens: (m ?? []) as MensagemChamado[] };
}

/** A pessoa responde no próprio chamado (reabre se estava resolvido). */
export async function responderMeuChamado(chamadoId: string, texto: string): Promise<Res> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin || !UUID_RE.test(chamadoId)) return { ok: false, error: "Chamado inválido." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre na sua conta." };
  const corpo = (texto ?? "").trim();
  if (corpo.length < 1 || corpo.length > 4000) return { ok: false, error: "Escreva a mensagem (até 4.000 caracteres)." };
  if ((await situacaoLimite(`chamado-msg:${user.id}`, 40, HORA)) === "estourou") {
    return { ok: false, error: "Muitas mensagens em pouco tempo. Aguarde um pouco." };
  }
  // RLS confirma que o chamado é dela.
  const { data: c } = await supabase.from("chamados").select("id, status, prioridade, responsavel_tipo").eq("id", chamadoId).maybeSingle();
  if (!c) return { ok: false, error: "Chamado não encontrado." };
  if (c.status === "encerrado") return { ok: false, error: "Este chamado foi encerrado. Abra um novo, se precisar." };

  const { prioridade: prioridadeTexto, emergencia } = classificar("duvida", corpo);
  const urgente = prioridadeTexto === "p1";
  await admin.from("chamado_mensagens").insert({ chamado_id: c.id, autor: "usuario", autor_id: user.id, corpo: limpar(corpo, 4000) });
  if (emergencia) await admin.from("chamado_mensagens").insert({ chamado_id: c.id, autor: "sistema", corpo: avisoEmergencia(emergencia) });
  // Golpe: orientação na hora (num chamado com a Viva, ela mesma diz isso ao passar para a equipe).
  else if (ehGolpe(corpo) && !(c.responsavel_tipo === "ia" && vivaAtiva())) await admin.from("chamado_mensagens").insert({ chamado_id: c.id, autor: "sistema", corpo: ORIENTACAO_GOLPE });
  const novoStatus = c.status === "aguardando_aprovacao" ? "aguardando_aprovacao" : "em_andamento";
  const mudancas: Record<string, unknown> = { status: novoStatus, atualizado_em: new Date().toISOString() };
  if (urgente && c.prioridade !== "p1") mudancas.prioridade = "p1";
  await admin.from("chamados").update(mudancas).eq("id", c.id);
  if (c.status === "resolvido") {
    await admin.from("chamado_eventos").insert({ chamado_id: c.id, ator_tipo: "usuario", ator_id: user.id, acao: "reaberto", de: "resolvido", para: novoStatus });
  }
  if (urgente && c.prioridade !== "p1") {
    await admin.from("chamado_eventos").insert({ chamado_id: c.id, ator_tipo: "sistema", acao: "prioridade", de: c.prioridade as string, para: "p1", detalhe: "texto indica risco" });
    const { data: full } = await admin.from("chamados").select("id, numero_publico, assunto, prioridade, usuario_id").eq("id", c.id).single();
    if (full) await avisarEquipe(full as ChamadoResumo, "subiu para P1 pela mensagem da pessoa");
  }
  if (c.responsavel_tipo === "ia" && vivaAtiva()) after(() => rodarViva(c.id as string));
  return { ok: true };
}

/** "Falar com uma pessoa" (botão no chamado). Passa na hora, sem insistir. */
export async function pedirPessoa(chamadoId: string): Promise<Res> {
  const supabase = await createClient();
  if (!supabase || !UUID_RE.test(chamadoId)) return { ok: false, error: "Chamado inválido." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre na sua conta." };
  // RLS confirma que o chamado é dela.
  const { data: c } = await supabase.from("chamados").select("id").eq("id", chamadoId).maybeSingle();
  if (!c) return { ok: false, error: "Chamado não encontrado." };
  return (await escalarParaPessoa(chamadoId, "a pessoa pediu", "usuario", user.id)) ? { ok: true } : { ok: false, error: "Este chamado já foi encerrado." };
}

/** "Falar com uma pessoa" pelo link do e-mail (assinado; vale para visitante). */
export async function pedirPessoaPorLink(chamadoId: string, assinatura: string): Promise<Res> {
  if (!UUID_RE.test(chamadoId) || !pessoaValida(chamadoId, assinatura)) return { ok: false, error: "Link inválido." };
  if ((await situacaoLimite(`pessoa-link:${chamadoId}`, 5, HORA)) === "estourou") return { ok: false, error: "Aguarde um pouco." };
  return (await escalarParaPessoa(chamadoId, "a pessoa pediu (link do e-mail)", "usuario")) ? { ok: true } : { ok: false, error: "Este chamado já foi encerrado." };
}

/** "Sim, resolveu" — a pessoa fecha o chamado que a Viva respondeu (e recebe o pedido de nota). */
export async function marcarResolvido(chamadoId: string): Promise<Res> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin || !UUID_RE.test(chamadoId)) return { ok: false, error: "Chamado inválido." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre na sua conta." };
  const { data: c } = await supabase
    .from("chamados")
    .select("id, numero_publico, assunto, prioridade, status, usuario_id, visitante_email, visitante_nome")
    .eq("id", chamadoId)
    .maybeSingle();
  if (!c || c.status !== "aguardando_usuario") return { ok: false, error: "Este chamado não está aguardando você." };
  const agora = new Date().toISOString();
  await admin.from("chamados").update({ status: "resolvido", resolvido_em: agora, atualizado_em: agora }).eq("id", c.id);
  await admin.from("chamado_eventos").insert({ chamado_id: c.id, ator_tipo: "usuario", ator_id: user.id, acao: "status", de: "aguardando_usuario", para: "resolvido", detalhe: "a pessoa marcou como resolvido" });
  await avisarUsuario(c as ChamadoResumo, "chamado_resolvido");
  return { ok: true };
}

/** Contratos ativos do inquilino (para o pedido de manutenção). */
export async function meusContratosAtivos(): Promise<{ id: string; titulo: string }[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("contratos")
    .select("id, status, properties(title)")
    .eq("tenant_id", user.id)
    .in("status", ["ativo", "encerrado_em_acerto"])
    .limit(20);
  return (data ?? []).map((c) => ({
    id: c.id as string,
    titulo: ((c.properties as { title?: string } | null)?.title as string) ?? "Imóvel",
  }));
}

// ═══════════════════════════ ADMIN ═══════════════════════════════════════════

async function exigirAdmin(): Promise<{ admin: NonNullable<ReturnType<typeof createAdminClient>>; userId: string } | null> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return null;
  return { admin, userId: user.id };
}

export interface ChamadoAdmin extends ChamadoLista {
  canal: string;
  categoria: string;
  contexto_tipo: string | null;
  contexto_id: string | null;
  service_order_id: string | null;
  responsavel_tipo: string;
  responsavel_admin: string | null;
  prazo_primeira_resposta: string;
  prazo_resolucao: string;
  primeira_resposta_em: string | null;
  sla_estado: string;
  nota_satisfacao: number | null;
  usuario_id: string | null;
  visitante_email: string | null;
  visitante_nome: string | null;
}

const COLS_ADMIN =
  "id, numero_publico, assunto, status, prioridade, tipo, canal, categoria, contexto_tipo, contexto_id, service_order_id, responsavel_tipo, responsavel_admin, prazo_primeira_resposta, prazo_resolucao, primeira_resposta_em, sla_estado, nota_satisfacao, usuario_id, visitante_email, visitante_nome, criado_em, atualizado_em";

export interface FiltrosFila {
  status?: string;
  prioridade?: string;
  tipo?: string;
  responsavel?: string;
  busca?: string;
  aprovacao?: boolean;
  fechados?: boolean;
}

/** Fila do admin (simulação fora). Ordem: prioridade, depois prazo. */
export async function filaAtendimento(f: FiltrosFila = {}): Promise<ChamadoAdmin[] | null> {
  const ctx = await exigirAdmin();
  if (!ctx) return null;
  let q = ctx.admin.from("chamados").select(COLS_ADMIN).eq("simulacao", false);
  if (f.aprovacao) q = q.eq("status", "aguardando_aprovacao");
  else if (f.status) q = q.eq("status", f.status);
  else if (!f.fechados) q = q.not("status", "in", "(resolvido,encerrado)");
  if (f.prioridade && /^p[1-4]$/.test(f.prioridade)) q = q.eq("prioridade", f.prioridade);
  if (f.tipo && ["suporte", "manutencao", "seguranca"].includes(f.tipo)) q = q.eq("tipo", f.tipo);
  if (f.responsavel === "ia" || f.responsavel === "humano") q = q.eq("responsavel_tipo", f.responsavel);
  const busca = (f.busca ?? "").trim().slice(0, 60);
  if (busca) {
    q = ehNumeroPublico(busca) ? q.eq("numero_publico", busca.toUpperCase()) : q.ilike("assunto", `%${busca.replace(/[%_]/g, "")}%`);
  }
  const { data } = await q.order("prioridade", { ascending: true }).order("prazo_primeira_resposta", { ascending: true }).limit(200);
  return (data ?? []) as ChamadoAdmin[];
}

export async function chamadoAdmin(id: string): Promise<{
  chamado: ChamadoAdmin;
  mensagens: MensagemChamado[];
  eventos: { acao: string; de: string | null; para: string | null; detalhe: string | null; ator_tipo: string; criado_em: string }[];
  pessoa: { nome: string | null; papel: string | null; criado_em: string | null } | null;
  contextoLink: string | null;
} | null> {
  const ctx = await exigirAdmin();
  if (!ctx || !UUID_RE.test(id)) return null;
  const { data: c } = await ctx.admin.from("chamados").select(COLS_ADMIN).eq("id", id).maybeSingle();
  if (!c) return null;
  const [{ data: m }, { data: e }, pessoa] = await Promise.all([
    ctx.admin.from("chamado_mensagens").select("id, autor, corpo, interno, criado_em").eq("chamado_id", id).order("criado_em"),
    ctx.admin.from("chamado_eventos").select("acao, de, para, detalhe, ator_tipo, criado_em").eq("chamado_id", id).order("criado_em"),
    c.usuario_id
      ? ctx.admin.from("profiles").select("full_name, role, created_at").eq("id", c.usuario_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const ch = c as ChamadoAdmin;
  const contextoLink =
    ch.contexto_tipo === "anuncio" && ch.contexto_id
      ? `/imoveis/${ch.contexto_id}`
      : ch.contexto_tipo === "pedido"
        ? "/admin/pedidos"
        : ch.contexto_tipo === "contrato"
          ? null
          : null;
  const p = (pessoa as { data: { full_name?: string; role?: string; created_at?: string } | null }).data;
  return {
    chamado: ch,
    mensagens: (m ?? []) as MensagemChamado[],
    eventos: (e ?? []) as { acao: string; de: string | null; para: string | null; detalhe: string | null; ator_tipo: string; criado_em: string }[],
    pessoa: p ? { nome: p.full_name ?? null, papel: p.role ?? null, criado_em: p.created_at ?? null } : null,
    contextoLink,
  };
}

/** Admin responde (ou grava nota interna). 1ª resposta pública marca o SLA. */
export async function responderComoAdmin(id: string, texto: string, interno: boolean): Promise<Res> {
  const ctx = await exigirAdmin();
  if (!ctx || !UUID_RE.test(id)) return { ok: false, error: "Sem permissão." };
  const corpo = (texto ?? "").trim().slice(0, 5000);
  if (!corpo) return { ok: false, error: "Escreva a resposta." };
  const { data: c } = await ctx.admin
    .from("chamados")
    .select("id, numero_publico, assunto, prioridade, usuario_id, visitante_email, visitante_nome, status, primeira_resposta_em")
    .eq("id", id)
    .maybeSingle();
  if (!c) return { ok: false, error: "Chamado não encontrado." };
  await ctx.admin.from("chamado_mensagens").insert({ chamado_id: id, autor: "admin", autor_id: ctx.userId, corpo, interno });
  if (!interno) {
    const agora = new Date().toISOString();
    // Resposta da equipe: o chamado passa a ser dela (a Viva não volta a responder nele).
    const mud: Record<string, unknown> = { status: "aguardando_usuario", atualizado_em: agora, responsavel_admin: ctx.userId, responsavel_tipo: "humano" };
    if (!c.primeira_resposta_em) mud.primeira_resposta_em = agora;
    await ctx.admin.from("chamados").update(mud).eq("id", id);
    await ctx.admin.from("chamado_eventos").insert({ chamado_id: id, ator_tipo: "admin", ator_id: ctx.userId, acao: "respondido", de: c.status as string, para: "aguardando_usuario" });
    await avisarUsuario(c as ChamadoResumo, "chamado_respondido", `<blockquote style="margin:12px 0 0;padding:10px 14px;border-left:3px solid #1c6b3a;color:#334155;">${textoEmail(corpo, 1500)}</blockquote>`);
  }
  return { ok: true };
}

/** Admin muda prioridade, status ou responsável (com auditoria). */
export async function alterarChamado(
  id: string,
  mud: { prioridade?: string; status?: string; atribuirAMim?: boolean }
): Promise<Res> {
  const ctx = await exigirAdmin();
  if (!ctx || !UUID_RE.test(id)) return { ok: false, error: "Sem permissão." };
  const { data: c } = await ctx.admin
    .from("chamados")
    .select("id, numero_publico, assunto, prioridade, status, usuario_id, visitante_email, visitante_nome, criado_em")
    .eq("id", id)
    .maybeSingle();
  if (!c) return { ok: false, error: "Chamado não encontrado." };
  const upd: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  const eventos: Record<string, unknown>[] = [];
  if (mud.prioridade && /^p[1-4]$/.test(mud.prioridade) && mud.prioridade !== c.prioridade) {
    const novos = calcularPrazos(mud.prioridade as Prioridade, new Date(c.criado_em as string));
    upd.prioridade = mud.prioridade;
    upd.prazo_primeira_resposta = novos.primeiraResposta.toISOString();
    upd.prazo_resolucao = novos.resolucao.toISOString();
    eventos.push({ acao: "prioridade", de: c.prioridade, para: mud.prioridade });
  }
  const STATUS = ["aberto", "aguardando_usuario", "aguardando_aprovacao", "em_andamento", "resolvido", "encerrado"];
  if (mud.status && STATUS.includes(mud.status) && mud.status !== c.status) {
    upd.status = mud.status;
    if (mud.status === "resolvido") upd.resolvido_em = new Date().toISOString();
    if (mud.status === "encerrado") upd.encerrado_em = new Date().toISOString();
    eventos.push({ acao: "status", de: c.status, para: mud.status });
  }
  if (mud.atribuirAMim) {
    upd.responsavel_admin = ctx.userId;
    upd.responsavel_tipo = "humano";
    eventos.push({ acao: "atribuido", para: "admin" });
  }
  if (eventos.length === 0) return { ok: true };
  const { error } = await ctx.admin.from("chamados").update(upd).eq("id", id);
  if (error) return { ok: false, error: "Não foi possível salvar." };
  await ctx.admin.from("chamado_eventos").insert(eventos.map((e) => ({ ...e, chamado_id: id, ator_tipo: "admin", ator_id: ctx.userId })));
  if (mud.status === "resolvido") await avisarUsuario(c as ChamadoResumo, "chamado_resolvido");
  return { ok: true };
}

export interface Macro {
  id: string;
  titulo: string;
  corpo: string;
}

export async function listarMacros(): Promise<Macro[]> {
  const ctx = await exigirAdmin();
  if (!ctx) return [];
  const { data } = await ctx.admin.from("chamado_macros").select("id, titulo, corpo").order("titulo");
  return (data ?? []) as Macro[];
}

export async function salvarMacro(m: { id?: string; titulo: string; corpo: string }): Promise<Res> {
  const ctx = await exigirAdmin();
  if (!ctx) return { ok: false, error: "Sem permissão." };
  const titulo = (m.titulo ?? "").trim().slice(0, 80);
  const corpo = (m.corpo ?? "").trim().slice(0, 3000);
  if (!titulo || !corpo) return { ok: false, error: "Preencha título e texto." };
  const linha = { titulo, corpo, atualizado_por: ctx.userId, atualizado_em: new Date().toISOString() };
  const { error } =
    m.id && UUID_RE.test(m.id)
      ? await ctx.admin.from("chamado_macros").update(linha).eq("id", m.id)
      : await ctx.admin.from("chamado_macros").insert(linha);
  return error ? { ok: false, error: "Não foi possível salvar." } : { ok: true };
}

export async function apagarMacro(id: string): Promise<Res> {
  const ctx = await exigirAdmin();
  if (!ctx || !UUID_RE.test(id)) return { ok: false, error: "Sem permissão." };
  const { error } = await ctx.admin.from("chamado_macros").delete().eq("id", id);
  return error ? { ok: false, error: "Não foi possível apagar." } : { ok: true };
}

/** Admin: "boa resposta" ou "corrigir" numa resposta da Viva (melhora macros e FAQ). */
export async function avaliarRespostaIA(chamadoId: string, mensagemId: number, nota: "boa" | "corrigir", correcao?: string): Promise<Res> {
  const ctx = await exigirAdmin();
  if (!ctx || !UUID_RE.test(chamadoId) || !Number.isInteger(mensagemId)) return { ok: false, error: "Sem permissão." };
  const { data: m } = await ctx.admin.from("chamado_mensagens").select("id").eq("id", mensagemId).eq("chamado_id", chamadoId).eq("autor", "ia").maybeSingle();
  if (!m) return { ok: false, error: "Resposta não encontrada." };
  const texto = (correcao ?? "").trim().slice(0, 2000);
  if (nota === "corrigir" && texto.length < 3) return { ok: false, error: "Escreva como a resposta deveria ser." };
  await ctx.admin.from("chamado_eventos").insert({
    chamado_id: chamadoId,
    ator_tipo: "admin",
    ator_id: ctx.userId,
    acao: nota === "boa" ? "ia_boa_resposta" : "ia_corrigir",
    de: String(mensagemId),
    detalhe: nota === "corrigir" ? texto : null,
  });
  return { ok: true };
}

export interface ResultadoCenario {
  n: number;
  mensagem: string;
  critico: boolean;
  quemResolve: string;
  prazo: string;
  rota: string;
  destino: string;
  prioridade: string;
  resposta: string | null;
  falhas: string[];
  chamadas: number;
}

/**
 * Admin: roda os 14 cenários com a IA DE VERDADE (ferramentas de mentira, nada
 * toca o banco). Custa ~14 atendimentos; limitado a 3 rodadas por dia.
 */
export async function testarViva(): Promise<{ ok: true; resultados: ResultadoCenario[] } | { ok: false; error: string }> {
  const ctx = await exigirAdmin();
  if (!ctx) return { ok: false, error: "Sem permissão." };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "Falta a ANTHROPIC_API_KEY na Vercel." };
  if ((await situacaoLimite("viva:teste", 3, 24 * HORA)) === "estourou") return { ok: false, error: "Limite de 3 rodadas por dia." };
  const modelo = chamarClaude();
  const resultados = await Promise.all(
    CENARIOS.map(async (c) => {
      const r = await atenderViva(entradaDoCenario(c), modelo, ferramentasDeTeste());
      return {
        n: c.n,
        mensagem: c.mensagem,
        critico: c.critico,
        quemResolve: c.esperado.quemResolve,
        prazo: c.esperado.prazo,
        rota: r.rota,
        destino: r.destino,
        prioridade: r.prioridade,
        resposta: r.resposta,
        falhas: falhasDoCenario(c, r),
        chamadas: r.uso.chamadas,
      };
    })
  );
  return { ok: true, resultados };
}

export async function metricasAtendimento(dias = 30): Promise<Record<string, unknown> | null> {
  const ctx = await exigirAdmin();
  if (!ctx) return null;
  const { data, error } = await ctx.admin.rpc("admin_atendimento_metricas", { p_dias: dias });
  if (error) return null;
  // Qualidade da Viva: "boa resposta" × "corrigir" no período (+ as últimas correções).
  const desde = new Date(Date.now() - Math.max(1, Math.min(dias, 400)) * 24 * HORA * 1000).toISOString();
  const { data: fb } = await ctx.admin
    .from("chamado_eventos")
    .select("acao, detalhe, criado_em, chamados!inner(numero_publico, simulacao)")
    .in("acao", ["ia_boa_resposta", "ia_corrigir"])
    .eq("chamados.simulacao", false)
    .gte("criado_em", desde)
    .order("criado_em", { ascending: false })
    .limit(500);
  const lista = fb ?? [];
  return {
    ...(data as Record<string, unknown>),
    viva_boas: lista.filter((e) => e.acao === "ia_boa_resposta").length,
    viva_corrigir: lista.filter((e) => e.acao === "ia_corrigir").length,
    viva_correcoes: lista
      .filter((e) => e.acao === "ia_corrigir")
      .slice(0, 10)
      .map((e) => ({ numero: (e.chamados as unknown as { numero_publico?: string })?.numero_publico ?? "", texto: e.detalhe as string, em: e.criado_em as string })),
  };
}
