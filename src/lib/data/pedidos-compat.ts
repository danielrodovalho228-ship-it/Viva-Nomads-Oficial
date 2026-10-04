/**
 * Pedido de Moradia × imóveis — avisos e dados de tela (SERVER-ONLY, sem
 * "use server": chamado pelas server actions e pela rota do resumo diário).
 *
 * A regra de compatibilidade é a função do banco `compatibilidade_pedidos`
 * (0064), chamada só pelo cliente de serviço. Aqui:
 *  • e-mail SÓ para o dono com imóvel compatível, dizendo qual e por quê;
 *  • 1 aviso por pedido por dono (único no banco); até 5 e-mails por dia por
 *    dono — o resto vai no resumo diário; respeita notif_email;
 *  • tudo registrado em pedido_avisos (números do admin).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { SITE_URL } from "@/lib/site";
import { textoEmail, textoPlano } from "@/lib/notifications/texto-seguro";
import { formatBRL, dataBR } from "@/lib/utils";
import { motivoLabel } from "@/lib/pedidos/pedidos";
import {
  EMAILS_PEDIDO_POR_DIA,
  melhorPor,
  porQueCombina,
  sugestaoAjuste,
  type ParCompat,
} from "@/lib/pedidos/compatibilidade";
import { consumirLimite, DIA } from "@/lib/limites";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

interface PedidoResumo {
  id: string;
  inquilino_id: string;
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

/** Bloco do e-mail ao dono: o pedido (sem nome nem contato) + por que combina. */
function detalheCompativel(pedido: PedidoResumo, par: ParCompat): { html: string; text: string } {
  const linhas: [string, string][] = [
    ["Cidade", `${pedido.cidade}${pedido.uf ? `/${pedido.uf}` : ""}`],
    ["Entrada", dataBR(pedido.data_inicio)],
    ["Prazo", `${pedido.prazo_meses} ${pedido.prazo_meses === 1 ? "mês" : "meses"}`],
    ["Ocupantes", String(pedido.qtd_ocupantes)],
    ["Orçamento", `${formatBRL(pedido.orcamento_mensal)}/mês`],
    ["Motivo", motivoLabel(pedido.motivo)],
  ];
  if (pedido.pets) linhas.push(["Pet", "sim"]);
  if (pedido.criancas) linhas.push(["Crianças", "sim"]);
  const porque = porQueCombina(par);
  const url = linkResponder(pedido.id, par.imovel_id);
  const html = `
    <table role="presentation" style="margin:12px 0 0;border-collapse:collapse;color:#334155;font-size:14px;">
      ${linhas
        .map(
          ([k, v]) =>
            `<tr><td style="padding:2px 12px 2px 0;color:#64748b;">${textoEmail(k, 40)}</td><td style="padding:2px 0;font-weight:600;">${textoEmail(v, 80)}</td></tr>`
        )
        .join("")}
    </table>
    <p style="margin:16px 0 4px;color:#0f3d2e;font-weight:700;">Seu imóvel “${textoEmail(par.titulo, 120)}” combina:</p>
    <ul style="margin:0;padding-left:18px;color:#334155;">${porque.map((m) => `<li>${textoEmail(m, 160)}</li>`).join("")}</ul>
    <p style="margin:16px 0 0;"><a href="${url}" style="display:inline-block;background:#0f3d2e;color:#fff;padding:10px 18px;border-radius:999px;font-weight:700;text-decoration:none;">Responder com este imóvel</a></p>`;
  const text = [
    ...linhas.map(([k, v]) => `${k}: ${textoPlano(v, 80)}`),
    "",
    `Seu imóvel "${textoPlano(par.titulo, 120)}" combina:`,
    ...porque.map((m) => `• ${m}`),
    "",
    `Responder com este imóvel: ${url}`,
  ].join("\n");
  return { html, text };
}

async function carregarPedido(admin: Admin, pedidoId: string): Promise<PedidoResumo | null> {
  const { data } = await admin
    .from("pedidos_moradia")
    .select("id, inquilino_id, cidade, uf, data_inicio, prazo_meses, qtd_ocupantes, orcamento_mensal, motivo, pets, criancas")
    .eq("id", pedidoId)
    .maybeSingle();
  return (data as PedidoResumo | null) ?? null;
}

/**
 * Aviso ao DONO de um imóvel compatível (1 por pedido por dono). Decide o
 * canal: e-mail (até 5/dia), resumo diário (passou do limite) ou nenhum
 * (sem e-mail ou notificações desligadas). Registra em pedido_avisos.
 */
async function avisarDono(admin: Admin, pedido: PedidoResumo, par: ParCompat): Promise<"email" | "resumo" | "nenhum" | "ja_avisado"> {
  const { data: perfil } = await admin
    .from("profiles")
    .select("email, full_name, notif_email")
    .eq("id", par.dono_id)
    .maybeSingle();

  let canal: "email" | "resumo" | "nenhum" = "email";
  let motivoNaoEnvio: string | null = null;
  if (!perfil?.email) {
    canal = "nenhum";
    motivoNaoEnvio = "sem_email";
  } else if (perfil.notif_email === false) {
    canal = "nenhum";
    motivoNaoEnvio = "notificacoes_desligadas";
  } else {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("pedido_avisos")
      .select("id", { count: "exact", head: true })
      .eq("dono_id", par.dono_id)
      .eq("canal", "email")
      .gte("enviado_em", desde);
    if ((count ?? 0) >= EMAILS_PEDIDO_POR_DIA) {
      canal = "resumo";
      motivoNaoEnvio = "limite_diario";
    }
  }

  const { data: aviso, error } = await admin
    .from("pedido_avisos")
    .insert({
      pedido_id: pedido.id,
      dono_id: par.dono_id,
      imovel_id: par.imovel_id,
      nota: par.nota,
      canal,
      motivo_nao_envio: motivoNaoEnvio,
    })
    .select("id")
    .single();
  if (error) return error.code === "23505" ? "ja_avisado" : "nenhum";

  if (canal === "email" && perfil?.email) {
    const d = detalheCompativel(pedido, par);
    const r = await notify({
      event: "pedido_compativel",
      subject: `Pedido de moradia compatível com ${par.titulo}`,
      email: perfil.email as string,
      name: (perfil.full_name as string) ?? undefined,
      userId: par.dono_id,
      pushUrl: "/dashboard/pedidos-cidade",
      detailsHtml: d.html,
      detailsText: d.text,
    });
    if (r.email) {
      await admin.from("pedido_avisos").update({ enviado_em: new Date().toISOString() }).eq("id", aviso.id);
    } else {
      await admin.from("pedido_avisos").update({ motivo_nao_envio: "falha_envio" }).eq("id", aviso.id);
    }
  }
  return canal;
}

/**
 * Pedido acabou de ser publicado: avisa só os donos com imóvel compatível (o
 * melhor imóvel de cada um) e devolve, para a tela do inquilino, quantos
 * imóveis combinam agora e — se nenhum — uma sugestão de ajuste.
 */
export async function avisarCompativeisDoPedido(
  pedidoId: string
): Promise<{ compativeis: number; sugestao: string | null }> {
  const admin = createAdminClient();
  if (!admin) return { compativeis: 0, sugestao: null };
  const pedido = await carregarPedido(admin, pedidoId);
  if (!pedido) return { compativeis: 0, sugestao: null };

  const pares = await paresCompat(admin, { pedido: pedidoId });
  const compat = pares.filter((p) => p.situacao === "compativel");
  await admin.from("pedidos_moradia").update({ compativeis_ao_publicar: compat.length }).eq("id", pedidoId);

  for (const par of melhorPor(compat, "dono_id").values()) {
    try {
      await avisarDono(admin, pedido, par);
    } catch (e) {
      console.error("[avisarCompativeisDoPedido] falha ao avisar dono:", e);
    }
  }
  return { compativeis: compat.length, sugestao: compat.length === 0 ? sugestaoAjuste(pares) : null };
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
  for (const par of pares) {
    try {
      const pedido = await carregarPedido(admin, par.pedido_id);
      if (!pedido) continue;
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
