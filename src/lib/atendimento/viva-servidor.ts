import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, DIA } from "@/lib/limites";
import { integracoesSimuladas } from "@/lib/integracoes";
import { agoraBRTexto } from "@/lib/atendimento/data-br";
import { notify } from "@/lib/notifications";
import { textoEmail } from "@/lib/notifications/texto-seguro";
import { SITE_URL } from "@/lib/site";
import { calcularPrazos, frasePrazo, type Prioridade, type UrgenciaManutencao } from "@/config/atendimento";
import { prontidaoDosImoveis } from "@/lib/anuncio/prontidao-servidor";
import { atenderViva, maisUrgente, type ChamarModelo, type Ferramentas, type ResultadoViva } from "@/lib/atendimento/viva-motor";
import { contextoChamado, type FerramentaDef } from "@/lib/atendimento/viva-prompt";
import { aceitaEsforco, aceitaReserva, cotacaoDolar, custoUsd, modeloViva } from "@/lib/atendimento/viva-custo";
import { primeiroNome, RESPOSTA_PESSOA, ROTULO_APROVACAO } from "@/lib/atendimento/viva-regras";
import { podeDevolverParaViva, rotuloFerramenta, sugerirRespostaMotor, transcricaoParaRascunho, type Sugestao } from "@/lib/atendimento/copiloto";
import { notaSugestao, textoAcolhimento } from "@/lib/atendimento/acolhimento";
import { lerResumo, resumoPorRegra, sugestaoPorRegra, SYSTEM_RESUMO, type ResumoChamado } from "@/lib/atendimento/resumo";
import { categoria as categoriaDef } from "@/lib/atendimento/classificar";
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
  return process.env.ATENDIMENTO_IA_ATIVO === "on" && !!process.env.ANTHROPIC_API_KEY && !integracoesSimuladas();
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

/**
 * Travas das ações da Viva (decisão do Daniel, out/2026): envio de e-mail SÓ
 * para o e-mail JÁ CADASTRADO da conta LOGADA que abriu o chamado — nunca para
 * e-mail ou telefone dito na conversa (as ferramentas nem recebem endereço) e
 * nunca para visitante sem login. Limite por CONTA a cada 24h; lembrete ao dono
 * 1× a cada 24h por ordem de serviço. Toda ação vira evento no chamado.
 */
export const LIMITE_ACOES_VIVA = { reenvio: 3, senha: 3, lembrete: 1 } as const;

async function emailDaConta(admin: Admin, c: ChamadoViva): Promise<{ email: string | null; userId: string | null }> {
  if (!c.usuario_id) return { email: null, userId: null };
  const { data: p } = await admin.from("profiles").select("email").eq("id", c.usuario_id).maybeSingle();
  return { email: (p?.email as string) ?? null, userId: c.usuario_id };
}

const SEM_LOGIN_EMAIL =
  "Por segurança, só envio para o e-mail de uma conta conectada. Sem conseguir entrar: na tela Entrar, use \"Esqueci minha senha\" (ou o reenvio da confirmação). Para trocar o e-mail da conta, abro um chamado para a equipe.";

async function registrarAcaoViva(admin: Admin, c: ChamadoViva, acao: string, detalhe: string) {
  await admin.from("chamado_eventos").insert({ chamado_id: c.id, ator_tipo: "ia", acao, detalhe: detalhe.slice(0, 300) });
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
      // Prontidão da fonte única (a mesma de Meus imóveis e do Publicar), só dos imóveis DESTA pessoa.
      let q = admin.from("properties").select("id, title, status").eq("owner_id", uid).limit(10);
      if (typeof input.imovel_id === "string" && input.imovel_id) q = q.eq("id", input.imovel_id);
      const { data: props } = await q;
      if (!props?.length) return { conteudo: "Nenhum anúncio desta pessoa." };
      const prontidao = await prontidaoDosImoveis(admin, uid, props.map((p) => p.id as string));
      const lista = props.map((p) => {
        const pr = prontidao.get(p.id as string);
        return {
          id: p.id,
          imovel: p.title,
          status: ({ draft: "rascunho", active: "publicado", paused: "pausado" } as Record<string, string>)[p.status as string] ?? p.status,
          pode_publicar: pr?.podePublicar ?? false,
          falta_para_publicar: pr?.faltam ?? [],
          opcional_para_melhorar_nao_bloqueia: pr?.melhorar ?? [],
        };
      });
      return { conteudo: json(lista) };
    },
    reenviar_email_confirmacao: async () => {
      const { email, userId } = await emailDaConta(admin, c);
      if (!email || !userId) return { conteudo: SEM_LOGIN_EMAIL };
      const { data: u } = await admin.auth.admin.getUserById(userId);
      if (u?.user?.email_confirmed_at) return { conteudo: "O e-mail desta conta já está confirmado: é só entrar com e-mail e senha." };
      if (!(await consumirLimite(`viva:reenvio:${userId}`, LIMITE_ACOES_VIVA.reenvio, DIA))) {
        await registrarAcaoViva(admin, c, "viva_limite", "reenvio da confirmação recusado: limite de 24h");
        return { conteudo: `Já reenviei ${LIMITE_ACOES_VIVA.reenvio} vezes nas últimas 24 horas. Peça para conferir o spam; se não chegar, passo para a equipe.`, erro: true };
      }
      const { error } = await admin.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${SITE_URL}/auth/callback` } });
      await registrarAcaoViva(admin, c, "viva_reenvio_confirmacao", error ? "falhou" : "enviado ao e-mail cadastrado da conta");
      return error ? { conteudo: "Não consegui reenviar agora.", erro: true } : { conteudo: "E-mail de confirmação reenviado para o e-mail cadastrado na conta." };
    },
    enviar_link_redefinir_senha: async () => {
      const { email, userId } = await emailDaConta(admin, c);
      if (!email || !userId) return { conteudo: SEM_LOGIN_EMAIL };
      if (!(await consumirLimite(`viva:senha:${userId}`, LIMITE_ACOES_VIVA.senha, DIA))) {
        await registrarAcaoViva(admin, c, "viva_limite", "link de nova senha recusado: limite de 24h");
        return { conteudo: `Já enviei ${LIMITE_ACOES_VIVA.senha} vezes nas últimas 24 horas. Peça para conferir o spam; se não chegar, passo para a equipe.`, erro: true };
      }
      const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo: `${SITE_URL}/auth/reset` });
      await registrarAcaoViva(admin, c, "viva_link_senha", error ? "falhou" : "enviado ao e-mail cadastrado da conta");
      return error ? { conteudo: "Não consegui enviar agora.", erro: true } : { conteudo: "Link para criar uma nova senha enviado para o e-mail cadastrado na conta." };
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
      await registrarAcaoViva(admin, c, "viva_ordem_manutencao", `ordem ${r.ordem.serviceOrderId} aberta (${r.ordem.urgencia}); proprietário avisado`);
      const horas = { urgente: 4, media: 24, baixa: 72 }[r.ordem.urgencia];
      return {
        conteudo: `Ordem de manutenção aberta (${r.ordem.urgencia}) no imóvel ${r.ordem.propertyTitle}. O proprietário foi avisado por e-mail e tem até ${horas} horas para responder.`,
        efeito: { tipo: "manutencao", urgencia: r.ordem.urgencia, serviceOrderId: r.ordem.serviceOrderId },
      };
    },
    lembrar_proprietario: async (input) => {
      if (!uid) return SEM_CONTA;
      const assunto = input.assunto === "manutencao" ? "manutencao" : "candidatura";
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
        // 1 lembrete a cada 24h POR ORDEM de serviço.
        if (!(await consumirLimite(`viva:lembrete:os:${so.id}`, LIMITE_ACOES_VIVA.lembrete, DIA))) return { conteudo: "Já lembrei o proprietário desta manutenção nas últimas 24 horas.", erro: true };
        await avisarProprietarioManutencao(
          { serviceOrderId: so.id as string, ownerId: so.owner_id as string, urgencia: so.priority as UrgenciaManutencao, propertyTitle: (so.properties as unknown as { title?: string } | null)?.title ?? "seu imóvel" },
          agora,
          true
        );
        await registrarAcaoViva(admin, c, "viva_lembrete_dono", `manutenção ${so.id}`);
        return { conteudo: "Lembrete da manutenção enviado ao proprietário." };
      }
      if (!(await consumirLimite(`viva:lembrete:candidatura:${uid}`, LIMITE_ACOES_VIVA.lembrete, DIA))) return { conteudo: "Já lembrei o proprietário nas últimas 24 horas.", erro: true };
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
      await registrarAcaoViva(admin, c, "viva_lembrete_dono", "candidatura");
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
          agoraBR: agoraBRTexto(agora),
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

/**
 * Chamado que fica com a EQUIPE (categoria sensível ou "falar com uma pessoa"):
 * 1) acolhimento na hora, da Viva, com número e prazo (conta como 1ª resposta);
 * 2) resposta SUGERIDA como nota interna, para aprovar com 1 clique.
 * O acolhimento é texto fixo (sem IA, sem custo). A sugestão usa a IA só com a
 * Viva ligada e dentro do teto diário; no laboratório vira um rascunho simulado.
 */
export async function acolherNaEquipe(chamadoId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  try {
    const { data } = await admin.from("chamados").select(`${CAMPOS}, prazo_primeira_resposta`).eq("id", chamadoId).maybeSingle();
    const c = data as (ChamadoViva & { prazo_primeira_resposta: string }) | null;
    if (!c || c.responsavel_tipo !== "humano" || ["resolvido", "encerrado"].includes(c.status)) return;
    const { count: jaRespondido } = await admin
      .from("chamado_mensagens")
      .select("id", { count: "exact", head: true })
      .eq("chamado_id", c.id)
      .in("autor", ["ia", "admin"]);
    if ((jaRespondido ?? 0) > 0) return; // idempotente: só a primeira vez
    const agora = new Date();
    const rotulo = categoriaDef(c.categoria)?.rotulo ?? "atendimento";
    await admin.from("chamado_mensagens").insert({
      chamado_id: c.id,
      autor: "ia",
      corpo: textoAcolhimento({ numero: c.numero_publico, rotulo, prazo: new Date(c.prazo_primeira_resposta) }),
    });
    if (!c.primeira_resposta_em) await admin.from("chamados").update({ primeira_resposta_em: agora.toISOString(), atualizado_em: agora.toISOString() }).eq("id", c.id);
    await registrarAcaoViva(admin, c, "acolhido", "acolhimento automático; fica com a equipe");

    let texto: string | null = null;
    let fontes: string[] = [];
    let simulacao = false;
    if (vivaAtiva() && (await consumirLimite("viva:dia", limiteDia(), DIA))) {
      const s = await sugerirRascunho(c.id);
      if (s?.ok && s.texto) {
        texto = s.texto;
        fontes = s.fontes.map((f) => rotuloFerramenta(f.ferramenta));
      }
    } else if (integracoesSimuladas()) {
      // Laboratório (sem IA): rascunho só com textos oficiais, marcado como simulado.
      const { data: pessoa } = await admin.from("chamado_mensagens").select("corpo").eq("chamado_id", c.id).eq("autor", "usuario").order("criado_em").limit(1).maybeSingle();
      texto = sugestaoPorRegra((pessoa?.corpo as string) ?? "", primeiroNome(c.visitante_nome), !c.usuario_id);
      simulacao = true;
    }
    if (texto) {
      await admin.from("chamado_mensagens").insert({ chamado_id: c.id, autor: "ia", interno: true, simulacao, corpo: notaSugestao(texto, fontes) });
      await registrarAcaoViva(admin, c, "sugestao_ia", `sugestão para aprovar${fontes.length ? ` · fontes: ${fontes.join(", ")}` : ""}`);
    }
  } catch (e) {
    console.error("[viva] acolhimento:", e instanceof Error ? e.message : e);
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
  await admin.from("chamado_mensagens").insert({ chamado_id: c.id, autor: "sistema", corpo: `${RESPOSTA_PESSOA} ${frasePrazo(c.prioridade)}` });
  await admin.from("chamado_eventos").insert({ chamado_id: c.id, ator_tipo: ator, ator_id: atorId ?? null, acao: ator === "usuario" ? "pediu_humano" : "escalado", para: "humano", detalhe: motivo });
  await avisarEquipe(c, ator === "usuario" ? "a pessoa pediu para falar com alguém" : motivo);
  return true;
}

// ── Copiloto da equipe ─────────────────────────────────────────────────────
/**
 * Rascunho da próxima resposta da EQUIPE (botão "Sugerir resposta"). Só lê:
 * as ferramentas de ação nem chegam ao modelo. Não grava mensagem nenhuma —
 * quem envia é a pessoa da equipe, depois de ver o texto e as fontes.
 */
export async function sugerirRascunho(chamadoId: string): Promise<Sugestao | null> {
  if (!vivaAtiva()) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("chamados").select(CAMPOS).eq("id", chamadoId).maybeSingle();
  const c = data as ChamadoViva | null;
  if (!c) return null;
  const { data: msgs } = await admin.from("chamado_mensagens").select("autor, corpo, interno").eq("chamado_id", c.id).order("criado_em", { ascending: true });
  const agora = new Date();
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
  const contexto = contextoChamado({
    numero: c.numero_publico,
    categoria: c.categoria,
    canal: c.canal,
    nome,
    logado: !!c.usuario_id,
    papel,
    contexto: { tipo: c.contexto_tipo, id: c.contexto_id },
    temContratoAtivo,
    agoraBR: agoraBRTexto(agora),
  });
  const conversa = transcricaoParaRascunho(contexto, (msgs ?? []) as { autor: "usuario" | "ia" | "admin" | "sistema"; corpo: string; interno: boolean }[]);
  return sugerirRespostaMotor(conversa, chamarClaude(), ferramentasReais(admin, c, agora));
}

/**
 * "Devolver para a Viva" (só P3/P4). Se a última palavra é da pessoa, quem
 * chama roda a Viva logo depois (after); senão, ela responde na próxima mensagem.
 */
export async function devolverChamadoParaViva(chamadoId: string, adminId: string): Promise<{ ok: true; respondeAgora: boolean } | { ok: false; error: string }> {
  if (!vivaAtiva()) return { ok: false, error: "A Viva está desligada (ATENDIMENTO_IA_ATIVO)." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Indisponível." };
  const { data } = await admin.from("chamados").select(CAMPOS).eq("id", chamadoId).maybeSingle();
  const c = data as ChamadoViva | null;
  if (!c) return { ok: false, error: "Chamado não encontrado." };
  const pode = podeDevolverParaViva(c.prioridade, c.status);
  if (!pode.ok) return { ok: false, error: pode.motivo ?? "Não pode voltar para a Viva." };
  const { data: msgs } = await admin.from("chamado_mensagens").select("autor").eq("chamado_id", c.id).eq("interno", false).order("criado_em", { ascending: true });
  const autores = ((msgs ?? []) as { autor: string }[]).map((m) => m.autor);
  const ultimaPessoa = autores.lastIndexOf("usuario");
  const respondeAgora = ultimaPessoa >= 0 && !autores.slice(ultimaPessoa + 1).some((a) => a === "ia" || a === "admin");
  await admin
    .from("chamados")
    .update({ responsavel_tipo: "ia", status: respondeAgora ? "em_andamento" : "aguardando_usuario", sla_estado: "ok", atualizado_em: new Date().toISOString() })
    .eq("id", c.id);
  await admin.from("chamado_eventos").insert({ chamado_id: c.id, ator_tipo: "admin", ator_id: adminId, acao: "devolvido_ia", de: "humano", para: "ia", detalhe: respondeAgora ? "a Viva responde agora" : "a Viva responde na próxima mensagem" });
  return { ok: true, respondeAgora };
}

/**
 * "Resumo e ações" do chamado. Com a Viva ligada, a IA resume a conversa
 * pública (sem notas internas, sem dados pessoais); sem IA ou se falhar,
 * resumo por regras. Quem guarda como nota é a action (atendimento-actions).
 */
export async function gerarResumo(chamadoId: string): Promise<{ resumo: ResumoChamado; simulacao: boolean } | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.from("chamados").select(CAMPOS).eq("id", chamadoId).maybeSingle();
  const c = data as ChamadoViva | null;
  if (!c) return null;
  const { data: msgs } = await admin.from("chamado_mensagens").select("autor, corpo, interno").eq("chamado_id", c.id).eq("interno", false).order("criado_em", { ascending: true });
  const lista = (msgs ?? []) as { autor: "usuario" | "ia" | "admin" | "sistema"; corpo: string; interno: boolean }[];
  const textoPessoa = lista.filter((m) => m.autor === "usuario").map((m) => m.corpo).join("\n");
  const regras = () => resumoPorRegra(textoPessoa, !c.usuario_id);
  if (!vivaAtiva()) return { resumo: regras(), simulacao: integracoesSimuladas() };
  if (!(await consumirLimite("viva:dia", limiteDia(), DIA))) return { resumo: regras(), simulacao: false };
  try {
    const modelo = modeloViva();
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 45_000, maxRetries: 1 });
    const contexto = `Chamado ${c.numero_publico} · categoria ${c.categoria} · prioridade ${c.prioridade} · ${c.usuario_id ? "pessoa com conta" : "visitante sem conta"}`;
    const res = await client.beta.messages.create({
      model: modelo,
      max_tokens: 1200,
      ...(aceitaEsforco(modelo) ? { output_config: { effort: "low" as const } } : {}),
      ...(aceitaReserva(modelo) ? { betas: ["server-side-fallback-2026-06-01"], fallbacks: [{ model: "claude-opus-4-8" }] } : {}),
      system: SYSTEM_RESUMO,
      messages: [{ role: "user", content: transcricaoParaRascunho(contexto, lista) }],
    });
    const bruto = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return { resumo: lerResumo(bruto, "ia") ?? regras(), simulacao: false };
  } catch (e) {
    console.error("[viva] resumo:", e instanceof Error ? e.message : e);
    return { resumo: regras(), simulacao: false };
  }
}
