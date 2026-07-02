import type { Metadata } from "next";
import { Simulador } from "@/components/simulacao/simulador";

// Página privada: divulgada só por link direto (não indexar nem seguir).
export const metadata: Metadata = {
  title: "Simulador de receita",
  robots: { index: false, follow: false },
};

export default function SimulacaoPage() {
  return <Simulador />;
}
