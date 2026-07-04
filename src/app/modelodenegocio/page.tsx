import type { Metadata } from "next";
import { PaginasInternasNav } from "@/components/apresentacao/paginas-nav";
import { ModeloNegocio } from "@/components/modelo-negocio/modelo-negocio";

// Página de apresentação (sócios/investidores/proprietários), divulgada só por
// link direto — não indexar nem seguir.
export const metadata: Metadata = {
  title: "Modelo de negócio",
  robots: { index: false, follow: false },
};

export default function ModeloDeNegocioPage() {
  return (
    <>
      <PaginasInternasNav atual="/modelodenegocio" />
      <ModeloNegocio />
    </>
  );
}
