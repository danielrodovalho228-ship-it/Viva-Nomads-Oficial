import type { Metadata } from "next";
import { guardSocios } from "@/lib/socios/guard";
import { PaginasInternasNav } from "@/components/apresentacao/paginas-nav";
import { ModeloNegocio } from "@/components/modelo-negocio/modelo-negocio";

// Página de apresentação (sócios/investidores/proprietários), divulgada só por
// link direto — não indexar nem seguir.
export const metadata: Metadata = {
  title: "Modelo de negócio",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ModeloDeNegocioPage() {
  await guardSocios("/modelodenegocio");
  return (
    <>
      <PaginasInternasNav atual="/modelodenegocio" />
      <ModeloNegocio />
    </>
  );
}
