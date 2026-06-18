/*
  Integração CAF — verificação de inquilino (seção 8.1).
  Identidade, documento (OCR), prova de vida (biometria) e risco contextual.
  Cobre estrangeiros (CRNM/RNE). Sem CAF_API_TOKEN, retorna laudo simulado.

  Docs: https://docs.caf.io
*/

import type { CafResult, TrafficLight } from "@/lib/closing";

const API_BASE = process.env.CAF_API_BASE ?? "https://api.combateafraude.com";

export function isCafConfigured() {
  return !!process.env.CAF_API_TOKEN;
}

export interface CafRequest {
  name: string;
  cpf?: string;
  documentId?: string; // CRNM/RNE para estrangeiros
}

/** Dispara (ou simula) a verificação CAF e devolve um laudo com semáforo. */
export async function verifyTenant(req: CafRequest): Promise<CafResult> {
  if (!isCafConfigured()) {
    return {
      light: "green",
      identity: true,
      liveness: true,
      document: true,
      coversForeigners: true,
      demo: true,
      notes: [
        "Identidade confirmada (modo demonstração)",
        "Prova de vida aprovada",
        "Sem execuções fiscais relevantes",
      ],
    };
  }

  const res = await fetch(`${API_BASE}/v1/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CAF_API_TOKEN}`,
    },
    body: JSON.stringify({
      templateId: process.env.CAF_TEMPLATE_ID,
      attributes: { name: req.name, cpf: req.cpf, documentId: req.documentId },
    }),
  });

  if (!res.ok) {
    throw new Error(`CAF ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    status?: string;
    validations?: { identity?: boolean; liveness?: boolean; document?: boolean };
    risk?: { level?: string; reasons?: string[] };
  };

  // Mapeia o nível de risco do CAF para o semáforo da plataforma.
  const level = data.risk?.level?.toUpperCase();
  const light: TrafficLight =
    level === "HIGH" ? "red" : level === "MEDIUM" ? "yellow" : "green";

  return {
    light,
    identity: data.validations?.identity ?? false,
    liveness: data.validations?.liveness ?? false,
    document: data.validations?.document ?? false,
    coversForeigners: true,
    demo: false,
    notes: data.risk?.reasons ?? ["Análise concluída."],
  };
}
