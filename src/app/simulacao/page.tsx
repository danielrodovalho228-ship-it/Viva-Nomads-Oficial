import type { Metadata } from "next";
import { guardSocios } from "@/lib/socios/guard";
import { PaginasInternasNav } from "@/components/apresentacao/paginas-nav";
import { Simulador } from "@/components/simulacao/simulador";

// Página privada: divulgada só por link direto (não indexar nem seguir).
export const metadata: Metadata = {
  title: "Simulação do negócio — documento interno dos sócios",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SimulacaoPage() {
  await guardSocios("/simulacao");
  return (
    <>
      <PaginasInternasNav atual="/simulacao" />
      <Simulador />
    </>
  );
}
