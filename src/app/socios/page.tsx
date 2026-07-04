import type { Metadata } from "next";
import { PaginasInternasNav } from "@/components/apresentacao/paginas-nav";
import { Socios } from "@/components/socios/socios";

// Documento interno (proposta de papéis) — por link direto, não indexar.
export const metadata: Metadata = {
  title: "Sócios e Responsabilidades",
  robots: { index: false, follow: false },
};

export default function SociosPage() {
  return (
    <>
      <PaginasInternasNav atual="/socios" />
      <Socios />
    </>
  );
}
