/*
  Integração CAF — verificação de identidade (seção 8.1). Prompt 19: vale para qualquer conta (inquilino e
  proprietário — o dono confirma a identidade antes da conferência da matrícula).
  Identidade, documento (OCR), prova de vida (biometria) e risco contextual.
  Cobre estrangeiros (CRNM/RNE). Sem CAF_API_TOKEN, retorna laudo simulado.

  Docs: https://docs.caf.io
*/

import type { CafResult } from "@/lib/closing";
import { idSemResultado, lerRespostaCaf } from "@/lib/integrations/caf-resposta";

import { exigirChaveEmProducao, integracoesSimuladas, registrarSimulado } from "@/lib/integracoes";

const API_BASE = process.env.CAF_API_BASE ?? "https://api.combateafraude.com";

export function isCafConfigured() {
  return !!process.env.CAF_API_TOKEN && !integracoesSimuladas();
}

export interface CafRequest {
  name: string;
  cpf?: string;
  documentId?: string; // CRNM/RNE para estrangeiros
}

/** Dispara (ou simula) a verificação CAF e devolve um laudo com semáforo. */
export async function verifyTenant(req: CafRequest): Promise<CafResult> {
  if (!isCafConfigured()) {
    exigirChaveEmProducao("CAF");
    await registrarSimulado("caf", { acao: "verificacao" });
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

  // A documentação descreve a criação da transação devolvendo só o id; o resultado vem no GET da transação.
  let data: unknown = await res.json();
  const id = idSemResultado(data);
  if (id) {
    const det = await fetch(`${API_BASE}/v1/transactions/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${process.env.CAF_API_TOKEN}` },
    });
    if (det.ok) data = await det.json();
  }

  // Leitura defensiva (formato do template não confirmado sem contrato): ver src/lib/integrations/caf-resposta.ts.
  const l = lerRespostaCaf(data, { name: req.name, cpf: req.cpf });
  return {
    light: l.light,
    identity: l.identity,
    liveness: l.liveness,
    document: l.document,
    coversForeigners: true,
    demo: false,
    notes: l.notes,
    ocrConfere: l.ocrConfere,
    receitaConfere: l.receitaConfere,
    pendente: l.pendente,
  };
}

/*
  Certta (ex-CAF) — Verif AI Smart OCR para COMPROVANTE DE RESIDÊNCIA (prompt 11, camada preparada).
  DESLIGADO até o contrato: só liga com CERTTA_SMART_OCR=on + CAF_API_TOKEN. Tem a mesma interface do conferidor
  da IA (src/lib/documento/conferidor.ts), para trocar por configuração. Enquanto o endpoint e o formato da resposta
  não forem confirmados no contrato, devolve null (o caso vai para a revisão humana).
*/
export function certtaOcrAtivo(): boolean {
  return process.env.CERTTA_SMART_OCR === "on" && !!process.env.CAF_API_TOKEN && !integracoesSimuladas();
}

export async function lerComprovanteCertta(
  _bytes: Uint8Array,
  _mime: string,
): Promise<import("@/lib/documento/conferencia").LeituraDocumento | null> {
  // TODO(certta): chamar o Smart OCR (conferência do código de barras incluída) quando o contrato sair.
  return null;
}
