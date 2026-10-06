import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, DIA, HORA } from "@/lib/limites";
import { notify } from "@/lib/notifications";
import { textoEmail } from "@/lib/notifications/texto-seguro";
import { SITE_URL } from "@/lib/site";
import { calcularPrazos, frasePrazo, type Prioridade, type UrgenciaManutencao } from "@/config/atendimento";
import { MIN_FOTOS_PUBLICAR } from "@/lib/listing-completude";
import { atenderViva, maisUrgente, type ChamarModelo, type Ferramentas, type ResultadoViva } from "@/lib/atendimento/viva-motor";
import { contextoChamado, type FerramentaDef } from "@/lib/atendimento/viva-prompt";
import { aceitaEsforco, aceitaReserva, cotacaoDolar, custoUsd, modeloViva } from "@/lib/atendimento/viva-custo";
import { primeiroNome, RESPOSTA_PESSOA, ROTULO_APROVACAO } from "@/lib/atendimento/viva-regras";
import {
  avisarEquipe,
  avisarProprietarioManutencao,
  avisarUsuario,
  criarOrdemManutencao,
  linkPessoa,
  type ChamadoResumo,
} from "@/lib/atendimento/servidor";

/**
 * Assistente Viva — lado do SERVIDOR (nunca importar no cliente).
 *
 * Liga só com ATENDIMENTO_IA_ATIVO=on E ANTHROPIC_API_KEY. Sem isso, nada muda:
 * o chamado vai para a fila humana (PR 1). Roda DEPOIS da resposta (`after`),
 * então abrir ou responder um chamado nunca espera a IA.
 *
 * Toda ferramenta é filtrada pelo dono do chamado (usuario_id): a IA não tem
 * como ler nem mexer em dado de outra pessoa. Ações que ela não pode fazer
 * (estorno, plano, caução, documento, banir…) simplesmente não existem aqui.
 */

export function vivaAtiva(): boolean {
  return process.env.ATENDIMENTO_IA_ATIVO === "on" && !!process.env.ANTHROPIC_API_KEY;
}

/** Limite de custo: atendimentos da Viva por dia (ATENDIMENTO_IA_LIMITE_DIA, padrão 300). */
function limiteDia(): number {
  const n = Number(process.env.ATENDIMENTO_IA_LIMITE_DIA);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 300;
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

interface ChamadoViva extends ChamadoResumo {
  status: string;
  categoria: string;
  canal: string;
  contexto_tipo: string | null;
  contexto_id: string | null;
  service_order_id: string | null;
  responsavel_tipo: string;
  primeira_resposta_em: string | null;
}

const CAMPOS = "id, numero_publico, assunto, prioridade, status, categoria, canal, usuario_id, visitante_email, visitante_nome, contexto_tipo, contexto_id, service_order_id, responsavel_tipo, primeira_resposta_em";

// ── Modelo ──────────────────────────────────────────────────────────────────
/** Chamada ao modelo. `modelo` padrão: ATENDIMENTO_IA_MODELO (ou o atual). */
export function chamarClaude(modelo: string = modeloViva()): ChamarModelo {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 1 });
  return async ({ system, tools, messages }) => {
    const res = await client.beta.messages.create({
      model: modelo,
      max_tokens: 4096,
      // Conversa curta de atendimento: esforço baixo basta e sai mais barato.
      ...(aceitaEsforco(modelo) ? { output_config: { effort: "low" as const } } : {}),
      // Se o modelo recusar por segurança, a API tenta de novo no modelo reserva.
      ...(aceitaReserva(modelo) ? { betas: ["server-side-fallback-2026-06-01"], fallbacks: [{ model: "claude-opus-4-8" }] } : {}),
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: tools.map((t: FerramentaDef) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
      messages: messages as Anthropic.Beta.Messages.BetaMessageParam[],
    });
    return res as unknown as Awaited<ReturnType<ChamarModelo>>;
  };
}

// ── Ferramentas reais (filtradas pelo dono do chamado) ─────────────────────
const SEM_CONTA = { conteudo: "Visitante sem conta: não há dados para consultar. Oriente a pessoa a entrar na conta." };
const json = (v: unknown) => JSON.stringify(v).slice(0, 5000);
const data = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null);

async function emailDoChamado(admin: Admin, c: ChamadoViva): Promise<{ email: string | null; userId: string | null }> {
  if (c.usuario_id) {
    const { data: p } = await admin.from("profiles").select("email").eq("id", c.usuario_id).maybeSingle();
    return { email: (p?.email as string) ?? null, userId: c.usuario_id };
  }
  if (!c.visitante_email) return { email: null, userId: null };
  const { data: p } = await admin.from("profiles").select("id").ilike("email", c.visitante_email).maybeSingle();
  return { email: c.visitante_email, userId: (p?.id as string) ?? null };
}

export function ferramentasReais(admin: Admin, c: ChamadoViva, agora: Date): Ferramentas {
  const uid = c.usuario_id;
  return {
    ver_meus_pedidos: async () => {
      if (!uid) return SEM_CONTA;
      const { data: ps } = await admin
        .from("pedidos_moradia")
        .select("cidade, uf, status, data_inicio, prazo_meses, expira_em")
        .eq("inquilino_id", uid)
        .order("criado_em", { ascending: false })
        .limit(10);
      return { conteudo: ps?.length ? json(ps.map((p) => ({ ...p, data_inicio: data(p.data_inicio as string), expira_em: data(p.expira_em as string) }))) : "Nenhum Pedido de Moradia." };
    },
    ver_meus_contratos: async () => {
      if (!uid) return SEM_CONTA;
      const campos = "id, status, created_at, encerrado_em, aluguel_mensal, prazo_total_dias, properties!inner(title, owner_id), contrato_blocos(numero_bloco, inicio, fim, status)";
      const [comoInquilino, comoDono] = await Promise.all([
        admin.from("contratos").select(campos).eq("tenant_id", uid).order("created_at", { ascending: false }).limit(10),
        admin.from("contratos").select(campos).eq("properties.owner_id", uid).order("created_at", { ascending: false }).limit(10),
      ]);
      const lista = [
        ...(comoInquilino.data ?? []).map((x) => ({ papel: "inquilino", ...x })),
        ...(comoDono.data ?? []).map((x) => ({ papel: "proprietário", ...x })),
      ].map((x) => {
        const prop = x.properties as unknown as { title?: string } | null;
        return {
          id: x.id,
          papel: x.papel,
          imovel: prop?.title ?? null,
          status: x.status,
          criado_em: data(x.created_at as string),
          encerrado_em: data(x.encerrado_em as string),
          aluguel_mensal: x.aluguel_mensal,
          prazo_total_dias: x.prazo_total_dias,
          blocos: x.contrato_blocos,
        };
      });
      return { conteudo: lista.length ? json(lista) : "Nenhum contrato." };
    },
    ver_status_caucao: async (input) => {
      if (!uid) return SEM_CONTA;
      let q = admin.from("contratos").select("id, tenant_id, properties!inner(owner_id, title)").order("created_at", { ascending: false }).limit(20);
      if (typeof input.contrato_id === "string" && input.contrato_id) q = q.eq("id", input.contrato_id);
      const { data: cts } = await q;
      const meu = (cts ?? []).find((x) => x.tenant_id === uid || (x.properties as unknown as { owner_id?: string })?.owner_id === uid);
      if (!meu) return { conteudo: "Nenhum contrato desta pessoa encontrado." };
      const { data: blocos } = await admin
        .from("contrato_blocos")
        .select("numero_bloco, inicio, fim, caucao, caucao_forma, caucao_status, status")
        .eq("contrato_id", meu.id)
        .order("numero_bloco");
      return { conteudo: json({ contrato_id: meu.id, imovel: (meu.properties as unknown as { title?: string })?.title, blocos: blocos ?? [] }) };
    },
    ver_status_documento: async () => {
      if (!uid) return SEM_CONTA;
      const { data: qs } = await admin
        .from("qualification_checklists")
        .select("document_status, document_review_reason, document_reviewed_at, document_uploaded_at, properties(title)")
        .eq("owner_id", uid)
        .order("created_at", { ascending: false })
        .limit(10);
      const lista = (qs ?? []).map((q) => ({
        imovel: (q.properties as unknown as { title?: string } | null)?.title ?? "(anúncio ainda sem título)",
        documento: ({ none: "não enviado", pending: "em análise", approved: "aprovado", rejected: "reprovado" } as Record<string, string>)[q.document_status as string] ?? q.document_status,
        motivo: q.document_review_reason,
        enviado_em: data(q.document_uploaded_at as string),
        conferido_em: data(q.document_reviewed_at as string),
      }));
      return { conteudo: lista.length ? json(lista) : "Nenhum documento de imóvel enviado." };
    },
    ver_status_anuncio: async (input) => {
      if (!uid) return SEM_CONTA;
      let q = admin.from("properties").select("id, title, status, photo_count, monthly_price, description").eq("owner_id", uid).limit(10);
      if (typeof input.imovel_id === "string" && input.imovel_id) q = q.eq("id", input.imovel_id);
      const { data: props } = await q;
      if (!props?.length) return { conteudo: "Nenhum anúncio desta pessoa." };
      const { data: docs } = await admin.from("qualification_checklists").select("property_id, document_status").in("property_id", props.map((p) => p.id));
      const lista = props.map((p) => {
        const doc = (docs ?? []).find((d) => d.property_id === p.id)?.document_status ?? "none";
        const falta: string[] = [];
        if ((p.photo_count ?? 0) < MIN_FOTOS_PUBLICAR) falta.push(`Fotos: tem ${p.photo_count ?? 0}, precisa de pelo menos ${MIN_FOTOS_PUBLICAR}`);
        if (!p.monthly_price) falta.push("Preço mensal");
        if (((p.description as string) ?? "").trim().length < 60) falta.push("Descrição (60+ caracteres)");
        if (doc === "none") falta.push("Documento do imóvel: não enviado");
        if (doc === "pending") falta.push("Documento do imóvel: em análise pela equipe (avisamos por e-mail quando for aprovado)");
        if (doc === "rejected") falta.push("Documento do imóvel: reprovado — envie de novo");
        return { id: p.id, imovel: p.title, status: ({ draft: "rascunho", active: "publicado", paused: "pausado" } as Record<string, string>)[p.status as string] ?? p.status, falta };
      });
      return { conteudo: json(lista) };
    },
    reenviar_email_confirmacao: async () => {
      const { email, userId } = await emailDoChamado(admin, c);
      if (!email || !userId) return { conteudo: "Não há conta com o e-mail deste chamado. A pessoa pode criar a conta em Entrar." };
      if (!(await consumirLimite(`viva:reenvio:${c.id}`, 2, HORA))) return { conteudo: "Já reenviei há pouco. Peça para conferir o spam e aguardar alguns minutos.", erro: true };
      const { data: u } = await admin.auth.admin.getUserById(userId);
      if (u?.user?.email_confirmed_at) return { conteudo: "O e-mail desta conta já está confirmado: é só entrar com e-mail e senha." };
      const { error } = await admin.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${SITE_URL}/auth/callback` } });
      return error ? { conteudo: "Não consegui reenviar agora.", erro: true } : { conteudo: "E-mail de confirmação reenviado para o endereço da conta." };
    },
    enviar_link_redefinir_senha: async () => {
      const { email, userId } = await emailDoChamado(admin, c);
      if (!email || !userId) return { conteudo: "Não há conta com o e-mail deste chamado." };
      if (!(await consumirLimite(`viva:senha:${c.id}`, 2, HORA))) return { conteudo: "Já enviei há pouco. Peça para conferir o spam.", erro: true };
      const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo: `${SITE_URL}/auth/reset` });
      return error ? { conteudo: "Não consegui enviar agora.", erro: true } : { conteudo: "Link para criar uma nova senha enviado para o e-mail da conta." };
    },
    abrir_ordem_manutencao: async (input) => {
      if (!uid) return SEM_CONTA;
      if (c.service_order_id) return { conteudo: "Já existe uma ordem de manutenção aberta neste chamado; o proprietário já foi avisado." };
      const r = await criarOrdemManutencao({
        tenantId: uid,
        contratoId: typeof input.contrato_id === "string" && input.contrato_id ? input.contrato_id : null,
        mensagem: String(input.descricao ?? ""),
        urgencia: ["urgente", "media", "baixa"].includes(String(input.urgencia)) ? (input.urgencia as UrgenciaManutencao) : undefined,
        categoria: String(input.categoria ?? "outros"),
      });
      if (!r.ok) return { conteudo: r.error, erro: true };
      c.service_order_id = r.ordem.serviceOrderId;
      await admin
        .from("chamados")
        .update({ service_order_id: r.ordem.serviceOrderId, tipo: "manutencao", contexto_tipo: "manutencao", contexto_id: r.ordem.serviceOrderId })
        .eq("id", c.id);
      await avisarProprietarioManutencao(r.ordem, agora);
      const horas = { urgente: 4, media: 24, baixa: 72 }[r.ordem.urgencia];
      return {
        conteudo: `Ordem de manutenção aberta (${r.ordem.urgencia}) no imóvel ${r.ordem.propertyTitle}. O proprietário foi avisado por e-mail e tem até ${horas} horas para responder.`,
        efeito: { tipo: "manutencao", urgencia: r.ordem.urgencia, serviceOrderId: r.ordem.serviceOrderId },
      };
    },
    lembrar_proprietario: async (input) => {
      if (!uid) return SEM_CONTA;
      const assunto = input.assunto === "manutencao" ? "manutencao" : "candidatura";
      if (!(await consumirLimite(`viva:lembrete:${assunto}:${uid}`, 1, DIA))) return { conteudo: "Já lembrei o proprietário nas últimas 24 horas.", erro: true };
      if (assunto === "manutencao") {
        const { data: so } = await admin
          .from("service_orders")
          .select("id, owner_id, priority, properties(title)")
          .eq("tenant_id", uid)
          .in("status", ["aberto", "visto"])
          .order("opened_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!so) return { conteudo: "Não há manutenção aberta desta pessoa." };
        await avisarProprietarioManutencao(
          { serviceOrderId: so.id as string, ownerId: so.owner_id as string, urgencia: so.priority as UrgenciaManutencao, propertyTitle: (so.properties as unknown as { title?: string } | null)?.title ?? "seu imóvel" },
          agora,
          true
        );
        return { conteudo: "Lembrete da manutenção enviado ao proprietário." };
      }
      const { data: lead } = await admin.from("leads").select("owner_id").eq("tenant_id", uid).eq("status", "new").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!lead) return { conteudo: "Não há candidatura aguardando resposta." };
      const { data: dono } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", lead.owner_id).maybeSingle();
      if (dono?.email && dono.notif_email !== false) {
        await notify({
          event: "new_lead",
          email: dono.email as string,
          name: (dono.full_name as string) ?? undefined,
          userId: lead.owner_id as string,
          pushUrl: "/dashboard/leads",
          subject: "Lembrete: um interessado aguarda sua resposta",
        }).catch(() => null);
      }
      return { conteudo: "Lembrete da candidatura enviado ao proprietário." };
    },
    preparar_para_aprovacao: async (input) => ({
      conteudo: "Enviado para a aprovação da equipe.",
      efeito: {
        tipo: "aprovacao",
        resumo: String(input.resumo ?? "").slice(0, 1500),
        provas: Array.isArray(input.provas) ? input.provas.map((p) => String(p).slice(0, 400)).slice(0, 15) : [],
        resposta_sugerida: String(input.resposta_sugerida ?? "").slice(0, 2000),
        acao_sugerida: String(input.acao_sugerida ?? "").slice(0, 600),
      },
    }),
    escalar_humano: async (input) => ({ conteudo: "Passado para a equipe.", efeito: { tipo: "escalar", motivo: String(input.motivo ?? "a Viva pediu ajuda").slice(0, 200) } }),
  };
}

// ── Gravar o resultado ─────────────────────────────────────────────────────
function custoTexto(r: ResultadoViva): string {
  const usd = custoUsd(modeloViva(), r.uso);
  return usd === null ? "" : ` · custo estimado R$ ${(usd * cotacaoDolar()).toFixed(3).replace(".", ",")}`;
}

function notaInterna(r: ResultadoViva): string {
  const linhas = [
    `Viva · rota: ${r.rota} (${r.motivo}) → ${r.destino === "ia" ? "Viva segue" : r.destino === "aprovacao" ? "fila de aprovação" : "equipe"}`,
    `Fontes: ${r.fontes.length ? r.fontes.join(", ") : "fontes oficiais do prompt (FAQ, planos, regras)"}`,
    r.acoes.length ? `Ações: ${r.acoes.join(", ")}` : "",
    r.bloqueio ? `Resposta da IA barrada: ${r.bloqueio}` : "",
    r.uso.chamadas ? `Uso: ${r.uso.chamadas} chamada(s) ao ${modeloViva()}, ${r.uso.entrada + r.uso.cacheEscrita + r.uso.cacheLida} tokens de entrada (${r.uso.cacheLida} do cache), ${r.uso.saida} de saída${custoTexto(r)}` : "",
  ];
  if (r.aprovacao) {
    linhas.push(
      "",
      `APROVAÇÃO — ${r.aprovacao.tipo ? ROTULO_APROVACAO[r.aprovacao.tipo] : "pedido"}`,
      `Resumo: ${r.aprovacao.resumo}`,
      r.aprovacao.provas.length ? `Provas:\n${r.aprovacao.provas.map((p) => `• ${p}`).join("\n")}` : "Provas: (nenhuma reunida)",
      `Ação sugerida: ${r.aprovacao.acao_sugerida}`,
      r.aprovacao.resposta_sugerida ? `Resposta sugerida:\n${r.aprovacao.resposta_sugerida}` : ""
    );
  }
  return linhas.filter((l) => l !== "").join("\n").slice(0, 5000);
}

async function aplicar(admin: Admin, c: ChamadoViva, r: ResultadoViva, agora: Date, ehAbertura: boolean): Promise<void> {
  const prioridade: Prioridade = maisUrgente(c.prioridade, r.prioridade);
  if (r.resposta) await admin.from("chamado_mensagens").insert({ chamado_id: c.id, autor: "ia", corpo: r.resposta.slice(0, 5000) });
  await admin.from("chamado_mensagens").insert({ chamado_id: c.id, autor: "ia", interno: true, corpo: notaInterna(r) });

  const mudancas: Record<string, unknown> = { prioridade, atualizado_em: agora.toISOString() };
  if (r.destino === "ia") {
    mudancas.status = "aguardando_usuario";
    mudancas.responsavel_tipo = "ia";
    mudancas.sla_estado = "ok";
    if (!c.primeira_resposta_em) mudancas.primeira_resposta_em = agora.toISOString();
  } else {
    // Vai para uma pessoa: o relógio do prazo humano começa agora.
    const prazos = calcularPrazos(prioridade, agora);
    Object.assign(mudancas, {
      status: r.destino === "aprovacao" ? "aguardando_aprovacao" : "aberto",
      responsavel_tipo: "humano",
      primeira_resposta_em: null,
      prazo_primeira_resposta: prazos.primeiraResposta.toISOString(),
      prazo_resolucao: prazos.resolucao.toISOString(),
      sla_estado: "ok",
      alerta_enviado_em: null,
    });
  }
  await admin.from("chamados").update(mudancas).eq("id", c.id);

  const eventos: Record<string, unknown>[] = [
    { chamado_id: c.id, ator_tipo: "ia", acao: "ia_resposta", para: r.destino, detalhe: `${r.rota}: ${r.motivo}`.slice(0, 300) },
  ];
  if (prioridade !== c.prioridade) eventos.push({ chamado_id: c.id, ator_tipo: "ia", acao: "prioridade", de: c.prioridade, para: prioridade, detalhe: r.motivo });
  if (r.destino === "aprovacao") eventos.push({ chamado_id: c.id, ator_tipo: "ia", acao: "aprovacao", para: "aguardando_aprovacao", detalhe: r.aprovacao?.tipo ?? r.motivo });
  else if (r.destino === "humano") eventos.push({ chamado_id: c.id, ator_tipo: "ia", acao: r.rota === "humano" && /pessoa/.test(r.motivo) ? "pediu_humano" : "escalado", para: "humano", detalhe: r.motivo });
  if (r.acoes.includes("tentativa_injecao")) eventos.push({ chamado_id: c.id, ator_tipo: "usuario", acao: "tentativa_injecao", detalhe: "mensagem tentou mudar as regras da Viva (ignorada)" });
  await admin.from("chamado_eventos").insert(eventos);

  const resumo: ChamadoResumo = { ...c, prioridade };
  if (r.resposta) {
    const pessoa = r.destino === "ia" ? `<p style="margin:12px 0 0;"><a href="${linkPessoa(c.id)}" style="color:#1c6b3a;font-weight:600;">Falar com uma pessoa</a></p>` : "";
    await avisarUsuario(resumo, "chamado_respondido", `<p style="margin:12px 0 0;color:#334155;white-space:pre-line;">${textoEmail(r.resposta, 2500)}</p>${pessoa}`);
  }
  // P1/P2 já avisaram a equipe na abertura (PR 1); aprovação sempre avisa.
  const jaAvisada = ehAbertura && (c.prioridade === "p1" || c.prioridade === "p2") && r.destino !== "aprovacao";
  if (r.destino !== "ia" && !jaAvisada) {
    await avisarEquipe(resumo, r.destino === "aprovacao" ? `aprovação: ${r.motivo}` : r.motivo);
  }
}

/**
 * Roda a Viva na última mensagem da pessoa. Idempotente: só age se o chamado
 * está com a Viva e a última mensagem pública é da pessoa. Nunca lança.
 */
export async function rodarViva(chamadoId: string): Promise<void> {
  if (!vivaAtiva()) return;
  const admin = createAdminClient();
  if (!admin) return;
  try {
    const { data } = await admin.from("chamados").select(CAMPOS).eq("id", chamadoId).maybeSingle();
    const c = data as ChamadoViva | null;
    if (!c || c.responsavel_tipo !== "ia" || ["encerrado", "aguardando_aprovacao"].includes(c.status)) return;
    const { data: msgs } = await admin
      .from("chamado_mensagens")
      .select("autor, corpo")
      .eq("chamado_id", c.id)
      .eq("interno", false)
      .order("criado_em", { ascending: true });
    const lista = (msgs ?? []) as { autor: "usuario" | "ia" | "admin" | "sistema"; corpo: string }[];
    const ultimaPessoa = lista.map((m) => m.autor).lastIndexOf("usuario");
    if (ultimaPessoa < 0 || lista.slice(ultimaPessoa + 1).some((m) => m.autor === "ia" || m.autor === "admin")) return;
    const agora = new Date();

    if (!(await consumirLimite("viva:dia", limiteDia(), DIA))) {
      await escalarParaPessoa(c.id, "limite diário da Viva atingido", "sistema");
      return;
    }

    let nome: string | null = primeiroNome(c.visitante_nome);
    let papel: string | null = null;
    let temContratoAtivo = false;
    if (c.usuario_id) {
      const [{ data: perfil }, { count }] = await Promise.all([
        admin.from("profiles").select("full_name, role").eq("id", c.usuario_id).maybeSingle(),
        admin.from("contratos").select("id", { count: "exact", head: true }).eq("tenant_id", c.usuario_id).in("status", ["ativo", "encerrado_em_acerto"]),
      ]);
      nome = primeiroNome(perfil?.full_name as string | null);
      papel = ({ owner: "proprietário", tenant: "inquilino", admin: "equipe" } as Record<string, string>)[perfil?.role as string] ?? null;
      temContratoAtivo = (count ?? 0) > 0;
    }

    const r = await atenderViva(
      {
        texto: lista[ultimaPessoa].corpo,
        categoria: c.categoria,
        nome,
        contexto: contextoChamado({
          numero: c.numero_publico,
          categoria: c.categoria,
          canal: c.canal,
          nome,
          logado: !!c.usuario_id,
          papel,
          contexto: { tipo: c.contexto_tipo, id: c.contexto_id },
          temContratoAtivo,
          agoraBR: agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", dateStyle: "short", timeStyle: "short" } as Intl.DateTimeFormatOptions),
        }),
        historico: lista.slice(0, ultimaPessoa),
        respostasIA: lista.filter((m) => m.autor === "ia").length,
        prioridade: c.prioridade,
        temContratoAtivo,
        iaDisponivel: true,
        agora,
      },
      chamarClaude(),
      ferramentasReais(admin, c, agora)
    );
    await aplicar(admin, c, r, agora, lista.filter((m) => m.autor === "usuario").length === 1);
  } catch (e) {
    console.error("[viva] falha:", e instanceof Error ? e.message : e);
    await escalarParaPessoa(chamadoId, "falha da Viva", "sistema").catch(() => null);
  }
}

/** Passa o chamado para uma pessoa (botão, link do e-mail ou falha). */
export async function escalarParaPessoa(chamadoId: string, motivo: string, ator: "usuario" | "sistema", atorId?: string | null): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  const { data } = await admin.from("chamados").select(CAMPOS).eq("id", chamadoId).maybeSingle();
  const c = data as ChamadoViva | null;
  if (!c || c.status === "encerrado") return false;
  if (c.responsavel_tipo === "humano" && c.status !== "resolvido" && c.status !== "aguardando_usuario") return true; // já está com a equipe
  const agora = new Date();
  const prazos = calcularPrazos(c.prioridade, agora);
  await admin
    .from("chamados")
    .update({
      responsavel_tipo: "humano",
      status: "aberto",
      primeira_resposta_em: null,
      prazo_primeira_resposta: prazos.primeiraResposta.toISOString(),
      prazo_resolucao: prazos.resolucao.toISOString(),
      sla_estado: "ok",
      alerta_enviado_em: null,
      atualizado_em: agora.toISOString(),
    })
    .eq("id", c.id);
  await admin.from("chamado_mensagens").insert({ chamado_id: c.id, autor: "sistema", corpo: `${RESPOSTA_PESSOA} ${frasePrazo(c.prioridade, agora)}` });
  await admin.from("chamado_eventos").insert({ chamado_id: c.id, ator_tipo: ator, ator_id: atorId ?? null, acao: ator === "usuario" ? "pediu_humano" : "escalado", para: "humano", detalhe: motivo });
  await avisarEquipe(c, ator === "usuario" ? "a pessoa pediu para falar com alguém" : motivo);
  return true;
}
