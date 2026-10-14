import { NextResponse } from "next/server";
import { createCommissionCharge } from "@/lib/payments/asaas";
import { IntegracaoNaoConfigurada, MSG_NAO_CONFIGURADA } from "@/lib/integracoes";
import { PRAZO_MAX_MESES, PRAZO_MIN_MESES } from "@/lib/contrato-blocos";
import { carregarFechamento, reservarFechamento, concluirFechamento } from "@/lib/data/fechamento-servidor";

/**
 * Comissão de fechamento: cobrança À PARTE, do PROPRIETÁRIO, sobre o valor total
 * do contrato (aluguel × meses) × taxa congelada no aceite. A plataforma nunca cobra nem repassa o aluguel.
 * Recebe o id da candidatura aceita e o prazo em meses (validado aqui, dentro
 * do limite do produto); aluguel, taxa e dados do pagador vêm do banco. Uma cobrança por candidatura.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { leadId?: unknown; termMonths?: unknown };
  const meses = Math.round(Number(body.termMonths));
  if (!(meses >= PRAZO_MIN_MESES && meses <= PRAZO_MAX_MESES)) {
    return NextResponse.json({ error: "Prazo do contrato inválido." }, { status: 400 });
  }
  const f = await carregarFechamento(body.leadId);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: f.status });

  if (!(await reservarFechamento(f.leadId, "comissao"))) {
    return NextResponse.json({ error: "A comissão desta candidatura já foi gerada." }, { status: 409 });
  }
  try {
    const result = await createCommissionCharge({
      aluguelMensal: f.aluguelMensal,
      meses,
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
