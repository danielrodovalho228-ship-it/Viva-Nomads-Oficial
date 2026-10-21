import { avisarDecisoesAtrasadas } from "@/lib/data/aviso-decisao-documento";
import { avisarDocumentosOrfaos } from "@/lib/data/documentos-orfaos-servidor";
import { NextResponse } from "next/server";
import { gerarCartoesAutomaticos } from "@/lib/data/cartoes-servidor";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, type NotificationEvent } from "@/lib/notifications";
import { hojeEmBrasilia } from "@/lib/checkin";
import { expirarVencidas } from "@/lib/data/propostas-servidor";
import { STATUS_ABERTOS, daVez, venceEm24h, type Autor } from "@/lib/propostas/regras";
import { limparSombra } from "@/lib/data/ranking";
import { precisaAvisoConclusao, precisaLembrete24h } from "@/lib/parceiros/pedido";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import {
  avisoAnuncioIncompleto,
  avisarRenovacao,
  chaveEnvio,
  detalheAutomacao,
  diasEntre,
  lembreteDeSaida,
  modoSimulado,
  pedirAvaliacao,
  podeReceber,
  type TipoAutomacao,
} from "@/lib/automacoes/regras";
import { COLUNAS_ESTADO_CONTRATO, primeiroPagamentoConfirmado, type LinhaEstadoContrato } from "@/lib/contrato-estado";
import { HREF_ESTADIA } from "@/lib/estadia/estadia";
import { LEMBRETE_DONO_DIAS, instrucoesEfetivas, instrucoesPreenchidas, lembrarDono, liberaHoje, normalizarInstrucoes } from "@/lib/estadia/instrucoes";
import { RETENCAO_OCUPANTES_DIAS, diaDeCorteRetencao, ocupantesVencidos } from "@/lib/estadia/ocupantes";

/**
 * Automações por data (ordem d250ea2f, item 5): rascunho de imóvel parado (1 e 3 dias), lembrete de saída (3 dias),
 * pedido de avaliação (1 dia após a saída) e aviso de renovação (15 dias antes do fim do bloco). Página da estadia
 * (Prompt 32): instruções de chegada liberadas no D-7 (morador), lembrete das instruções no D-10 (dono), ocupantes
 * apagados 90 dias depois do fim e aditivos vencidos.
 * Cron diário da Vercel (vercel.json) com `Authorization: Bearer <CRON_SECRET>`; sem o segredo, não roda.
 * Cada aviso sai UMA vez por pessoa (automacoes_envios). Quem desligou os avisos (notif_email) não recebe.
 * `?simular=1` só conta o que sairia: não envia e não marca nada (passe obrigatório antes de ligar de verdade).
 * Trava: sem `AUTOMACOES_ATIVO=1` no ambiente o cron SEMPRE simula, mesmo agendado no vercel.json.
 * Candidatura iniciada e não enviada fica de fora: a candidatura não guarda rascunho no banco.
 */
type Alvo = { tipo: TipoAutomacao; usuarioId: string; refId: string; variante?: string; url: string; detalhe: string; depois?: () => Promise<unknown> };

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const simular = modoSimulado(new URL(request.url).searchParams.get("simular"), process.env.AUTOMACOES_ATIVO);
  const hoje = hojeEmBrasilia(new Date());
  const dia = (n: number) => new Date(Date.parse(hoje) + n * 86_400_000).toISOString().slice(0, 10);
  const alvos: Alvo[] = [];

  // 1) Rascunho de imóvel parado há 1 e 3 dias → proprietário.
  const { data: rascunhos } = await admin
    .from("properties")
    .select("id, owner_id, title, created_at")
    .eq("status", "draft")
    .gte("created_at", `${dia(-5)}T00:00:00Z`)
    .limit(500);
  for (const p of rascunhos ?? []) {
    const dias = avisoAnuncioIncompleto(p.created_at as string, hoje);
    if (!dias || !p.owner_id) continue;
    alvos.push({
      tipo: "anuncio_incompleto",
      usuarioId: p.owner_id as string,
      refId: p.id as string,
      variante: String(dias),
      url: `/dashboard/imoveis/${p.id}`,
      detalhe: detalheAutomacao("anuncio_incompleto", { imovel: (p.title as string) || undefined, dias }),
    });
  }

  // 2-4) Contratos ativos assinados pelas duas partes: saída, avaliação e renovação.
  const { data: contratos } = await admin
    .from("contratos")
    .select("id, tenant_id, properties(owner_id, title), contrato_blocos(id, fim, status, renovacao_notificada_em)")
    .in("status", ["ativo", "encerrado"])
    .not("assinado_proprietario_em", "is", null)
    .not("assinado_inquilino_em", "is", null)
    .limit(1000);
  type Bloco = { id: string; fim: string; status: string; renovacao_notificada_em: string | null };
  const jaAvaliaram = new Set<string>();
  const { data: avs } = await admin.from("avaliacoes").select("contrato_id, autor_id").gte("criado_em", `${dia(-3)}T00:00:00Z`).limit(2000);
  for (const a of avs ?? []) jaAvaliaram.add(`${a.contrato_id}:${a.autor_id}`);
  for (const c of contratos ?? []) {
    const blocos = ((c.contrato_blocos as Bloco[] | null) ?? []).filter((b) => b.fim);
    if (!blocos.length) continue;
    const prop = c.properties as unknown as { owner_id?: string; title?: string } | null;
    const partes = [prop?.owner_id, c.tenant_id as string].filter((u): u is string => !!u);
    const imovel = prop?.title || undefined;
    const fimFinal = blocos.reduce((m, b) => (b.fim > m ? b.fim : m), "");
    if (lembreteDeSaida(fimFinal, hoje)) {
      for (const u of partes) alvos.push({ tipo: "saida_lembrete", usuarioId: u, refId: c.id as string, url: `/dashboard/contratos/${c.id}`, detalhe: detalheAutomacao("saida_lembrete", { imovel, fim: fimFinal }) });
    }
    if (pedirAvaliacao(fimFinal, hoje)) {
      for (const u of partes) {
        if (jaAvaliaram.has(`${c.id}:${u}`)) continue;
        alvos.push({ tipo: "avaliacao_pedido", usuarioId: u, refId: c.id as string, url: `/dashboard/avaliacoes`, detalhe: detalheAutomacao("avaliacao_pedido", { imovel, fim: fimFinal }) });
      }
    }
    for (const b of blocos) {
      if (b.status !== "ativo" || b.renovacao_notificada_em || !avisarRenovacao(b.fim, hoje)) continue;
      partes.forEach((u, i) =>
        alvos.push({
          tipo: "renovacao_aviso",
          usuarioId: u,
          refId: b.id,
          url: `/dashboard/contratos/${c.id}`,
          detalhe: detalheAutomacao("renovacao_aviso", { imovel, fim: b.fim }),
          // Marca o bloco só depois do último destinatário.
          depois: i === partes.length - 1 ? async () => admin.from("contrato_blocos").update({ renovacao_notificada_em: new Date().toISOString() }).eq("id", b.id) : undefined,
        })
      );
    }
  }

  // 5) Proposta aberta que vence nas próximas 24 h → quem tem de responder (prompt 27, item 7).
  const agora = new Date();
  const { data: abertas } = await admin
    .from("propostas")
    .select("id, numero, owner_id, tenant_id, versao_atual, valida_ate, properties(title), proposta_versoes(versao, autor)")
    .in("status", STATUS_ABERTOS as string[])
    .gt("valida_ate", agora.toISOString())
    .lte("valida_ate", new Date(agora.getTime() + 86_400_000).toISOString())
    .limit(500);
  for (const p of abertas ?? []) {
    if (!venceEm24h(p.valida_ate as string, agora)) continue;
    const ultima = ((p.proposta_versoes as { versao: number; autor: Autor }[] | null) ?? []).find((v) => v.versao === p.versao_atual);
    if (!ultima) continue;
    const vez = daVez(ultima.autor);
    alvos.push({
      tipo: "proposta_vencendo",
      usuarioId: (vez === "owner" ? p.owner_id : p.tenant_id) as string,
      refId: p.id as string,
      variante: String(p.versao_atual),
      url: `/dashboard/propostas/${p.id}`,
      detalhe: detalheAutomacao("proposta_vencendo", { imovel: (p.properties as unknown as { title?: string } | null)?.title || undefined, numero: p.numero as string }),
    });
  }

  // 6) Pedidos de parceiro (Prompt 31b): lembrete do serviço marcado (às duas partes) e entrega há 7 dias sem a
  // confirmação do cliente (só aviso: nada conclui sozinho).
  const { data: pedidosParceiro } = await admin
    .from("parceiro_pedidos")
    .select("id, codigo, status, cliente_id, horario_confirmado, entregue_em, parceiros(user_id)")
    .in("status", ["agendado", "entregue"])
    .limit(1000);
  for (const p of pedidosParceiro ?? []) {
    const parceiroUser = (p.parceiros as unknown as { user_id?: string } | null)?.user_id;
    const url = `/dashboard/servicos/pedidos/${p.id}`;
    if (precisaLembrete24h(p.status as string, p.horario_confirmado as string | null, agora)) {
      const quando = dataHoraBRT(p.horario_confirmado as string, { semEtiqueta: true });
      for (const quem of [p.cliente_id as string, parceiroUser].filter((x): x is string => !!x)) {
        alvos.push({ tipo: "parceiro_lembrete", usuarioId: quem, refId: p.id as string, variante: String(p.horario_confirmado), url, detalhe: detalheAutomacao("parceiro_lembrete", { numero: p.codigo as string, quando }) });
      }
    }
    if (precisaAvisoConclusao(p.status as string, p.entregue_em as string | null, agora)) {
      alvos.push({ tipo: "parceiro_conclusao_pendente", usuarioId: p.cliente_id as string, refId: p.id as string, url, detalhe: detalheAutomacao("parceiro_conclusao_pendente", { numero: p.codigo as string }) });
    }
  }

  // 7) Página da estadia (Prompt 32): instruções de chegada liberadas no D-7 (morador; contrato assinado pelas duas
  // partes e 1º pagamento registrado) e lembrete ao dono no D-10 se ainda não preencheu.
  const { data: estadias } = await admin
    .from("contratos")
    .select(`id, property_id, tenant_id, ${COLUNAS_ESTADO_CONTRATO}, properties(title, owner_id, checkin_after), contrato_blocos(inicio, fim, status)`)
    .eq("status", "ativo")
    .limit(1000);
  for (const c of estadias ?? []) {
    const blocos = ((c.contrato_blocos ?? []) as { inicio: string; fim: string; status: string }[]).filter((b) => b.status !== "nao_aceito");
    const inicio = blocos.map((b) => b.inicio).sort()[0];
    if (!inicio || inicio < hoje || inicio > dia(LEMBRETE_DONO_DIAS)) continue;
    const prop = c.properties as unknown as { title?: string; owner_id?: string } | null;
    const imovel = prop?.title || undefined;
    const url = HREF_ESTADIA(c.id as string);
    const condicao = {
      inicio,
      assinadoPelasDuas: !!c.assinado_proprietario_em && !!c.assinado_inquilino_em,
      primeiroPagamento: primeiroPagamentoConfirmado(c.pagamentos_bloco as LinhaEstadoContrato["pagamentos_bloco"]),
    };
    if (liberaHoje(condicao, agora)) {
      alvos.push({
        tipo: "estadia_instrucoes_liberadas",
        usuarioId: c.tenant_id as string,
        refId: c.id as string,
        url: `${url}#instrucoes`,
        detalhe: detalheAutomacao("estadia_instrucoes_liberadas", { imovel, fim: inicio }),
        depois: async () => admin.from("contrato_eventos").insert({ contrato_id: c.id, tipo: "instrucoes_liberadas", dados: { inicio } }),
      });
    }
    if (prop?.owner_id && diasEntre(hoje, inicio) === LEMBRETE_DONO_DIAS) {
      const [{ data: im }, { data: ck }] = await Promise.all([
        admin.from("imovel_instrucoes_chegada").select("*").eq("property_id", c.property_id as string).maybeSingle(),
        admin.from("contratos_checkin").select("instrucoes").eq("contrato_id", c.id as string).maybeSingle(),
      ]);
      const efetivas = instrucoesEfetivas(im ? normalizarInstrucoes(im as Record<string, unknown>) : null, (ck as { instrucoes?: string } | null)?.instrucoes);
      if (lembrarDono(inicio, instrucoesPreenchidas(efetivas), agora)) {
        alvos.push({ tipo: "estadia_instrucoes_pendentes", usuarioId: prop.owner_id, refId: c.id as string, url: `${url}#instrucoes`, detalhe: detalheAutomacao("estadia_instrucoes_pendentes", { imovel, fim: inicio }) });
      }
    }
  }

  const contagem: Record<string, number> = {};
  for (const a of alvos) {
    const { data: perfil } = await admin.from("profiles").select("email, full_name, notif_email").eq("id", a.usuarioId).maybeSingle();
    if (!podeReceber(perfil as { email?: string; notif_email?: boolean } | null)) continue;
    if (simular) {
      contagem[a.tipo] = (contagem[a.tipo] ?? 0) + 1;
      continue;
    }
    // Marca ANTES de enviar: se o envio falhar, melhor perder um aviso do que mandar dois.
    const { error } = await admin.from("automacoes_envios").insert({ chave: chaveEnvio(a.tipo, a.refId, a.usuarioId, a.variante), tipo: a.tipo, usuario_id: a.usuarioId });
    if (error) continue; // chave repetida (já enviado) ou falha: não envia
    await notify({
      event: a.tipo as NotificationEvent,
      email: perfil!.email as string,
      name: (perfil!.full_name as string) ?? undefined,
      userId: a.usuarioId,
      pushUrl: a.url,
      detailsText: a.detalhe,
    }).catch(() => null);
    if (a.depois) await a.depois().catch(() => null);
    contagem[a.tipo] = (contagem[a.tipo] ?? 0) + 1;
  }
  // Propostas (prompt 17): validade vencida → "Expirada" (a leitura também expira, esta é a rede diária).
  const propostasExpiradas = await expirarVencidas(admin);
  // Documentos (rota rápida dos e-mails, item 3b): decisões que esperam há mais de 2 h porque o admin deixou outro
  // documento do mesmo imóvel na fila — sai o resumo do que já foi decidido, um por imóvel, uma vez só.
  const documentosAvisados = simular
    ? ((await admin.rpc("decisoes_documento_atrasadas", { p_horas: 2 })).data as unknown[] | null)?.length ?? 0
    : await avisarDecisoesAtrasadas(admin, 2);
  // Rede de segurança (Prompt 35A, item 1): documento no bucket há mais de 2 h sem linha na fila → aviso à equipe
  // com o dono e a data (uma vez por arquivo). Não apaga nada; no simulado só conta.
  const documentosSemFila = await avisarDocumentosOrfaos(admin, agora, simular);
  // Cartões compartilháveis: cartão-postal depois da saída e cartão de todo anúncio publicado (nunca no simulado).
  const cartoes = simular ? null : await gerarCartoesAutomaticos(admin, hoje).catch(() => null);
  // Ordem dos imóveis (Prompt 33): o modo sombra guarda 30 dias, sem dados pessoais (nunca no simulado).
  const sombraApagada = simular ? 0 : await limparSombra(admin).catch(() => 0);
  // Avaliações de pedido de parceiro: publicam 14 dias depois da conclusão, mesmo sem a outra parte (nunca no simulado).
  const avaliacoesParceiro = simular ? 0 : Number((await admin.rpc("publicar_avaliacoes_parceiro")).data ?? 0) || 0;
  // Página da estadia (Prompt 32): ocupantes apagados RETENCAO_OCUPANTES_DIAS depois do fim do contrato; aditivos sem
  // resposta em 7 dias vencem (nada muda no contrato). Na simulação, só conta.
  const estadia = await manutencaoDaEstadia(admin, agora, simular).catch(() => ({ ocupantesApagados: 0, aditivosVencidos: 0 }));
  return NextResponse.json({ ok: true, simulado: simular, cartoes, enviados: contagem, propostasExpiradas, documentosAvisados, documentosSemFila, sombraApagada, avaliacoesParceiro, ...estadia });
}

/** Retenção dos ocupantes (90 dias depois do fim) e aditivos vencidos. `simular`: só conta, não apaga nem muda nada. */
async function manutencaoDaEstadia(admin: NonNullable<ReturnType<typeof createAdminClient>>, agora: Date, simular: boolean) {
  const corte = diaDeCorteRetencao(agora);
  const { data: comOcupantes } = await admin.from("contrato_ocupantes").select("contrato_id, contratos(contrato_blocos(fim, status))").limit(2000);
  const vencidos = new Set<string>();
  for (const o of (comOcupantes ?? []) as unknown as { contrato_id: string; contratos: { contrato_blocos: { fim: string; status: string }[] | null } | null }[]) {
    const fim = (o.contratos?.contrato_blocos ?? []).filter((b) => b.status !== "nao_aceito").map((b) => b.fim).sort().at(-1);
    if (fim && fim < corte && ocupantesVencidos(fim, agora)) vencidos.add(o.contrato_id);
  }
  const { data: abertos } = await admin.from("contrato_aditivos").select("id, contrato_id").eq("status", "proposto").lt("expira_em", agora.toISOString());
  if (simular) return { ocupantesApagados: vencidos.size, aditivosVencidos: abertos?.length ?? 0 };
  for (const id of vencidos) {
    await admin.from("contrato_ocupantes").delete().eq("contrato_id", id);
    await admin.from("contrato_eventos").insert({ contrato_id: id, tipo: "ocupantes_apagados", dados: { retencao_dias: RETENCAO_OCUPANTES_DIAS } });
  }
  for (const a of (abertos ?? []) as { id: string; contrato_id: string }[]) {
    const { data } = await admin.from("contrato_aditivos").update({ status: "expirado" }).eq("id", a.id).eq("status", "proposto").select("id");
    if (data?.length) await admin.from("contrato_eventos").insert({ contrato_id: a.contrato_id, tipo: "aditivo_expirado", dados: { aditivo: a.id } });
  }
  return { ocupantesApagados: vencidos.size, aditivosVencidos: abertos?.length ?? 0 };
}
