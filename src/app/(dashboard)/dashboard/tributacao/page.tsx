import type { Metadata } from "next";
import { PageTitle } from "@/components/dashboard/primitives";
import { TaxSimulator } from "@/components/tax-simulator";

export const metadata: Metadata = { title: "Tributação PF × PJ" };

/** Prompt 18: o simulador PF × PJ mora só aqui, em Ferramentas (saiu da Conta e do cadastro). */
export default function TributacaoPage() {
  return (
    <>
      <PageTitle title="Tributação PF × PJ" subtitle="Estime o imposto das locações como pessoa física e como empresa." />
      <div className="mt-6" data-testid="ferramenta-tributacao">
        <TaxSimulator />
      </div>
    </>
  );
}
