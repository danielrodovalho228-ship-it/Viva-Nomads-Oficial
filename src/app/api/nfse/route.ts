import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { emitInvoice, type InvoiceType } from "@/lib/integrations/nfse";

/** Emite NFS-e de uma receita da plataforma (comissão, assinatura, serviço). */
export async function POST(request: Request) {
  // Segurança: exige sessão em produção (demo/preview passa direto).
  const { block } = await requireUser();
  if (block) return block;
  const body = await request.json().catch(() => ({}));
  const { type, amount, description, customerName, customerDocument, referenceId } = body as {
    type?: InvoiceType;
    amount?: number;
    description?: string;
    customerName?: string;
    customerDocument?: string;
    referenceId?: string;
  };

  if (!amount || amount <= 0 || !description || !customerName) {
    return NextResponse.json({ error: "Dados da NFS-e incompletos." }, { status: 400 });
  }

  try {
    const result = await emitInvoice({
      type: type ?? "platform",
      amount,
      description,
      customerName,
      customerDocument,
      referenceId: referenceId ?? crypto.randomUUID(),
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao emitir NFS-e." },
      { status: 500 }
    );
  }
}
