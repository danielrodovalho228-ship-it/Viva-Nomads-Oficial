import { NextResponse } from "next/server";
import { createCommissionCharge } from "@/lib/payments/asaas";
import { IntegracaoNaoConfigurada, MSG_NAO_CONFIGURADA } from "@/lib/integracoes";
import { carregarFechamento, comissaoDoContrato, reservarFechamento, concluirFechamento } from "@/lib/data/fechamento-servidor";

/**
 * Comissão de fechamento: cobrança À PARTE, do PROPRIETÁRIO, sobre o valor total
 * do contrato (aluguel × meses) × taxa congelada no aceite. A plataforma nunca cobra nem repassa o aluguel.
 * Recebe SÓ o id da candidatura aceita. Aluguel, MESES e taxa vêm do CONTRATO já registrado
 * (o mesmo número de contratos.comissao_valor — ordem c54366b0); o navegador não informa prazo.
 * Dados do pagador vêm do banco. Uma cobrança por candidatura.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { leadId?: unknown };
  const f = await carregarFechamento(body.leadId);
  if ("error" in f) return NextResponse.json({ error: f.error }, { status: f.status });
  const contrato = await comissaoDoContrato(f.leadId);
  if (!contrato) {
    return NextResponse.json({ error: "Registre o contrato antes de gerar a cobrança da comissão." }, { status: 409 });
  }

  if (!(await reservarFechamento(f.leadId, "comissao"))) {
    return NextResponse.json({ error: "A comissão desta candidatura já foi gerada." }, { status: 409 });
  }
  try {
    const result = await createCommissionCharge({
      aluguelMensal: contrato.aluguelMensal,
      meses: contrato.meses,
      commissionRate: contrato.taxa,
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
