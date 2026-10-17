import { permanentRedirect } from "next/navigation";

/**
 * Prompt 16: a "Viabilidade de mobiliar" repetia a Calculadora de ROI (com outra conta). Saiu do menu e de
 * Ferramentas; o endereço antigo leva para a Calculadora de ROI, que tem a comparação justa com o tradicional.
 */
export default function ViabilidadePage() {
  permanentRedirect("/dashboard/roi-imovel");
}
