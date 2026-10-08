import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { depsEncaminhamento } from "@/lib/agentes/servidor";
import { dispararEncaminhamentos } from "@/lib/agentes/motor";
import { rodarAvisosDaniel } from "@/lib/agentes/avisos-daniel-servidor";
import { avisarEquipe, type ChamadoResumo } from "@/lib/atendimento/servidor";
import { notify } from "@/lib/notifications";
import { chamadosEsperandoEquipe } from "@/lib/atendimento/escalonamento";
import { PRAZO_MANUTENCAO_H, type UrgenciaManutencao } from "@/config/atendimento";

/**
 * Alertas de prazo do atendimento. Chamado a cada 15 min pelo PRÓPRIO banco
 * (pg_cron + pg_net, 0073) e 1×/dia pelo cron da Vercel (reserva). Exige
 * `Authorization: Bearer <CRON_SECRET>`; sem o segredo, não roda.
 *  • P1/P2 sem 1ª resposta em risco/estourado → e-mail + push aos admins (1×/h);
 *  • manutenção vencida sem resposta do proprietário → avisa o proprietário de
 *    novo e registra o atraso no chamado (1× por ordem).
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });

  // Avaliações (0089): publica às cegas as que venceram os 14 dias sem a outra parte.
  await admin.rpc("publicar_avaliacoes").then(
    () => null,
    () => null
  );

  // Encaminhamento entre agentes (0087): P0/P1 que ninguém disparou ainda (Central fechada).
  await dispararEncaminhamentos(depsEncaminhamento(admin)).catch(() => null);

  // Avisos do Moacir ao Daniel por e-mail (0094): a cada 15 min, junto com este cron.
  await rodarAvisosDaniel(admin, segredo).catch(() => null);

  await admin.rpc("atendimento_varrer_prazos");
  const umaHora = new Date(Date.now() - 3600_000).toISOString();
  const { data: alertas } = await admin
    .from("chamados")
    .select("id, numero_publico, assunto, prioridade, usuario_id, sla_estado, alerta_enviado_em")
    .eq("simulacao", false)
    .is("primeira_resposta_em", null)
    .not("status", "in", "(resolvido,encerrado)")
    .in("prioridade", ["p1", "p2"])
    .in("sla_estado", ["em_risco", "estourado"])
    .or(`alerta_enviado_em.is.null,alerta_enviado_em.lt.${umaHora}`)
    .limit(50);
  for (const c of alertas ?? []) {
    await avisarEquipe(c as ChamadoResumo, c.sla_estado === "estourado" ? "prazo da 1ª resposta ESTOUROU" : "prazo da 1ª resposta em risco");
    await admin.from("chamados").update({ alerta_enviado_em: new Date().toISOString() }).eq("id", c.id);
  }

  // Escalonamento (chamado esperando a EQUIPE, sem resposta humana): 2 h → push e
  // e-mail ao Daniel; 6 h → de novo, e fica em vermelho na Central e no Moacir. 1× por nível.
  let escalados = 0;
  for (const c of await chamadosEsperandoEquipe(admin)) {
    for (const nivel of [2, 6] as const) {
      if (c.nivel < nivel) continue;
      const acao = `escalado_${nivel}h`;
      const { data: ja } = await admin.from("chamado_eventos").select("id").eq("chamado_id", c.id).eq("acao", acao).limit(1);
      if (ja && ja.length) continue;
      await avisarEquipe(c as unknown as ChamadoResumo, nivel === 6 ? `${c.horas} h SEM RESPOSTA da equipe (vermelho na Central)` : `${c.horas} h sem resposta da equipe`);
      await admin.from("chamado_eventos").insert({ chamado_id: c.id, ator_tipo: "sistema", acao, detalhe: `${c.horas} h sem resposta humana` });
      escalados++;
    }
  }

  // Manutenção vencida (prazo do proprietário) — uma vez por ordem.
  let atrasadas = 0;
  const { data: ordens } = await admin
    .from("chamados")
    .select("id, service_order_id, service_orders(id, owner_id, priority, opened_at, first_response_at, status)")
    .eq("simulacao", false)
    .eq("tipo", "manutencao")
    .not("service_order_id", "is", null)
    .not("status", "in", "(resolvido,encerrado)")
    .limit(200);
  for (const ch of ordens ?? []) {
    const so = ch.service_orders as unknown as { id: string; owner_id: string; priority: UrgenciaManutencao; opened_at: string; first_response_at: string | null; status: string } | null;
    if (!so || so.first_response_at || so.status === "resolvido") continue;
    const venceu = new Date(so.opened_at).getTime() + (PRAZO_MANUTENCAO_H[so.priority] ?? 24) * 3600_000 < Date.now();
    if (!venceu) continue;
    const { data: ja } = await admin.from("chamado_eventos").select("id").eq("chamado_id", ch.id).eq("acao", "manutencao_atrasada").limit(1);
    if (ja && ja.length) continue;
    atrasadas++;
    await admin.from("chamado_eventos").insert({ chamado_id: ch.id, ator_tipo: "sistema", acao: "manutencao_atrasada", para: so.priority });
    const { data: dono } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", so.owner_id).maybeSingle();
    if (dono?.email && dono.notif_email !== false) {
      await notify({ event: "manutencao_atrasada", email: dono.email as string, name: (dono.full_name as string) ?? undefined, userId: so.owner_id, pushUrl: "/dashboard/solicitacoes" }).catch(() => null);
    }
  }
  return NextResponse.json({ ok: true, alertas: alertas?.length ?? 0, escalados, manutencaoAtrasada: atrasadas });
}
