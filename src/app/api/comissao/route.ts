import { NextResponse } from "next/server";
import { createCommissionCharge } from "@/lib/payments/asaas";
import { IntegracaoNaoConfigurada, MSG_NAO_CONFIGURADA } from "@/lib/integracoes";
import { carregarFechamento, reservarFechamento, concluirFechamento } from "@/lib/data/fechamento-servidor";

/**
 * Comissão de fechamento (1º aluguel com split). A5: recebe SÓ o id da
 * candidatura aceita; valor, taxa, carteira do dono e dados do pagador vêm do
 * banco. Uma cobrança por candidatura.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { leadId?: unknown };
  const f = await carregarFechamento(body.leadId);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: f.status });

  if (!(await reservarFechamento(f.leadId, "comissao"))) {
    return NextResponse.json({ error: "A comissão desta candidatura já foi gerada." }, { status: 409 });
  }
  try {
    const result = await createCommissionCharge({
      firstMonthRent: f.aluguelMensal,
      commissionRate: f.comissaoRate,
      ownerWalletId: f.ownerWalletId ?? undefined,
      customerName: f.tenantNome,
      customerEmail: f.tenantEmail ?? "sem-email@vivanomads.com.br",
    });
    await concluirFechamento(f.leadId, "comissao", result.chargeId);
    return NextResponse.json(result);
  } catch (err) {
    await concluirFechamento(f.leadId, "comissao", null);
    if (err instanceof IntegracaoNaoConfigurada) {
      return NextResponse.json({ error: MSG_NAO_CONFIGURADA }, { status: 503 });
    }
    console.error("[comissao] falha:", err);
    return NextResponse.json({ error: "Falha ao gerar a cobrança." }, { status: 502 });
  }
}
