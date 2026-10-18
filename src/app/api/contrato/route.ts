import { NextResponse } from "next/server";
import { createContract, isZapsignConfigured } from "@/lib/integrations/zapsign";
import { COST_SPLIT_ITEMS } from "@/lib/closing";
import { IntegracaoNaoConfigurada } from "@/lib/integracoes";
import { createAdminClient } from "@/lib/supabase/admin";
import { contaEhDeTeste, contratoSimuladoTeste } from "@/lib/contas-de-teste";
import { MSG_ASSINATURA_INATIVA } from "@/lib/contrato-etapas";
import { MSG_CONTRATO_EM_ANDAMENTO, decidirGeracaoContrato } from "@/lib/fechamento-contrato";
import { carregarFechamento, reservarFechamento, concluirFechamento, lerReservaFechamento } from "@/lib/data/fechamento-servidor";

/**
 * Contrato no ZapSign. A5: recebe o id da candidatura aceita + escolhas do
 * fechamento (prazo, garantia, divisão de custos); partes, imóvel e aluguel vêm
 * do banco. Um contrato por candidatura.
 * Prompt 24: a resposta diz o `modo` ("teste" | "real" | "inativa"). Conta de teste segue o caminho completo; conta
 * real sem assinatura digital recebe 503 ANTES de reservar; repetir devolve o contrato existente (200, nunca 409).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    leadId?: unknown;
    termMonths?: unknown;
    guarantee?: unknown;
    costSplit?: unknown;
  };
  const f = await carregarFechamento(body.leadId);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: f.status });

  const prazo = Math.round(Number(body.termMonths));
  if (!Number.isFinite(prazo) || prazo < 1 || prazo > 12) {
    return NextResponse.json({ error: "Prazo inválido (1 a 12 meses)." }, { status: 400 });
  }
  const garantia = typeof body.guarantee === "string" ? body.guarantee.trim().slice(0, 60) : "";
  // Divisão de custos: só itens conhecidos, só "owner" | "tenant".
  const chaves = new Set(COST_SPLIT_ITEMS.map((i) => i.key));
  const split: Record<string, "owner" | "tenant"> = {};
  if (body.costSplit && typeof body.costSplit === "object") {
    for (const [k, v] of Object.entries(body.costSplit as Record<string, unknown>)) {
      if (chaves.has(k) && (v === "owner" || v === "tenant")) split[k] = v;
    }
  }

  // Qualquer das partes sendo conta de teste (is_teste): contrato SIMULADO, nada vai ao ZapSign (ordem ee7d27b8).
  const admin = createAdminClient();
  const teste = (await contaEhDeTeste(admin, f.ownerId)) || (await contaEhDeTeste(admin, f.tenantId));
  const d = decidirGeracaoContrato({
    teste,
    assinaturaLigada: isZapsignConfigured(),
    reserva: await lerReservaFechamento(f.leadId, "contrato"),
    agora: Date.now(),
  });
  if (d.acao === "inativa") {
    return NextResponse.json({ modo: "inativa", error: MSG_ASSINATURA_INATIVA }, { status: 503 });
  }
  if (d.acao === "existente") {
    return NextResponse.json({ modo: d.modo, docId: d.docId, existente: true, ...(d.modo === "teste" ? { rotulo: "TESTE" } : {}) });
  }
  if (d.acao === "em_andamento") {
    return NextResponse.json({ error: MSG_CONTRATO_EM_ANDAMENTO }, { status: 409 });
  }

  if (!(await reservarFechamento(f.leadId, "contrato"))) {
    // Corrida com outro clique: o outro pedido está gerando — a tela mantém o botão para tentar de novo.
    return NextResponse.json({ error: MSG_CONTRATO_EM_ANDAMENTO }, { status: 409 });
  }
  try {
    if (d.modo === "teste") {
      const simulado = contratoSimuladoTeste();
      await concluirFechamento(f.leadId, "contrato", simulado.docId);
      return NextResponse.json({ ...simulado, modo: "teste" });
    }
    const result = await createContract({
      tenantName: f.tenantNome,
      tenantEmail: f.tenantEmail ?? undefined,
      ownerName: f.ownerNome,
      propertyTitle: f.tituloImovel,
      monthlyRent: f.aluguelMensal,
      termMonths: prazo,
      guarantee: garantia,
      costSplit: split,
    });
    if (result.demo) {
      // Sem a assinatura digital de verdade a conta real não avança — e a reserva é liberada para depois.
      await concluirFechamento(f.leadId, "contrato", null);
      return NextResponse.json({ modo: "inativa", error: MSG_ASSINATURA_INATIVA }, { status: 503 });
    }
    await concluirFechamento(f.leadId, "contrato", result.docId);
    return NextResponse.json({ ...result, modo: "real" });
  } catch (err) {
    await concluirFechamento(f.leadId, "contrato", null);
    if (err instanceof IntegracaoNaoConfigurada) {
      return NextResponse.json({ modo: "inativa", error: MSG_ASSINATURA_INATIVA }, { status: 503 });
    }
    console.error("[contrato] falha:", err);
    return NextResponse.json({ error: "Falha ao gerar o contrato." }, { status: 502 });
  }
}
