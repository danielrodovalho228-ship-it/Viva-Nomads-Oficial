/*
  NFS-e Nacional (LC 214/2025, padrão único obrigatório desde 01/01/2026).
  Provedores com API REST: Focus NFe, PlugNotas (TecnoSpeed), Brasil NFe.
  Uso no MVP: emitir NF das receitas da PRÓPRIA plataforma (comissão, assinatura,
  serviços). A emissão de NF do aluguel pelo proprietário PJ fica para fase futura
  (campo issues_invoice e gancho já prontos). Sem NFSE_API_TOKEN, modo demonstração.
*/

export type InvoiceType = "platform" | "rent";

export function isNfseConfigured() {
  return !!process.env.NFSE_API_TOKEN;
}

export interface InvoiceResult {
  demo: boolean;
  nfseId: string;
  status: string;
  pdfUrl?: string;
}

const PROVIDER_BASE =
  process.env.NFSE_PROVIDER === "plugnotas"
    ? "https://api.plugnotas.com.br"
    : "https://api.focusnfe.com.br/v2"; // focus por padrão

/** Emite (ou simula) uma NFS-e para uma receita da plataforma. */
export async function emitInvoice(params: {
  type: InvoiceType;
  amount: number;
  description: string;
  customerName: string;
  customerDocument?: string; // CPF/CNPJ
  referenceId: string;
}): Promise<InvoiceResult> {
  if (!isNfseConfigured()) {
    return {
      demo: true,
      nfseId: `demo_nfse_${Math.random().toString(36).slice(2, 10)}`,
      status: "processing",
      pdfUrl: undefined,
    };
  }

  const res = await fetch(`${PROVIDER_BASE}/nfse?ref=${encodeURIComponent(params.referenceId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NFSE_API_TOKEN}`,
    },
    body: JSON.stringify({
      servico: { discriminacao: params.description, valor_servicos: params.amount },
      tomador: { razao_social: params.customerName, cpf_cnpj: params.customerDocument },
    }),
  });

  if (!res.ok) throw new Error(`NFS-e ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { ref?: string; status?: string; url?: string };
  return {
    demo: false,
    nfseId: data.ref ?? params.referenceId,
    status: data.status ?? "processing",
    pdfUrl: data.url,
  };
}
