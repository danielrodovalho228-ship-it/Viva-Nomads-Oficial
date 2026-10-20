/**
 * Pedido de Moradia × imóveis — avisos e dados de tela (SERVER-ONLY, sem
 * "use server": chamado pelas server actions e pela rota do resumo diário).
 *
 * A regra de compatibilidade é a função do banco `compatibilidade_pedidos`
 * (0064), chamada só pelo cliente de serviço. Aqui:
 *  • aviso SÓ para o dono com imóvel compatível, dizendo qual e por quê;
 *  • 1 aviso por pedido por dono (único no banco). Prompt 30: o sino (push e a lista de Notificações) é na hora;
 *    o e-mail vai no resumo diário — no máximo 1 por dia por dono; respeita notif_email;
 *  • tudo registrado em pedido_avisos (números do admin).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { notificacaoLigada } from "@/lib/notifications/preferencias";
import { notify } from "@/lib/notifications";
import { SITE_URL } from "@/lib/site";
import { textoEmail, textoPlano } from "@/lib/notifications/texto-seguro";
import { formatBRL, dataBR } from "@/lib/utils";
import { chegaAosDonos, faltaConfirmar, type ChaveSms, type SituacaoContato } from "@/lib/pedidos/confirmacao";
import { lerChaveSms } from "@/lib/data/chave-sms";
import {
  imoveisParaTela,
  melhorPor,
  sugestaoAjuste,
  type ImovelCompativel,
  type ParCompat,
} from "@/lib/pedidos/compatibilidade";
import { consumirLimite, DIA } from "@/lib/limites";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

interface PedidoResumo {
  id: string;
  inquilino_id: string;
  criado_em: string;
  cidade: string;
  uf: string | null;
  data_inicio: string;
  prazo_meses: number;
  qtd_ocupantes: number;
  orcamento_mensal: number;
  motivo: string;
  pets: boolean | null;
  criancas: boolean | null;
}

/** Linhas da função do banco (números normalizados). [] em erro. */
export async function paresCompat(
  admin: Admin,
  filtro: { pedido?: string; imovel?: string; dono?: string }
): Promise<ParCompat[]> {
  const { data, error } = await admin.rpc("compatibilidade_pedidos", {
    p_pedido: filtro.pedido ?? null,
    p_imovel: filtro.imovel ?? null,
    p_dono: filtro.dono ?? null,
  });
  if (error) {
    console.error("[compatibilidade] falha:", error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    pedido_id: r.pedido_id as string,
    imovel_id: r.imovel_id as string,
    dono_id: r.dono_id as string,
    titulo: (r.titulo as string) || "Seu imóvel",
    situacao: r.situacao as ParCompat["situacao"],
    nota: Number(r.nota) || 0,
    motivo: (r.motivo as string | null) ?? null,
    total_mensal: Number(r.total_mensal) || 0,
    orcamento: Number(r.orcamento) || 0,
    vagas: r.vagas == null ? null : Number(r.vagas),
    ocupantes: Number(r.ocupantes) || 0,
    prazo_dias: Number(r.prazo_dias) || 0,
    min_dias: Number(r.min_dias) || 0,
    max_dias: Number(r.max_dias) || 0,
    entrada: String(r.entrada ?? ""),
    disponivel_desde: (r.disponivel_desde as string | null) ?? null,
  }));
}

function linkResponder(pedidoId: string, imovelId: string): string {
  return `${SITE_URL}/dashboard/pedidos-cidade?pedido=${encodeURIComponent(pedidoId)}&imovel=${encodeURIComponent(imovelId)}`;
}

async function carregarPedido(admin: Admin, pedidoId: string): Promise<PedidoResumo | null> {
  const { data } = await admin
    .from("pedidos_moradia")
    .select("id, inquilino_id, criado_em, cidade, uf, data_inicio, prazo_meses, qtd_ocupantes, orcamento_mensal, motivo, pets, criancas")
    .eq("id", pedidoId)
    .maybeSingle();
  return (data as PedidoResumo | null) ?? null;
}

/** E-mail e telefone do inquilino (servidor). Falha fechada: na dúvida, nada confirmado. */
export async function situacaoDoInquilino(admin: Admin, inquilinoId: string): Promise<SituacaoContato> {
  try {
    const [{ data: u }, { data: tv }] = await Promise.all([
      admin.auth.admin.getUserById(inquilinoId),
      admin.from("telefone_verificacao").select("verificado_em").eq("user_id", inquilinoId).maybeSingle(),
    ]);
    return {
      emailConfirmadoEm: u?.user?.email_confirmed_at,
      telefoneConfirmadoEm: u?.user?.phone_confirmed_at,
      telefoneVerificadoEm: (tv?.verificado_em as string | null) ?? null,
    };
  } catch {
    return { emailConfirmadoEm: null, telefoneConfirmadoEm: null, telefoneVerificadoEm: null };
  }
}

/** O pedido chega aos donos agora? A mesma regra do mural (pedido_visivel_para_donos, 0184), com a chave SMS_ATIVO. */
async function pedidoChegaAosDonos(admin: Admin, pedido: PedidoResumo, sms: ChaveSms): Promise<boolean> {
  return chegaAosDonos(await situacaoDoInquilino(admin, pedido.inquilino_id), sms, pedido.criado_em, new Date());
}

/**
 * Aviso ao DONO de um imóvel compatível (1 por pedido por dono): o sino na hora e o e-mail no resumo diário (ou
 * nenhum, sem e-mail ou com as notificações desligadas). Registra em pedido_avisos.
 */
async function avisarDono(admin: Admin, pedido: PedidoResumo, par: ParCompat): Promise<"resumo" | "nenhum" | "ja_avisado"> {
  const { data: perfil } = await admin
    .from("profiles")
    .select("email, full_name, notif_email")
    .eq("id", par.dono_id)
    .maybeSingle();

  let canal: "resumo" | "nenhum" = "resumo";
  let motivoNaoEnvio: string | null = null;
  if (!perfil?.email) {
    canal = "nenhum";
    motivoNaoEnvio = "sem_email";
  } else if (!notificacaoLigada(perfil.notif_email as boolean | null)) {
    canal = "nenhum";
    motivoNaoEnvio = "notificacoes_desligadas";
  } else {
    // Prompt 30: e-mail só no resumo diário (no máximo 1 por dia por dono); o sino é na hora (abaixo).
    canal = "resumo";
    motivoNaoEnvio = "resumo_diario";
  }

  const { error } = await admin
    .from("pedido_avisos")
    .insert({
      pedido_id: pedido.id,
      dono_id: par.dono_id,
      imovel_id: par.imovel_id,
      nota: par.nota,
      canal,
      motivo_nao_envio: motivoNaoEnvio,
    });
  if (error) return error.code === "23505" ? "ja_avisado" : "nenhum";

  // Sino na hora: push (quando o app está instalado) e a lista de Notificações (lida de pedido_avisos).
  await notify({ event: "pedido_compativel", userId: par.dono_id, pushUrl: "/dashboard/pedidos-cidade" }).catch(() => null);

  return canal;
}

/**
 * Pedido acabou de ser publicado: avisa só os donos com imóvel compatível (o
 * melhor imóvel de cada um) e devolve, para a tela do inquilino, quantos
 * imóveis combinam agora e — se nenhum — uma sugestão de ajuste.
 */
export async function avisarCompativeisDoPedido(pedidoId: string): Promise<{
  compativeis: number;
  sugestao: string | null;
  imoveis: ImovelCompativel[];
  chegaAosDonos: boolean;
  falta: ("e-mail" | "telefone")[];
  smsLigado: boolean;
}> {
  const vazio = { compativeis: 0, sugestao: null, imoveis: [], chegaAosDonos: false, falta: [], smsLigado: false };
  const admin = createAdminClient();
  if (!admin) return vazio;
  const pedido = await carregarPedido(admin, pedidoId);
  if (!pedido) return vazio;
  const sms = await lerChaveSms();

  const pares = await paresCompat(admin, { pedido: pedidoId });
  const compat = pares.filter((p) => p.situacao === "compativel");
  await admin.from("pedidos_moradia").update({ compativeis_ao_publicar: compat.length }).eq("id", pedidoId);

  // Sem o que a chave exige (e-mail; com SMS_ATIVO, também o telefone) o pedido fica guardado e NÃO avisa ninguém.
  const situacao = await situacaoDoInquilino(admin, pedido.inquilino_id);
  const confirmado = chegaAosDonos(situacao, sms, pedido.criado_em, new Date());
  for (const par of confirmado ? melhorPor(compat, "dono_id").values() : []) {
    try {
      await avisarDono(admin, pedido, par);
    } catch (e) {
      console.error("[avisarCompativeisDoPedido] falha ao avisar dono:", e);
    }
  }
  return {
    compativeis: compat.length,
    sugestao: compat.length === 0 ? sugestaoAjuste(pares) : null,
    imoveis: imoveisParaTela(compat),
    chegaAosDonos: confirmado,
    falta: confirmado ? [] : faltaConfirmar(situacao, sms),
    smsLigado: sms.ligada,
  };
}

/**
 * Imóvel acabou de ser PUBLICADO: avisa o dono (pelos pedidos ativos que ele
 * agora atende) e cada inquilino com pedido compatível (1 aviso por pedido
 * por dia). Best-effort.
 */
export async function avisarPedidosDoImovel(imovelId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const pares = (await paresCompat(admin, { imovel: imovelId })).filter((p) => p.situacao === "compativel");
  const sms = await lerChaveSms();
  for (const par of pares) {
    try {
      const pedido = await carregarPedido(admin, par.pedido_id);
      if (!pedido) continue;
      if (!(await pedidoChegaAosDonos(admin, pedido, sms))) continue;
      await avisarDono(admin, pedido, par);
      if (!(await consumirLimite(`pedido-imovel-novo:${pedido.id}`, 1, DIA))) continue;
      const { data: inq } = await admin
        .from("profiles")
        .select("email, full_name, notif_email")
        .eq("id", pedido.inquilino_id)
        .maybeSingle();
      if (!inq?.email || inq.notif_email === false) continue;
      await notify({
        event: "pedido_imovel_novo",
        email: inq.email as string,
        name: (inq.full_name as string) ?? undefined,
        userId: pedido.inquilino_id,
        pushUrl: "/dashboard/pedidos",
        detailsHtml: `<p style="margin:12px 0 0;color:#334155;">Ele combina com o que você pediu (${textoEmail(
          `${pedido.cidade}, entrada em ${dataBR(pedido.data_inicio)}, ${pedido.prazo_meses} meses`,
          160
        )}). Quando o proprietário responder, você é avisado — a conversa é pela plataforma.</p>
          <p style="margin:12px 0 0;"><a href="${SITE_URL}/dashboard/pedidos" style="color:#0f3d2e;font-weight:700;">Ver meu pedido →</a></p>`,
        detailsText: `Ele combina com o seu pedido. Acompanhe pela plataforma: ${SITE_URL}/dashboard/pedidos`,
      });
    } catch (e) {
      console.error("[avisarPedidosDoImovel] falha:", e);
    }
  }
}

/**
 * Resumo diário: um e-mail por dono com os avisos que passaram do limite de
 * 5/dia. Pedido que já não está ativo sai do resumo. Devolve quantos donos e
 * pedidos foram enviados.
 */
export async function enviarResumosDiarios(): Promise<{ donos: number; pedidos: number }> {
  const admin = createAdminClient();
  if (!admin) return { donos: 0, pedidos: 0 };
  const { data } = await admin
    .from("pedido_avisos")
    .select("id, pedido_id, dono_id, imovel_id")
    .eq("canal", "resumo")
    .is("enviado_em", null)
    .order("criado_em", { ascending: true })
    .limit(500);
  const avisos = (data ?? []) as { id: string; pedido_id: string; dono_id: string; imovel_id: string | null }[];
  const porDono = new Map<string, typeof avisos>();
  for (const a of avisos) porDono.set(a.dono_id, [...(porDono.get(a.dono_id) ?? []), a]);

  let donos = 0;
  let enviados = 0;
  for (const [donoId, lista] of porDono) {
    const itens: string[] = [];
    const textos: string[] = [];
    const usados: string[] = [];
    for (const a of lista) {
      const pares = await paresCompat(admin, { pedido: a.pedido_id, dono: donoId });
      const par = pares.find((p) => p.imovel_id === a.imovel_id && p.situacao === "compativel")
        ?? pares.find((p) => p.situacao === "compativel");
      if (!par) {
        await admin.from("pedido_avisos").update({ canal: "nenhum", motivo_nao_envio: "nao_compativel_no_resumo" }).eq("id", a.id);
        continue;
      }
      const pedido = await carregarPedido(admin, a.pedido_id);
      if (!pedido) continue;
      const resumo = `${pedido.cidade}, entrada ${dataBR(pedido.data_inicio)}, ${pedido.prazo_meses} meses, ${pedido.qtd_ocupantes} pessoa(s), ${formatBRL(pedido.orcamento_mensal)}/mês`;
      const url = linkResponder(pedido.id, par.imovel_id);
      itens.push(
        `<li style="margin:0 0 8px;">${textoEmail(resumo, 200)} — combina com “${textoEmail(par.titulo, 120)}”. <a href="${url}" style="color:#0f3d2e;font-weight:700;">Responder</a></li>`
      );
      textos.push(`• ${textoPlano(resumo, 200)} — "${textoPlano(par.titulo, 120)}": ${url}`);
      usados.push(a.id);
    }
    if (usados.length === 0) continue;
    const { data: perfil } = await admin
      .from("profiles")
      .select("email, full_name, notif_email")
      .eq("id", donoId)
      .maybeSingle();
    if (!perfil?.email || perfil.notif_email === false) {
      await admin.from("pedido_avisos").update({ canal: "nenhum", motivo_nao_envio: "notificacoes_desligadas" }).in("id", usados);
      continue;
    }
    const r = await notify({
      event: "pedido_resumo",
      email: perfil.email as string,
      name: (perfil.full_name as string) ?? undefined,
      userId: donoId,
      pushUrl: "/dashboard/pedidos-cidade",
      detailsHtml: `<ul style="margin:12px 0 0;padding-left:18px;color:#334155;">${itens.join("")}</ul>`,
      detailsText: textos.join("\n"),
    });
    if (r.email) {
      await admin.from("pedido_avisos").update({ enviado_em: new Date().toISOString() }).in("id", usados);
      donos += 1;
      enviados += usados.length;
    }
  }
  return { donos, pedidos: enviados };
}

export interface MetricasPedidos {
  dias: number;
  pedidos: number;
  pedidos_com_compativel: number;
  avisos_email: number;
  avisos_resumo: number;
  avisos_respondidos: number;
  horas_media_resposta: number | null;
}

/** Números do admin (últimos `dias`). null sem backend. */
export async function metricasPedidos(dias = 30): Promise<MetricasPedidos | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.rpc("admin_metricas_pedidos", { p_dias: dias });
  if (error || !data) return null;
  return data as MetricasPedidos;
}
