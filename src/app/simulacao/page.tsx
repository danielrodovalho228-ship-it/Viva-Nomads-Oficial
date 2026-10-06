import type { Metadata } from "next";
import { guardSocios } from "@/lib/socios/guard";
import { PaginasInternasNav } from "@/components/apresentacao/paginas-nav";
import { ModeloFinanceiro } from "@/components/financeiro/modelo-financeiro";

// Página privada: divulgada só por link direto (não indexar nem seguir).
export const metadata: Metadata = {
  title: "Simulação do negócio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SimulacaoPage() {
  // Sócio: página completa. Investidor (código próprio): só esta página, sem o
  // menu das outras internas, em modo leitura.
  const quem = await guardSocios("/simulacao");
  const investidor = quem === "investidor";
  return (
    <>
      {!investidor && <PaginasInternasNav atual="/simulacao" />}
      <ModeloFinanceiro pagina="simulacao" leitura={investidor} />
    </>
  );
}
