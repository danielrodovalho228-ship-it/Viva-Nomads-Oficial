import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { NotFoundIllustration } from "@/components/illustrations";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-2 px-6 text-center">
      <Logo />
      <div className="mt-12">
        <NotFoundIllustration />
      </div>
      <p className="mt-6 font-title text-6xl font-extrabold text-ink">404</p>
      <h1 className="mt-2 font-title text-2xl font-bold text-ink">Página não encontrada</h1>
      <p className="mt-2 max-w-md text-muted">
        O endereço que você procurou não existe ou foi movido. Vamos te levar de volta.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/home" variant="primary">
          Ir para o início
        </ButtonLink>
        <ButtonLink href="/buscar" variant="outline">
          Buscar imóveis
        </ButtonLink>
      </div>
      <Link href="/para-proprietarios" className="mt-6 text-sm text-muted hover:text-blue-500">
        É proprietário? Anuncie seu imóvel →
      </Link>
    </div>
  );
}
