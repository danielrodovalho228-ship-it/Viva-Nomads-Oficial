/*
  Integração ZapSign — contrato de locação por temporada (seção 8.5).
  Validade jurídica (Lei 14.063/2020). Sem ZAPSIGN_API_TOKEN, simula o envio.

  Docs: https://docs.zapsign.com.br
*/

const API_BASE = "https://api.zapsign.com.br/api/v1";

export function isZapsignConfigured() {
  return !!process.env.ZAPSIGN_API_TOKEN;
}

export interface ContractInput {
  tenantName: string;
  tenantEmail?: string;
  ownerName: string;
  propertyTitle: string;
  monthlyRent: number;
  termMonths: number;
  guarantee: string;
  costSplit: Record<string, "owner" | "tenant">;
}

export interface ContractResult {
  demo: boolean;
  docId: string;
  status: string;
  signUrl?: string;
}

/** Gera (ou simula) o contrato no ZapSign e retorna o documento para assinatura. */
export async function createContract(input: ContractInput): Promise<ContractResult> {
  if (!isZapsignConfigured()) {
    return {
      demo: true,
      docId: `demo_${Math.random().toString(36).slice(2, 10)}`,
      status: "pending",
      signUrl: "https://app.zapsign.com.br/verificar/demo",
    };
  }

  const res = await fetch(`${API_BASE}/docs/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ZAPSIGN_API_TOKEN}`,
    },
    body: JSON.stringify({
      name: `Contrato de locação por temporada — ${input.propertyTitle}`,
      // Em produção, usar template com campos dinâmicos:
      // template_id + data com partes, prazo, valor, garantia e rateio.
      signers: [
        { name: input.tenantName, email: input.tenantEmail },
        { name: input.ownerName },
      ],
      external_id: JSON.stringify({
        rent: input.monthlyRent,
        term: input.termMonths,
        guarantee: input.guarantee,
        split: input.costSplit,
      }),
    }),
  });

  if (!res.ok) {
    throw new Error(`ZapSign ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { token?: string; status?: string; sign_url?: string };
  return {
    demo: false,
    docId: data.token ?? "",
    status: data.status ?? "pending",
    signUrl: data.sign_url,
  };
}
