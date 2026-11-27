// E853: a linha de emergência de /seguranca — texto exato aprovado. A Viva não é canal de emergência.
// E943: o 192 (SAMU) entra ao lado do 190 (polícia) e do 193 (bombeiros).
export const FRASE_EMERGENCIA_SEGURANCA = "Em uma emergência, ligue 190, 192 ou 193. A Viva não recebe esse tipo de ligação.";
export const NUMEROS_EMERGENCIA = ["190", "192", "193"] as const;

/** A frase em pedaços (texto e números), para a tela ligar os números sem mudar o texto. */
export function pedacosDaFraseEmergencia(): { texto: string; href: string | null }[] {
  return FRASE_EMERGENCIA_SEGURANCA.split(/(190|192|193)/)
    .filter(Boolean)
    .map((t) => ({ texto: t, href: (NUMEROS_EMERGENCIA as readonly string[]).includes(t) ? `tel:${t}` : null }));
}
