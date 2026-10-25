import type { Metadata } from "next";
import Link from "next/link";
import { Search, Home } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { NotFoundIllustration } from "@/components/illustrations";

// Título próprio já no HTML inicial (o streaming do notFound() servia o padrão da home).
// robots: null — fica só o noindex do Next, sem o "index, follow" da raiz.
export const metadata: Metadata = {
  title: "Página não encontrada",
  robots: null,
};

/**
 * 404 branded da rota de detalhe do imóvel (App Router).
 * Renderiza dentro do layout público (navbar + footer) quando a página chama
 * `notFound()` — para id inexistente, mal formado ou imóvel despublicado.
 */
export default function ImovelNotFound() {
  return (
    <div className="container-page flex flex-col items-center py-16 text-center">
      <NotFoundIllustration />
      <h1 className="mt-8 font-title text-2xl font-semibold text-ink sm:text-[28px]">
        Página não encontrada
      </h1>
      <p className="mt-2 max-w-md text-muted">
        Este anúncio não existe mais ou foi removido.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/buscar" variant="primary">
          <Search className="h-4 w-4" /> Ver imóveis disponíveis
        </ButtonLink>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-forest"
        >
          <Home className="h-4 w-4" /> Voltar ao início
        </Link>
      </div>
    </div>
  );
}
