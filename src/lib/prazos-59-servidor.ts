import "server-only";
/*
  Prompt 59 — rotina dos prazos (a cada 15 min pelo banco, 1×/dia pela Vercel). Só do servidor, cliente de serviço.
   A. Padrão mínimo (D4): lembretes aos 15 e aos 3 dias; vencido sem confirmar → sai da busca (pausado por conforto);
      confirmado → volta. Contas de teste seguem a mesma regra.
   B. Pendências: corrigida sem resposta do morador em 48 h → conta como corrigida.
   C. Manutenção: "resolvido" sem resposta do morador em 48 h → fica resolvido na data do dono; avisos de prazo (antes do
      vencimento e vencido), uma vez cada, com silêncio das 22h às 7h, exceto urgente.
   D. FOTO-NA-HORA-B: prova de item de nível anterior à regra (origem 'arquivo') com o prazo de refazer vencido → o item
      deixa de contar (a regra pura já não conta), o nível é recalculado e o dono é avisado uma vez. Tokens de captura e
      links do celular com mais de 1 dia saem.
   E. NIVEIS-MEDIR-B: medição da internet por ponto (dono) que venceu nas últimas 24 h → o nível é recalculado e cai
      para o que os outros itens sustentam (sem esperar outra mudança no anúncio). Recalcular é idempotente; o aviso de
      queda só sai quando o nível gravado cai.
  Nada financeiro (D7). `agora` é injetável (no laboratório a rota aceita a data simulada).
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import { deveSairDaBusca, itensFaltantes, lembreteAdequacao, correcaoConfirmadaPorPrazo, type PendenciaConforto } from "@/lib/conforto/regras";
import { voltarSeCompleto } from "@/lib/conforto/servidor";
import { avisarConfortoPrazo } from "@/lib/conforto/avisos";
import { avisoDevido, confirmacaoVencida, emSilencio, type AvisoSolucao, type OrdemSolucao } from "@/lib/manutencao-solucao";
import { avisarPrazoManutencao } from "@/lib/manutencao-avisos";
import { recalcularNivel } from "@/lib/niveis/servidor";
import { avisarProvaVencida } from "@/lib/niveis/avisos";
import { rotuloItem } from "@/config/niveis";

type Admin = SupabaseClient;

export interface ResumoPrazos59 {
  lembretes: number;
  pausados: number;
  voltaram: number;
  pendenciasConfirmadas: number;
  ordensConfirmadas: number;
  avisosManutencao: number;
  provasVencidas: number;
  /** E. Imóveis recalculados porque uma medição de ponto venceu. */
  medicoesVencidas: number;
}

/** `soImoveis`: só estes imóveis (o laboratório isola o spec dos outros que rodam junto). */
export async function rodarPrazos59(admin: Admin, agora = new Date(), soImoveis?: string[]): Promise<ResumoPrazos59> {
  const r: ResumoPrazos59 = { lembretes: 0, pausados: 0, voltaram: 0, pendenciasConfirmadas: 0, ordensConfirmadas: 0, avisosManutencao: 0, provasVencidas: 0, medicoesVencidas: 0 };

  // ── A. Padrão mínimo ─────────────────────────────────────────────────────────────────────────────────────────────
  let qAdq = admin.from("conforto_adequacao").select("property_id, prazo_ate, lembretes, pausado_em, properties!inner(status)").limit(5000);
  if (soImoveis) qAdq = qAdq.in("property_id", soImoveis);
  const { data: adq } = await qAdq;
  const linhas = (adq ?? []) as unknown as { property_id: string; prazo_ate: string; lembretes: number[] | null; pausado_em: string | null; properties: { status: string } }[];
  if (linhas.length) {
    const { data: decl } = await admin.from("conforto_declaracoes").select("property_id, chave, confirmado, versao_lista").in("property_id", linhas.map((l) => l.property_id));
    const porImovel = new Map<string, { chave: string; confirmado: boolean; versao_lista?: number | null }[]>();
    for (const d of (decl ?? []) as { property_id: string; chave: string; confirmado: boolean; versao_lista?: number | null }[]) porImovel.set(d.property_id, [...(porImovel.get(d.property_id) ?? []), d]);
    for (const l of linhas) {
      const completo = itensFaltantes(porImovel.get(l.property_id) ?? []).length === 0;
      if (completo) {
        if (l.pausado_em && (await voltarSeCompleto(admin, l.property_id))) r.voltaram++;
        continue;
      }
      if (deveSairDaBusca(l.prazo_ate, false, agora)) {
        if (!l.pausado_em && l.properties.status === "active") {
          const { data: pausou } = await admin.from("properties").update({ status: "paused", pausa_motivo: "conforto" }).eq("id", l.property_id).eq("status", "active").select("id");
          if (pausou?.length) {
            await admin.from("conforto_adequacao").update({ pausado_em: agora.toISOString() }).eq("property_id", l.property_id);
            await avisarConfortoPrazo(admin, l.property_id, "pausado", l.prazo_ate).catch(() => null);
            r.pausados++;
          }
        }
        continue;
      }
      const lembrete = lembreteAdequacao(l.prazo_ate, false, agora);
      if (lembrete && !(l.lembretes ?? []).includes(lembrete)) {
        await admin.from("conforto_adequacao").update({ lembretes: [...(l.lembretes ?? []), lembrete] }).eq("property_id", l.property_id);
        await avisarConfortoPrazo(admin, l.property_id, lembrete, l.prazo_ate).catch(() => null);
        r.lembretes++;
      }
    }
  }

  // ── B. Pendências corrigidas sem resposta em 48 h ────────────────────────────────────────────────────────────────
  let qPend = admin.from("conforto_pendencias").select("id, chave, status, aberta_em, prazo_ate, corrigida_em, confirmada_em").eq("status", "corrigida").is("confirmada_em", null).limit(2000);
  if (soImoveis) qPend = qPend.in("property_id", soImoveis);
  const { data: corrigidas } = await qPend;
  for (const p of (corrigidas ?? []) as (PendenciaConforto & { id: string })[]) {
    if (!correcaoConfirmadaPorPrazo(p, agora)) continue;
    const { error } = await admin.from("conforto_pendencias").update({ confirmada_em: agora.toISOString() }).eq("id", p.id).is("confirmada_em", null);
    if (!error) r.pendenciasConfirmadas++;
  }

  // ── C. Manutenção ────────────────────────────────────────────────────────────────────────────────────────────────
  let qOrdens = admin
    .from("service_orders")
    .select("id, priority, status, opened_at, provisoria_em, solucao_marcada_em, solucao_confirmada_em, resolved_at, simulacao")
    .or("status.neq.resolvido,solucao_confirmada_em.is.null")
    .limit(5000);
  if (soImoveis) qOrdens = qOrdens.in("property_id", soImoveis);
  const { data: ordens } = await qOrdens;
  const lista = ((ordens ?? []) as { id: string; priority: OrdemSolucao["priority"]; status: string; opened_at: string; provisoria_em: string | null; solucao_marcada_em: string | null; solucao_confirmada_em: string | null; resolved_at: string | null; simulacao: boolean | null }[]).filter((o) => !o.simulacao);
  const abertas = lista.filter((o) => o.status !== "resolvido");
  const enviados = new Map<string, AvisoSolucao[]>();
  if (abertas.length) {
    const { data: evs } = await admin.from("service_order_eventos").select("service_order_id, status_para").eq("tipo", "aviso").in("service_order_id", abertas.map((o) => o.id));
    for (const e of (evs ?? []) as { service_order_id: string; status_para: AvisoSolucao }[]) enviados.set(e.service_order_id, [...(enviados.get(e.service_order_id) ?? []), e.status_para]);
  }
  for (const o of lista) {
    const ordem: OrdemSolucao = { priority: o.priority, openedAt: o.opened_at, provisoriaEm: o.provisoria_em, solucaoMarcadaEm: o.solucao_marcada_em, solucaoConfirmadaEm: o.solucao_confirmada_em, resolvedAt: o.resolved_at, status: o.status };
    if (o.status === "resolvido") {
      if (confirmacaoVencida(ordem, agora)) {
        const { error } = await admin.from("service_orders").update({ solucao_confirmada_em: agora.toISOString() }).eq("id", o.id).is("solucao_confirmada_em", null);
        if (!error) {
          await admin.from("service_order_eventos").insert({ service_order_id: o.id, papel: "sistema", tipo: "confirmada" });
          r.ordensConfirmadas++;
        }
      }
      continue;
    }
    const aviso = avisoDevido(ordem, agora, enviados.get(o.id) ?? []);
    // Silêncio das 22h às 7h (o aviso sai na primeira rodada depois das 7h), exceto urgente.
    if (aviso && !emSilencio(agora, o.priority) && (await avisarPrazoManutencao(admin, o.id, aviso, agora))) r.avisosManutencao++;
  }
  // ── D. Provas anteriores à regra (FOTO-NA-HORA-B) ────────────────────────────────────────────────────────────────
  let qProva = admin.from("nivel_itens").select("property_id, chave").eq("foto_origem", "arquivo").lte("refazer_ate", agora.toISOString()).is("vencida_avisada_em", null).limit(2000);
  if (soImoveis) qProva = qProva.in("property_id", soImoveis);
  const { data: vencidas } = await qProva;
  const porImovelVencida = new Map<string, string[]>();
  for (const v of (vencidas ?? []) as { property_id: string; chave: string }[]) porImovelVencida.set(v.property_id, [...(porImovelVencida.get(v.property_id) ?? []), v.chave]);
  for (const [propertyId, chaves] of porImovelVencida) {
    const { data: marcadas } = await admin
      .from("nivel_itens")
      .update({ vencida_avisada_em: agora.toISOString() })
      .eq("property_id", propertyId)
      .in("chave", chaves)
      .eq("foto_origem", "arquivo")
      .is("vencida_avisada_em", null)
      .select("chave");
    if (!marcadas?.length) continue;
    await recalcularNivel(admin, propertyId, agora);
    await avisarProvaVencida(admin, propertyId, (marcadas as { chave: string }[]).map((m) => rotuloItem(m.chave))).catch(() => null);
    r.provasVencidas += marcadas.length;
  }
  // ── E. Medição de ponto vencida (NIVEIS-MEDIR-B) ─────────────────────────────────────────────────────────────────
  let qMed = admin
    .from("internet_medicoes")
    .select("property_id")
    .eq("papel", "dono")
    .eq("validada", true)
    .not("ponto", "is", null)
    .lte("valido_ate", agora.toISOString())
    .gt("valido_ate", new Date(agora.getTime() - 24 * 3600_000).toISOString())
    .limit(2000);
  if (soImoveis) qMed = qMed.in("property_id", soImoveis);
  const { data: medVencidas } = await qMed;
  for (const propertyId of new Set(((medVencidas ?? []) as { property_id: string }[]).map((m) => m.property_id))) {
    if (await recalcularNivel(admin, propertyId, agora)) r.medicoesVencidas++;
  }
  if (!soImoveis) {
    const ontem = new Date(agora.getTime() - 24 * 3600_000).toISOString();
    await admin.from("prova_capturas").delete().lt("criado_em", ontem).then(() => undefined, () => undefined);
    await admin.from("prova_links_celular").delete().lt("criado_em", ontem).then(() => undefined, () => undefined);
  }
  return r;
}
