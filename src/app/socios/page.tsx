import type { Metadata } from "next";
import { guardSocios } from "@/lib/socios/guard";
import { PaginasInternasNav } from "@/components/apresentacao/paginas-nav";
import { AvisoEmAtualizacao } from "@/components/socios/aviso-atualizacao";
import { carregarPendenciasSocios } from "@/lib/socios/pendencias-servidor";
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
      {/* E597: aviso fixo enquanto a página não é revisada com a decisão de 04/11 (Caminho B). */}
      <AvisoEmAtualizacao />
      <PaginasInternasNav atual="/socios" />
      <Socios pendencias={await carregarPendenciasSocios()} />
    </>
  );
}
