import { permanentRedirect } from "next/navigation";

/**
 * E294: a Calculadora de ROI e o Simulador de rentabilidade viraram um cálculo só, com os números do dono
 * (/dashboard/simulador: rentabilidade, comparação com o tradicional, payback e ROI). O endereço antigo leva para lá.
 */
export default function RoiImovelPage() {
  permanentRedirect("/dashboard/simulador");
}
