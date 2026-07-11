import type { Metadata } from "next";
import { guardSocios } from "@/lib/socios/guard";
import { PaginasInternasNav } from "@/components/apresentacao/paginas-nav";
import { Roi } from "@/components/roi/roi";

// Página de apresentação (sócios/investidores), por link direto — não indexar.
export const metadata: Metadata = {
  title: "Modelo financeiro (ROI)",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RoiPage() {
  await guardSocios("/roi");
  return (
    <>
      <PaginasInternasNav atual="/roi" />
      <Roi />
    </>
  );
}
