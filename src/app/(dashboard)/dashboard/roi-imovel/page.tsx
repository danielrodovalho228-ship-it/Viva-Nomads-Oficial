import { EmConstrucao } from "@/components/dashboard/primitives";

export const metadata = { title: "Calculadora de ROI" };

// Placeholder (Fase 0): o card do hub aponta para cá em vez de /roi (página
// interna dos sócios). A Calculadora de ROI do imóvel (Fase 2, que absorve a
// "Viabilidade de mobiliar") entra aqui em seguida.
export default function RoiImovelPage() {
  return (
    <EmConstrucao
      title="Calculadora de ROI"
      text="Estamos finalizando a calculadora que mostra se vale a pena mobiliar o seu imóvel — payback e retorno anual. Em breve, aqui no seu painel."
    />
  );
}
