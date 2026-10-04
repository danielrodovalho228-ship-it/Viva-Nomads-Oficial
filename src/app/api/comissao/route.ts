import { NextResponse } from "next/server";
import { createCommissionCharge } from "@/lib/payments/asaas";
import { IntegracaoNaoConfigurada, MSG_NAO_CONFIGURADA } from "@/lib/integracoes";
import { carregarFechamento, reservarFechamento, concluirFechamento } from "@/lib/data/fechamento-servidor";

/**
 * Comissão de fechamento: cobrança À PARTE, do PROPRIETÁRIO, de 1 aluguel ×
 * taxa congelada no aceite. A plataforma nunca cobra nem repassa o aluguel.
 * Recebe SÓ o id da candidatura aceita; valor, taxa e dados do pagador vêm do
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
      aluguelMensal: f.aluguelMensal,
      commissionRate: f.comissaoRate,
      ownerName: f.ownerNome,
      ownerEmail: f.ownerEmail ?? "sem-email@vivanomads.com.br",
      ownerCpfCnpj: f.ownerCpfCnpj ?? undefined,
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
