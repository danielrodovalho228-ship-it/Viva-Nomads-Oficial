import { NextResponse } from "next/server";
import { verifyTenant } from "@/lib/integrations/caf";

/** Dispara a verificação CAF de um inquilino e retorna o laudo de semáforo. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { name, cpf, documentId } = body as {
    name?: string;
    cpf?: string;
    documentId?: string;
  };

  try {
    const result = await verifyTenant({ name: name ?? "Inquilino", cpf, documentId });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha na verificação CAF." },
      { status: 500 }
    );
  }
}
