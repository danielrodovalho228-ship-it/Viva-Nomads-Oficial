import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createSubaccount } from "@/lib/payments/asaas";

/**
 * Cria a subconta Asaas de um proprietário aprovado (walletId p/ split + apiKey).
 * ⚠️ A apiKey é devolvida só uma vez — o chamador deve persistir criptografada.
 */
export async function POST(request: Request) {
  // Segurança: exige sessão em produção (demo/preview passa direto).
  const { block } = await requireUser();
  if (block) return block;
  const body = await request.json().catch(() => ({}));
  const { name, email, cpfCnpj, mobilePhone } = body as {
    name?: string;
    email?: string;
    cpfCnpj?: string;
    mobilePhone?: string;
  };

  if (!name || !email || !cpfCnpj) {
    return NextResponse.json(
      { error: "name, email e cpfCnpj são obrigatórios." },
      { status: 400 }
    );
  }

  try {
    const result = await createSubaccount({ name, email, cpfCnpj, mobilePhone });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao criar subconta." },
      { status: 500 }
    );
  }
}
