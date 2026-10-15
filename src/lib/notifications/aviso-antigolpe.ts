/** Rodapé fixo antigolpe de TODO e-mail transacional (ordens 404cd213 item 3 e d250ea2f). */
export const AVISO_ANTIGOLPE = "A Viva Nomads nunca pede Pix, senha ou código por WhatsApp ou SMS. Pagamentos só pelo que está no contrato.";

export function rodapeAntigolpeHtml(siteUrl: string): string {
  return `<p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#6b7280;">${AVISO_ANTIGOLPE} <a href="${siteUrl}/seguranca" style="color:#0A4FD6;">Dicas de segurança</a><br>Plataforma em fase de testes. Lançamento oficial em 2027.</p>`;
}
