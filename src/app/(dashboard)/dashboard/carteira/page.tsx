import type { Metadata } from "next";
import { PlanGate } from "@/components/dashboard/plan-gate";
import { CarteiraClient } from "./carteira-client";

export const metadata: Metadata = {
  title: "Carteira — Viva Nomads",
};

/**
 * Carteira consolidada (Plano Gestor). A renderização fica no client
 * (carteira-client), que suporta o modo demonstração do admin.
 */
export default function PortfolioPage() {
  return (
    <PlanGate title="Carteira">
      <CarteiraClient />
    </PlanGate>
  );
}
