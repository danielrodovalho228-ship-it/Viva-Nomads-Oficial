import { EmConstrucao } from "@/components/dashboard/primitives";

export const metadata = { title: "Simulador de rentabilidade" };

// Placeholder (Fase 0): estanca o vazamento — o card do hub aponta para cá em
// vez de /simulacao (página interna dos sócios). O simulador do PROPRIETÁRIO
// (Fase 1) entra aqui em seguida.
export default function SimuladorPage() {
  return (
    <EmConstrucao
      title="Simulador de rentabilidade"
      text="Estamos finalizando o simulador que mostra quanto o SEU imóvel rende por mês na Viva Nomads. Em breve, aqui mesmo no seu painel."
    />
  );
}
