import type { Metadata } from "next";
import { ModeloNegocio } from "@/components/modelo-negocio/modelo-negocio";

// Página de apresentação (sócios/investidores/proprietários), divulgada só por
// link direto — não indexar nem seguir.
export const metadata: Metadata = {
  title: "Modelo de negócio",
  robots: { index: false, follow: false },
};

export default function ModeloDeNegocioPage() {
  return <ModeloNegocio />;
}
