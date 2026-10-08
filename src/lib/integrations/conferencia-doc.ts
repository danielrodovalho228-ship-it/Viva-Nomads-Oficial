/*
  Integrações da PRÉ-CONFERÊNCIA do documento do imóvel — preparadas, SEM CHAVE.

  • CNPJ ativo: consulta a situação cadastral do CNPJ do dono (CNPJ_API_URL +
    CNPJ_API_TOKEN, quando contratado).
  • OCR: lê o nome do titular no documento enviado (OCR_API_URL + OCR_API_TOKEN).

  Diferente das cobranças, aqui NUNCA trava nada: sem chave, devolve null
  ("não consultado") também em produção — a pré-conferência só ajuda o Daniel,
  quem decide é ele. No laboratório (INTEGRACOES_SIMULADAS=on) devolve valores
  de demonstração e registra no LAB_OUTBOX.
*/
import { integracoesSimuladas, registrarSimulado } from "@/lib/integracoes";

export function isCnpjConfigured() {
  return !!process.env.CNPJ_API_TOKEN && !!process.env.CNPJ_API_URL && !integracoesSimuladas();
}

export function isOcrConfigured() {
  return !!process.env.OCR_API_TOKEN && !!process.env.OCR_API_URL && !integracoesSimuladas();
}

export interface ResultadoConsulta<T> {
  valor: T | null;
  demo: boolean;
}

/** Situação cadastral do CNPJ ("ATIVA", "BAIXADA"…), ou null quando não consultado. */
export async function situacaoCnpj(cnpj: string): Promise<ResultadoConsulta<string>> {
  if (!isCnpjConfigured()) {
    if (!integracoesSimuladas()) return { valor: null, demo: false };
    await registrarSimulado("cnpj", { acao: "situacao" });
    return { valor: "ATIVA", demo: true };
  }
  try {
    const res = await fetch(`${process.env.CNPJ_API_URL}/${encodeURIComponent(cnpj)}`, {
      headers: { Authorization: `Bearer ${process.env.CNPJ_API_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { valor: null, demo: false };
    const data = (await res.json()) as { situacao?: string; descricao_situacao_cadastral?: string };
    const sit = data.situacao ?? data.descricao_situacao_cadastral ?? null;
    return { valor: sit ? String(sit).toUpperCase() : null, demo: false };
  } catch {
    return { valor: null, demo: false };
  }
}

/**
 * Nome do titular lido no documento (OCR), ou null quando não lido. Recebe um
 * link ASSINADO e curto do bucket privado — o arquivo nunca fica público.
 * No laboratório devolve o próprio nome informado (simula uma leitura que bate).
 */
export async function titularPorOcr(urlAssinada: string | null, titularInformado: string | null): Promise<ResultadoConsulta<string>> {
  if (!isOcrConfigured()) {
    if (!integracoesSimuladas()) return { valor: null, demo: false };
    await registrarSimulado("ocr", { acao: "titular" });
    return { valor: titularInformado?.trim() || null, demo: true };
  }
  if (!urlAssinada) return { valor: null, demo: false };
  try {
    const res = await fetch(`${process.env.OCR_API_URL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OCR_API_TOKEN}` },
      body: JSON.stringify({ url: urlAssinada, campos: ["titular"] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { valor: null, demo: false };
    const data = (await res.json()) as { titular?: string };
    return { valor: data.titular?.trim() || null, demo: false };
  } catch {
    return { valor: null, demo: false };
  }
}
