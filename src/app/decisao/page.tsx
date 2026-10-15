import type { Metadata } from "next";
import { guardSocios } from "@/lib/socios/guard";
import { PaginasInternasNav } from "@/components/apresentacao/paginas-nav";
import { mesesContratoValidos } from "@/lib/financeiro/projecao";
import { Decisao } from "@/components/decisao/decisao";

// Documento interno (decisão do modelo de negócio) — link direto, não indexar.
export const metadata: Metadata = {
  title: "Decisão do modelo de negócio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DecisaoPage({ searchParams }: { searchParams: Promise<{ meses?: string | string[] }> }) {
  await guardSocios("/decisao");
  const { meses } = await searchParams;
  return (
    <>
      <PaginasInternasNav atual="/decisao" />
      <Decisao meses={mesesContratoValidos(Array.isArray(meses) ? meses[0] : meses)} />
    </>
  );
}
