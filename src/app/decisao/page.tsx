import type { Metadata } from "next";
import { guardSocios } from "@/lib/socios/guard";
import { PaginasInternasNav } from "@/components/apresentacao/paginas-nav";
import { Decisao } from "@/components/decisao/decisao";

// Documento interno (decisão do modelo de negócio) — link direto, não indexar.
export const metadata: Metadata = {
  title: "Decisão do modelo de negócio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DecisaoPage() {
  await guardSocios("/decisao");
  return (
    <>
      <PaginasInternasNav atual="/decisao" />
      <Decisao />
    </>
  );
}
