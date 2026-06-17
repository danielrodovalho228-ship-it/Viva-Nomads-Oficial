import { NextResponse } from "next/server";
import { createCommissionCharge } from "@/lib/payments/asaas";
import { COMMISSION_BY_PLAN } from "@/lib/constants";

/** Cria a cobrança de comissão de fechamento (split) sobre o 1º mês. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { firstMonthRent, plan, ownerWalletId, name, email } = body as {
    firstMonthRent?: number;
    plan?: string;
    ownerWalletId?: string;
    name?: string;
    email?: string;
  };

  if (!firstMonthRent || firstMonthRent <= 0) {
    return NextResponse.json({ error: "Valor do aluguel inválido." }, { status: 400 });
  }

  const commissionRate = COMMISSION_BY_PLAN[plan ?? "free"] ?? 0.12;

  try {
    const result = await createCommissionCharge({
      firstMonthRent,
      commissionRate,
      ownerWalletId,
      customerName: name ?? "Inquilino",
      customerEmail: email ?? "sem-email@vivanomads.com.br",
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao cobrar comissão." },
      { status: 500 }
    );
  }
}
