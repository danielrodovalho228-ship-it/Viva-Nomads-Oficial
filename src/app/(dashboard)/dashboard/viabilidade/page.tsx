import { permanentRedirect } from "next/navigation";

/**
 * Prompt 16: a "Viabilidade de mobiliar" repetia a Calculadora de ROI (com outra conta). Saiu do menu e de
 * Ferramentas. E294: a Calculadora de ROI se juntou ao Simulador num cálculo só — o endereço antigo leva direto para lá.
 */
export default function ViabilidadePage() {
  permanentRedirect("/dashboard/simulador");
}
