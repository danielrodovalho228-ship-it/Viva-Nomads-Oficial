/*
  Aviso antigolpe (ordem 19cfa5b1, "Próximo do FF" 5/6) — PURO.
  O texto é o mesmo nos 3 lugares (anúncio, pedido de moradia, Mensagens) e leva a /seguranca.
  O detector só ALERTA quem recebe; nunca bloqueia nem guarda o texto.
*/
export const AVISO_ANTIGOLPE_TEXTO =
  "A Viva nunca pede PIX, transferência ou pagamento fora do contrato. Desconfie de quem pedir sinal antes de assinar.";

export const AVISO_ANTIGOLPE_ALERTA =
  "Esta mensagem fala de PIX ou dados bancários. Antes do contrato assinado, não pague nem transfira nada: a Viva não cobra fora do contrato.";

const PADROES_PAGAMENTO: RegExp[] = [
  /\bpix\b/i,
  /\bchave\s+(?:pix|aleat[óo]ria)\b/i,
  /\bag[êe]ncia\b/i,
  /\bconta\s+(?:corrente|poupan[çc]a|banc[áa]ria)\b/i,
  /\bconta\s*(?:n[º°o.]?\s*)?\d{4,}/i,
  /\btransfer[êe]ncia\b/i,
  /\bdep[óo]sito\b/i,
  /\biban\b/i,
  /\b(?:pagar|pague|pagamento|pedir|pede|exigir|adiantar)\s+(?:de\s+|do\s+|um\s+|o\s+)?sinal\b/i,
  /\bsinal\s+(?:de\s+)?(?:r\$|\d)/i,
  /\bsinal\s+(?:antes|para\s+(?:garantir|reservar|segurar))\b/i,
];

/** O texto parece pedir PIX/depósito/dados bancários? */
export function pareceDadoBancario(texto: string): boolean {
  const t = texto ?? "";
  return PADROES_PAGAMENTO.some((re) => re.test(t));
}

export interface ContratoParaAlerta {
  property_id: string;
  tenant_id: string;
  assinado_proprietario_em: string | null;
  assinado_inquilino_em: string | null;
}

/**
 * O alerta de PIX só some quando existe contrato ASSINADO pelas duas partes
 * (proprietário e inquilino) sobre o imóvel da conversa e o inquilino do contrato
 * é uma das duas pessoas da conversa. Contrato de outra pessoa ou só rascunho não conta.
 */
export function contratoAssinadoEntrePartes(
  contratos: ContratoParaAlerta[],
  conversa: { propertyId?: string; eu: string; outroId?: string }
): boolean {
  if (!conversa.propertyId || !conversa.outroId) return false;
  return contratos.some(
    (c) =>
      c.property_id === conversa.propertyId &&
      !!c.assinado_proprietario_em &&
      !!c.assinado_inquilino_em &&
      (c.tenant_id === conversa.eu || c.tenant_id === conversa.outroId)
  );
}
