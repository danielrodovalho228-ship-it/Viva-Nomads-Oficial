import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createContract, type ContractInput } from "@/lib/integrations/zapsign";

/** Gera o contrato de locação por temporada via ZapSign. */
export async function POST(request: Request) {
  // Segurança: exige sessão em produção (demo/preview passa direto).
  const { block } = await requireUser();
  if (block) return block;
  const body = (await request.json().catch(() => ({}))) as Partial<ContractInput>;

  if (!body.tenantName || !body.ownerName || !body.propertyTitle) {
    return NextResponse.json({ error: "Dados do contrato incompletos." }, { status: 400 });
  }

  try {
    const result = await createContract({
      tenantName: body.tenantName,
      tenantEmail: body.tenantEmail,
      ownerName: body.ownerName,
      propertyTitle: body.propertyTitle,
      monthlyRent: body.monthlyRent ?? 0,
      termMonths: body.termMonths ?? 0,
      guarantee: body.guarantee ?? "",
      costSplit: body.costSplit ?? {},
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao gerar contrato." },
      { status: 500 }
    );
  }
}
