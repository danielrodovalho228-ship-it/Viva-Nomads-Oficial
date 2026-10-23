import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarPdf } from "@/lib/fiscal/pdf";
import { emitidoEmBrasilia, linhaConferir, numeroExibido } from "@/lib/fiscal/prefixos";
import { registrarDocumento } from "@/lib/fiscal/registro";
import { recalcularNivel } from "@/lib/niveis/servidor";
import { classeRuido, type MedidaPonto, type RespostasRuido } from "@/lib/niveis/regras";
import type { NivelOuAdequacao } from "@/config/niveis";
import { VERSAO_CHECKLIST, type ValorItem } from "@/config/checklist-avaliacao";
import { SITE_URL } from "@/lib/site";
import {
  PRAZO_DEVOLUCAO_DIAS,
  avisoExpiracao,
  exibicaoAvaliacao,
  itensSemResposta,
  laudoAtrasado,
  nivelSustentado,
  prazoRessalva,
  quemPerdePaga,
  resultadoAvaliacao,
  ressalvaVencida,
  resumoPorGrupo,
  validadeLaudo,
  devolucaoVencida,
  type DadosLaudoExibicao,
  type ExibicaoAvaliacao,
  type Respostas,
  type Resultado,
} from "./laudo";
import { conteudoLaudo } from "./laudo-documento";
import { consequencias, degrauDoProprietario, expiraEm, geraStrike, imovelComStrike, proximaOrdem, strikesParaApagar, type Strike } from "./strikes";
import { ROTA_AVALIADOR, avisar, avisarAdmins, designar, rotaDono } from "./servidor";

/*
  Prompt 62-B2 — o lado do servidor do laudo: emite o VIS pela plataforma (registrarDocumento), aplica o resultado
  (nível sustentado e "· vistoriado", fora da busca por segurança grave), a contestação ("quem perde paga"), a escada
  de strikes e a rotina diária (48 h úteis, ressalva vencida, expiração, aviso 30 dias, strikes apagados, devolução).
  Roda com o cliente de serviço depois do portão de cada ação, e no cron. Avisos nunca derrubam a gravação.
*/

type Admin = SupabaseClient;
const DIA = 86_400_000;

type LinhaPedido = {
  id: string;
  property_id: string;
  owner_id: string;
  tipo: "inicial" | "reverificacao" | "contestacao" | "verificacao" | "nova_90d";
  status: string;
  avaliador_id: string | null;
  agendado_para: string | null;
  visita_concluida_em: string | null;
  origem_pedido_id: string | null;
  valor_tabela: number | string;
  ruido_respostas: RespostasRuido | null;
  teste: boolean;
};
const COLUNAS_PEDIDO = "id, property_id, owner_id, tipo, status, avaliador_id, agendado_para, visita_concluida_em, origem_pedido_id, valor_tabela, ruido_respostas, teste";

export type LinhaLaudo = {
  id: string;
  pedido_id: string;
  pedido_versao_id: string;
  property_id: string;
  owner_id: string;
  avaliador_id: string | null;
  versao: number;
  numero: string | null;
  documento_id: string | null;
  resultado: Resultado;
  nivel_sustentado: NivelOuAdequacao;
  resumo: ReturnType<typeof resumoPorGrupo>;
  ressalvas: { chave: string; reverificacao: "foto" | "visita" }[];
  graves: string[];
  emitido_em: string;
  prazo_ressalva_ate: string | null;
  corrigido_em: string | null;
  ressalva_vencida_em: string | null;
  vistoriado_em: string | null;
  contestado_em: string | null;
  aviso_expiracao_em: string | null;
  expirado_em: string | null;
  teste: boolean;
};

export async function respostasDoPedido(admin: Admin, pedidoId: string): Promise<{ respostas: Respostas; observacoes: Map<string, string | null> }> {
  const { data } = await admin.from("vistoria_checklist").select("chave, valor, observacao").eq("pedido_id", pedidoId);
  const linhas = (data ?? []) as { chave: string; valor: ValorItem; observacao: string | null }[];
  return { respostas: Object.fromEntries(linhas.map((l) => [l.chave, l.valor])), observacoes: new Map(linhas.map((l) => [l.chave, l.observacao])) };
}

async function medidasDoPedido(admin: Admin, pedidoId: string, visitaEm: string): Promise<MedidaPonto[]> {
  const { data } = await admin.from("vistoria_medicoes").select("ponto, download_mbps, upload_mbps, latencia_ms, medido_em").eq("pedido_id", pedidoId).eq("tipo", "internet");
  const ate = validadeLaudo(visitaEm).toISOString();
  return ((data ?? []) as { ponto: string; download_mbps: number; upload_mbps: number; latencia_ms: number | null; medido_em: string }[])
    .filter((m) => m.ponto === "quarto_principal" || m.ponto === "trabalho")
    .map((m) => ({ ponto: m.ponto as MedidaPonto["ponto"], validada: true, medidoEm: m.medido_em, validoAte: ate, downloadMbps: Number(m.download_mbps), uploadMbps: Number(m.upload_mbps), latenciaMs: Number(m.latencia_ms ?? 0) }));
}

/** O laudo de referência do imóvel: a última versão do último laudo emitido. */
export async function laudoAtual(admin: Admin, propertyId: string): Promise<LinhaLaudo | null> {
  const { data } = await admin.from("vistoria_laudos").select("*").eq("property_id", propertyId).order("emitido_em", { ascending: false }).order("versao", { ascending: false }).limit(1).maybeSingle();
  return (data as LinhaLaudo | null) ?? null;
}

export async function strikesDoDono(admin: Admin, ownerId: string): Promise<(Strike & { id: string })[]> {
  const { data } = await admin.from("proprietario_strikes").select("id, property_id, ordem, criado_em, suspenso_ate, expira_em").eq("owner_id", ownerId);
  return ((data ?? []) as { id: string; property_id: string; ordem: 1 | 2 | 3; criado_em: string; suspenso_ate: string | null; expira_em: string }[]).map((s) => ({
    id: s.id,
    propertyId: s.property_id,
    ordem: s.ordem,
    criadoEm: s.criado_em,
    // 'infinity' (contestação em curso) ou uma data futura: suspenso.
    suspenso: s.suspenso_ate != null && (s.suspenso_ate === "infinity" || Date.parse(s.suspenso_ate) > Date.now()),
    expiraEm: s.expira_em,
  }));
}

/** Dados do "· vistoriado" do imóvel para a ficha e o cartão (a Pista A desenha). Nulo: sem a marca. */
export async function exibicaoDoImovel(admin: Admin, propertyId: string, agora = new Date()): Promise<ExibicaoAvaliacao | null> {
  const l = await laudoAtual(admin, propertyId);
  if (!l || !l.vistoriado_em) return null;
  const [{ data: doc }, { data: cred }, strikes] = await Promise.all([
    l.documento_id ? admin.from("documentos_registro").select("codigo_verificacao").eq("id", l.documento_id).maybeSingle() : Promise.resolve({ data: null }),
    l.avaliador_id ? admin.from("avaliadores_credenciamento").select("numero_credenciado").eq("id", l.avaliador_id).maybeSingle() : Promise.resolve({ data: null }),
    strikesDoDono(admin, l.owner_id),
  ]);
  const d: DadosLaudoExibicao = {
    resultado: l.resultado,
    nivel: l.nivel_sustentado,
    vistoriadoEm: l.vistoriado_em,
    numeroCredenciado: (cred?.numero_credenciado as string | undefined) ?? "",
    resumo: l.resumo,
    codigoConferir: (doc?.codigo_verificacao as string | undefined) ?? "",
    semVistoriadoPorStrike: imovelComStrike(strikes, propertyId, agora),
  };
  return exibicaoAvaliacao(d, agora);
}

/** O nível que o laudo VÁLIDO impõe ao imóvel (prevalece sobre a autodeclaração do 59.1 por 12 meses). */
export async function nivelDoLaudo(admin: Admin, propertyId: string, agora = new Date()): Promise<{ nivel: NivelOuAdequacao; vistoriadoEm: string | null } | null> {
  const l = await laudoAtual(admin, propertyId);
  if (!l || agora >= validadeLaudo(l.emitido_em)) return null;
  const ex = await exibicaoDoImovel(admin, propertyId, agora);
  return { nivel: l.nivel_sustentado, vistoriadoEm: ex ? ex.vistoriadoEm : null };
}

// ── Bloqueios (fora da busca / republicar só com laudo) ──────────────────────────────────────────────────────────
type MotivoBloqueio = "seguranca_grave" | "strike_2" | "strike_3";

export async function bloquear(admin: Admin, propertyId: string, ownerId: string, motivo: MotivoBloqueio, pedidoId: string | null, tirarDaBusca: boolean): Promise<boolean> {
  const { data: ja } = await admin.from("vistoria_bloqueios").select("id").eq("property_id", propertyId).eq("motivo", motivo).is("resolvido_em", null).maybeSingle();
  if (ja) return false;
  let pausou = false;
  if (tirarDaBusca) {
    const { data } = await admin.from("properties").update({ status: "paused" }).eq("id", propertyId).eq("status", "active").select("id");
    pausou = !!data?.length;
  }
  await admin.from("vistoria_bloqueios").insert({ property_id: propertyId, owner_id: ownerId, motivo, pedido_id: pedidoId, pausou });
  return true;
}

/** Resolve o bloqueio; se a plataforma tirou da busca e nenhum outro bloqueio segura, o anúncio volta. */
export async function liberar(admin: Admin, propertyId: string, motivos: MotivoBloqueio[], agora = new Date()): Promise<void> {
  const { data } = await admin.from("vistoria_bloqueios").update({ resolvido_em: agora.toISOString() }).eq("property_id", propertyId).in("motivo", motivos).is("resolvido_em", null).select("pausou");
  const pausou = ((data ?? []) as { pausou: boolean }[]).some((b) => b.pausou);
  const { data: resta } = await admin.from("vistoria_bloqueios").select("id").eq("property_id", propertyId).is("resolvido_em", null).limit(1);
  if (pausou && !resta?.length) await admin.from("properties").update({ status: "active" }).eq("id", propertyId).eq("status", "paused");
}

/** Reaplica a escada do proprietário: 2º = republicar só com laudo; 3º = todos os anúncios fora da busca. */
export async function aplicarEscada(admin: Admin, ownerId: string, agora = new Date()): Promise<number> {
  const [strikes, { data: imoveis }, { data: reprov }] = await Promise.all([
    strikesDoDono(admin, ownerId),
    admin.from("properties").select("id, status").eq("owner_id", ownerId).in("status", ["active", "paused"]),
    admin.from("vistoria_laudos").select("property_id").eq("owner_id", ownerId).eq("resultado", "reprovado").gte("emitido_em", new Date(agora.getTime() - 365 * DIA).toISOString()),
  ]);
  const carteira = (imoveis ?? []) as { id: string; status: string }[];
  const degrau = degrauDoProprietario({ strikes, carteira: carteira.length, imoveisReprovados12m: new Set(((reprov ?? []) as { property_id: string }[]).map((r) => r.property_id)).size, agora });
  const c = consequencias(degrau);
  if (c.todosForaDaBusca) for (const im of carteira) await bloquear(admin, im.id, ownerId, "strike_3", null, true);
  if (c.republicarSoComLaudo) {
    for (const pid of new Set(strikes.filter((s) => !s.suspenso).map((s) => s.propertyId))) await bloquear(admin, pid, ownerId, "strike_2", null, false);
  }
  return degrau;
}

async function registrarStrike(admin: Admin, ownerId: string, propertyId: string, pedidoId: string, origem: "verificacao_reprovada" | "ressalva_vencida", agora: Date): Promise<void> {
  const antes = degrauDoProprietario({ strikes: await strikesDoDono(admin, ownerId), carteira: 1, imoveisReprovados12m: 0, agora });
  const criado = agora.toISOString();
  await admin.from("proprietario_strikes").insert({ owner_id: ownerId, property_id: propertyId, pedido_id: pedidoId, ordem: proximaOrdem(antes), origem, criado_em: criado, expira_em: expiraEm(criado) });
  await aplicarEscada(admin, ownerId, agora);
  await avisar(admin, ownerId, "vistoria_strike", rotaDono(propertyId));
  // O nível do imóvel perde o "· vistoriado".
  await recalcularNivel(admin, propertyId, agora);
}

// ── Emissão do laudo VIS ─────────────────────────────────────────────────────────────────────────────────────────
export type ResEmissao = { ok: true; laudoId: string; numero: string; resultado: Resultado } | { ok: false; erro: string };

/**
 * Emite o laudo da visita (nova versão quando é correção, reverificação ou contestação). O checklist precisa estar
 * completo. Aplica: nível sustentado + "· vistoriado" (aprovado), fora da busca por segurança grave, strike (só em
 * verificação reprovada), "quem perde paga" na contestação.
 */
export async function emitirLaudo(admin: Admin, pedidoId: string, agora = new Date(), motivoVersao: "correcao" | "reverificacao" | null = null): Promise<ResEmissao> {
  const { data: pd } = await admin.from("vistoria_pedidos").select(COLUNAS_PEDIDO).eq("id", pedidoId).maybeSingle();
  const p = pd as LinhaPedido | null;
  if (!p || !p.avaliador_id) return { ok: false, erro: "Pedido não encontrado." };
  if (!motivoVersao && p.status !== "realizada") return { ok: false, erro: "Conclua a visita antes de enviar o laudo." };
  const { respostas, observacoes } = await respostasDoPedido(admin, p.id);
  const falta = itensSemResposta(respostas);
  if (falta.length) return { ok: false, erro: `Faltam ${falta.length} itens do checklist.` };

  const visitaEm = p.visita_concluida_em ?? p.agendado_para ?? agora.toISOString();
  const medidas = await medidasDoPedido(admin, p.id, visitaEm);
  const ruido = p.ruido_respostas;
  const r = resultadoAvaliacao(respostas);
  const nivel = nivelSustentado(respostas, ruido, medidas, agora);
  const resumo = resumoPorGrupo(respostas);

  // Contestação e reverificação: versão nova do MESMO laudo (a referência é o pedido de origem).
  const original = p.tipo === "contestacao" && p.origem_pedido_id ? p.origem_pedido_id : p.id;
  const anterior = await laudoDoPedido(admin, original);
  const versao = anterior ? anterior.versao + 1 : 1;
  const motivo = p.tipo === "contestacao" ? "contestacao" : motivoVersao;

  const [{ data: im }, { data: cred }, { data: fotos }] = await Promise.all([
    admin.from("properties").select("title, city").eq("id", p.property_id).maybeSingle(),
    admin.from("avaliadores_credenciamento").select("numero_credenciado, parceiros(nome_publico, user_id)").eq("id", p.avaliador_id).maybeSingle(),
    admin.from("vistoria_checklist_fotos").select("item_chave").eq("pedido_id", p.id).not("item_chave", "is", null),
  ]);
  const parc = (cred?.parceiros as unknown as { nome_publico: string | null; user_id: string } | null) ?? null;
  const comFoto = new Set(((fotos ?? []) as { item_chave: string }[]).map((f) => f.item_chave));
  const prazo = r.resultado === "com_ressalvas" ? prazoRessalva(agora.toISOString()).toISOString() : null;
  const ehVerificacao = p.tipo === "verificacao";

  let reg;
  try {
    reg = await registrarDocumento(admin, {
      prefixo: "VIS",
      tipo: "laudo_avaliacao",
      ref: { tabela: "vistoria_pedidos", id: original },
      partes: [p.owner_id, parc?.user_id],
      novaVersao: !!anterior,
      conteudo: ({ numero, versao: v, codigo }) =>
        gerarPdf(
          conteudoLaudo(
            {
              imovel: (im?.title as string | null) ?? "Imóvel",
              cidade: (im?.city as string | null) ?? "",
              visitaEm,
              avaliador: { nomeCurto: String(parc?.nome_publico ?? "").trim().split(/\s+/)[0] || "Avaliador", numero: (cred?.numero_credenciado as string | null) ?? "" },
              resultado: r,
              nivel,
              resumo,
              naoConformes: r.naoConformes.map((k) => ({ chave: k, valor: respostas[k]!, observacao: observacoes.get(k) ?? null, temFoto: comFoto.has(k) })),
              ruido: ruido ? classeRuido(ruido) : null,
              internet: medidas.map((m) => ({ ponto: m.ponto as "quarto_principal" | "trabalho", downloadMbps: m.downloadMbps, uploadMbps: m.uploadMbps, latenciaMs: m.latenciaMs })),
              prazoRessalvaAte: prazo,
              motivoVersao: motivo,
            },
            { numero: numeroExibido(numero, v), emitidoEm: emitidoEmBrasilia(agora.toISOString()), conferir: linhaConferir(SITE_URL, codigo) },
          ),
        ),
    });
  } catch (e) {
    console.error("[emitirLaudo] registro", e);
    return { ok: false, erro: "Não foi possível registrar o laudo agora. Tente de novo." };
  }

  const vistoriado = r.resultado === "aprovado" ? agora.toISOString() : null;
  const { data: novo, error } = await admin
    .from("vistoria_laudos")
    .insert({
      pedido_id: original,
      pedido_versao_id: p.id,
      property_id: p.property_id,
      owner_id: p.owner_id,
      avaliador_id: p.avaliador_id,
      versao,
      documento_id: reg.id,
      numero: reg.numero,
      resultado: r.resultado,
      nivel_sustentado: nivel,
      versao_checklist: VERSAO_CHECKLIST,
      resumo,
      ressalvas: r.ressalvas,
      graves: r.graves,
      motivo_versao: motivo,
      emitido_em: agora.toISOString(),
      prazo_ressalva_ate: prazo,
      vistoriado_em: vistoriado,
      teste: p.teste,
    })
    .select("id")
    .single();
  if (error || !novo) {
    console.error("[emitirLaudo] laudo", error?.code, error?.message);
    return { ok: false, erro: "Não foi possível gravar o laudo." };
  }
  await admin.from("vistoria_pedidos").update({ status: "laudo_emitido", atualizado_em: agora.toISOString() }).eq("id", p.id);
  await admin.from("vistoria_fila_admin").update({ resolvido_em: agora.toISOString() }).eq("tipo", "laudo_atrasado").eq("pedido_id", p.id).is("resolvido_em", null);

  // Ruído: as 4 perguntas da visita passam a valer (origem 'vistoria').
  if (ruido) {
    await admin.from("imovel_ruido").upsert({ property_id: p.property_id, ...ruido, classe: classeRuido(ruido), origem: "vistoria", respondido_em: visitaEm }, { onConflict: "property_id" });
  }

  // Segurança grave: fora da busca na hora (fora da contagem de strikes); volta com a correção comprovada.
  if (r.graves.length) {
    await bloquear(admin, p.property_id, p.owner_id, "seguranca_grave", p.id, true);
    await avisar(admin, p.owner_id, "vistoria_fora_da_busca", rotaDono(p.property_id));
  } else {
    await liberar(admin, p.property_id, ["seguranca_grave"], agora);
  }

  // Aprovado (nova avaliação aprovada): sai dos bloqueios de strike deste imóvel; o 3º strike libera a carteira toda.
  if (r.resultado === "aprovado") {
    await liberar(admin, p.property_id, ["strike_2"], agora);
    const { data: b3 } = await admin.from("vistoria_bloqueios").select("property_id").eq("owner_id", p.owner_id).eq("motivo", "strike_3").is("resolvido_em", null);
    for (const b of (b3 ?? []) as { property_id: string }[]) await liberar(admin, b.property_id, ["strike_3"], agora);
  }

  // Strike: só em verificação reprovada (a 1ª avaliação pedida pelo dono nunca gera).
  if (r.resultado === "reprovado" && geraStrike({ origem: "verificacao_reprovada", primeiraPedidaPeloDono: !ehVerificacao })) {
    await registrarStrike(admin, p.owner_id, p.property_id, p.id, "verificacao_reprovada", agora);
  }

  // Contestação resolvida: o strike suspenso volta (dono perdeu) ou cai (dono venceu); "quem perde paga".
  if (p.tipo === "contestacao" && anterior) {
    const { donoVenceu, devolucaoDevida } = quemPerdePaga({ resultado: anterior.resultado, nivel: anterior.nivel_sustentado }, { resultado: r.resultado, nivel });
    if (donoVenceu) await admin.from("proprietario_strikes").delete().eq("pedido_id", anterior.pedido_versao_id);
    else await admin.from("proprietario_strikes").update({ suspenso_ate: null }).eq("pedido_id", anterior.pedido_versao_id);
    if (devolucaoDevida) {
      await admin.from("vistoria_devolucoes").insert({
        pedido_contestacao_id: p.id,
        pedido_original_id: anterior.pedido_versao_id,
        avaliador_id: anterior.avaliador_id,
        owner_id: p.owner_id,
        valor: Number(p.valor_tabela),
        prazo_ate: new Date(agora.getTime() + PRAZO_DEVOLUCAO_DIAS * DIA).toISOString(),
      });
      const { data: c1 } = anterior.avaliador_id ? await admin.from("avaliadores_credenciamento").select("parceiros(user_id)").eq("id", anterior.avaliador_id).maybeSingle() : { data: null };
      await avisar(admin, (c1?.parceiros as unknown as { user_id: string } | null)?.user_id, "vistoria_devolucao", ROTA_AVALIADOR);
    }
    await aplicarEscada(admin, p.owner_id, agora);
  }

  await recalcularNivel(admin, p.property_id, agora);
  await avisar(admin, p.owner_id, "vistoria_laudo_emitido", rotaDono(p.property_id));
  return { ok: true, laudoId: novo.id as string, numero: reg.numero, resultado: r.resultado };
}

async function laudoDoPedido(admin: Admin, pedidoOriginal: string): Promise<LinhaLaudo | null> {
  const { data } = await admin.from("vistoria_laudos").select("*").eq("pedido_id", pedidoOriginal).order("versao", { ascending: false }).limit(1).maybeSingle();
  return (data as LinhaLaudo | null) ?? null;
}

/**
 * Ressalvas corrigidas e reverificadas (foto ou nova visita, pelo mesmo avaliador): grava os itens conferidos e emite a
 * versão nova do laudo. Ressalva toda corrigida → "· vistoriado".
 */
export async function registrarCorrecao(admin: Admin, pedidoId: string, corrigidos: Record<string, ValorItem>, agora = new Date()): Promise<ResEmissao> {
  const l = await laudoDoPedido(admin, pedidoId);
  if (!l || l.corrigido_em || !l.ressalvas.length) return { ok: false, erro: "Não há ressalva aberta neste laudo." };
  for (const [chave, valor] of Object.entries(corrigidos)) {
    await admin.from("vistoria_checklist").upsert({ pedido_id: l.pedido_versao_id, chave, valor, salvo_em: agora.toISOString() }, { onConflict: "pedido_id,chave" });
  }
  const r = await emitirLaudo(admin, l.pedido_versao_id, agora, "correcao");
  if (!r.ok) return r;
  await admin.from("vistoria_laudos").update({ corrigido_em: agora.toISOString() }).eq("id", l.id);
  // A versão nova passa a valer o "· vistoriado" quando ficou aprovada.
  return r;
}

/** Contestação (7 dias, com motivo): 2ª avaliação a OUTRO avaliador; o strike dela fica suspenso até lá. */
export async function abrirContestacao(admin: Admin, laudo: LinhaLaudo, motivo: string, agora = new Date()): Promise<{ ok: true; pedidoId: string } | { ok: false; erro: string }> {
  const { data: orig } = await admin.from("vistoria_pedidos").select("cidade, porte, valor_tabela, ocupado, morador_id, teste").eq("id", laudo.pedido_versao_id).maybeSingle();
  if (!orig) return { ok: false, erro: "Pedido não encontrado." };
  const { data: novo, error } = await admin
    .from("vistoria_pedidos")
    .insert({ property_id: laudo.property_id, owner_id: laudo.owner_id, cidade: orig.cidade, tipo: "contestacao", porte: orig.porte, valor_tabela: orig.valor_tabela, ocupado: orig.ocupado, morador_id: orig.morador_id, origem_pedido_id: laudo.pedido_id, teste: orig.teste })
    .select("id")
    .single();
  if (error || !novo) return { ok: false, erro: "Este imóvel já tem uma avaliação em andamento." };
  await admin.from("vistoria_laudos").update({ contestado_em: agora.toISOString(), contestacao_motivo: motivo }).eq("id", laudo.id);
  await admin.from("proprietario_strikes").update({ suspenso_ate: "infinity" }).eq("pedido_id", laudo.pedido_versao_id);
  await aplicarEscada(admin, laudo.owner_id, agora);
  await designar(admin, novo.id as string, agora);
  return { ok: true, pedidoId: novo.id as string };
}

// ── Rotina diária (cron) ─────────────────────────────────────────────────────────────────────────────────────────
export interface ResumoLaudos {
  atrasados: number;
  ressalvasVencidas: number;
  expirados: number;
  avisosExpiracao: number;
  strikesApagados: number;
  devolucoesVencidas: number;
}

export async function rotinaLaudos(admin: Admin, agora = new Date()): Promise<ResumoLaudos> {
  const r: ResumoLaudos = { atrasados: 0, ressalvasVencidas: 0, expirados: 0, avisosExpiracao: 0, strikesApagados: 0, devolucoesVencidas: 0 };
  const quando = agora.toISOString();

  // 1. Laudo em 48 h úteis da visita: sinal no admin quando vence (conta na auditoria).
  const { data: realizadas } = await admin.from("vistoria_pedidos").select("id, agendado_para, visita_concluida_em").eq("status", "realizada").is("laudo_atrasado_em", null);
  for (const p of (realizadas ?? []) as { id: string; agendado_para: string | null; visita_concluida_em: string | null }[]) {
    const visita = p.visita_concluida_em ?? p.agendado_para;
    if (!visita || !laudoAtrasado(visita, null, agora)) continue;
    await admin.from("vistoria_pedidos").update({ laudo_atrasado_em: quando }).eq("id", p.id).is("laudo_atrasado_em", null);
    await admin.from("vistoria_fila_admin").insert({ tipo: "laudo_atrasado", pedido_id: p.id, motivo: "Laudo não enviado em 48 horas úteis da visita." });
    await avisarAdmins(admin, "vistoria_fila_admin");
    r.atrasados++;
  }

  // 2. Ressalva vencida: verificação (strike quando o laudo é de verificação; senão, gatilho na fila do admin).
  const { data: comRessalva } = await admin.from("vistoria_laudos").select("id, pedido_id, pedido_versao_id, property_id, owner_id, emitido_em, corrigido_em, contestado_em").eq("resultado", "com_ressalvas").is("corrigido_em", null).is("ressalva_vencida_em", null);
  for (const l of (comRessalva ?? []) as { id: string; pedido_id: string; pedido_versao_id: string; property_id: string; owner_id: string; emitido_em: string; corrigido_em: string | null; contestado_em: string | null }[]) {
    if (l.contestado_em || !ressalvaVencida(l.emitido_em, l.corrigido_em, agora)) continue;
    const { data: marcou } = await admin.from("vistoria_laudos").update({ ressalva_vencida_em: quando }).eq("id", l.id).is("ressalva_vencida_em", null).select("id");
    if (!marcou?.length) continue;
    // Laudo superado por versão mais nova não conta.
    const { data: tipo } = await admin.from("vistoria_pedidos").select("tipo").eq("id", l.pedido_versao_id).maybeSingle();
    if (geraStrike({ origem: "ressalva_vencida", primeiraPedidaPeloDono: tipo?.tipo !== "verificacao" })) {
      await registrarStrike(admin, l.owner_id, l.property_id, l.pedido_versao_id, "ressalva_vencida", agora);
    } else {
      await admin.from("vistoria_fila_admin").insert({ tipo: "ressalva_vencida", pedido_id: l.pedido_versao_id, motivo: "Ressalva não corrigida em 15 dias: avaliar abrir verificação." });
    }
    await avisar(admin, l.owner_id, "vistoria_ressalva_vencida", rotaDono(l.property_id));
    r.ressalvasVencidas++;
  }

  // 3. "· vistoriado": aviso 30 dias antes e expiração no dia (o nível volta ao do 59.1).
  const { data: vistoriados } = await admin.from("vistoria_laudos").select("id, property_id, owner_id, vistoriado_em, aviso_expiracao_em, expirado_em").not("vistoriado_em", "is", null).is("expirado_em", null);
  for (const l of (vistoriados ?? []) as { id: string; property_id: string; owner_id: string; vistoriado_em: string; aviso_expiracao_em: string | null }[]) {
    if (agora >= validadeLaudo(l.vistoriado_em)) {
      await admin.from("vistoria_laudos").update({ expirado_em: quando }).eq("id", l.id);
      await recalcularNivel(admin, l.property_id, agora);
      r.expirados++;
    } else if (!l.aviso_expiracao_em && avisoExpiracao(l.vistoriado_em, agora)) {
      await admin.from("vistoria_laudos").update({ aviso_expiracao_em: quando }).eq("id", l.id);
      await avisar(admin, l.owner_id, "vistoria_vistoriado_expira", rotaDono(l.property_id));
      r.avisosExpiracao++;
    }
  }

  // 4. Strikes apagados em 12 meses (inventário 58); a escada é reaplicada.
  const { data: strikes } = await admin.from("proprietario_strikes").select("id, owner_id, expira_em").lte("expira_em", quando);
  const vencidos = strikesParaApagar(((strikes ?? []) as { id: string; owner_id: string; expira_em: string }[]).map((s) => ({ ...s, expiraEm: s.expira_em })), agora);
  if (vencidos.length) {
    await admin.from("proprietario_strikes").delete().in("id", vencidos.map((s) => s.id));
    r.strikesApagados = vencidos.length;
  }

  // 5. Devolução sem confirmação em 15 dias: proposta de descredenciamento na fila do admin.
  const { data: devs } = await admin.from("vistoria_devolucoes").select("id, avaliador_id, prazo_ate, recebido_confirmado_em").is("recebido_confirmado_em", null).is("fila_em", null);
  for (const d of (devs ?? []) as { id: string; avaliador_id: string | null; prazo_ate: string; recebido_confirmado_em: string | null }[]) {
    if (!devolucaoVencida(d.prazo_ate, d.recebido_confirmado_em, agora)) continue;
    await admin.from("vistoria_devolucoes").update({ fila_em: quando }).eq("id", d.id);
    await admin.from("vistoria_fila_admin").insert({ tipo: "devolucao_vencida", avaliador_id: d.avaliador_id, motivo: "Devolução da contestação não confirmada em 15 dias: proposta de descredenciamento." });
    await avisarAdmins(admin, "vistoria_fila_admin");
    r.devolucoesVencidas++;
  }
  return r;
}

