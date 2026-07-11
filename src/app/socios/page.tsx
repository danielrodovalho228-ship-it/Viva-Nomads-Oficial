import type { Metadata } from "next";
import { guardSocios } from "@/lib/socios/guard";
import { PaginasInternasNav } from "@/components/apresentacao/paginas-nav";
import { Socios } from "@/components/socios/socios";

// Documento interno (proposta de papéis) — por link direto, não indexar.
export const metadata: Metadata = {
  title: "Sócios e Responsabilidades",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SociosPage() {
  await guardSocios("/socios");
  return (
    <>
      <PaginasInternasNav atual="/socios" />
      <Socios />
    </>
  );
}
