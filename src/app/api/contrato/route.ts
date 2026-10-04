import { NextResponse } from "next/server";
import { createContract } from "@/lib/integrations/zapsign";
import { COST_SPLIT_ITEMS } from "@/lib/closing";
import { IntegracaoNaoConfigurada, MSG_NAO_CONFIGURADA } from "@/lib/integracoes";
import { carregarFechamento, reservarFechamento, concluirFechamento } from "@/lib/data/fechamento-servidor";

/**
 * Contrato no ZapSign. A5: recebe o id da candidatura aceita + escolhas do
 * fechamento (prazo, garantia, divisão de custos); partes, imóvel e aluguel vêm
 * do banco. Um contrato por candidatura.
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

  if (!(await reservarFechamento(f.leadId, "contrato"))) {
    return NextResponse.json({ error: "O contrato desta candidatura já foi gerado." }, { status: 409 });
  }
  try {
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
    await concluirFechamento(f.leadId, "contrato", result.docId);
    return NextResponse.json(result);
  } catch (err) {
    await concluirFechamento(f.leadId, "contrato", null);
    if (err instanceof IntegracaoNaoConfigurada) {
      return NextResponse.json({ error: MSG_NAO_CONFIGURADA }, { status: 503 });
    }
    console.error("[contrato] falha:", err);
    return NextResponse.json({ error: "Falha ao gerar o contrato." }, { status: 502 });
  }
}
